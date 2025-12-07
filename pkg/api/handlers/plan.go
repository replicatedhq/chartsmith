// Package handlers contains HTTP handlers for AI SDK tool execution endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
	"go.uber.org/zap"
)

// BufferedToolCall represents a tool call that was buffered during AI SDK streaming
type BufferedToolCall struct {
	ID        string                 `json:"id"`
	ToolName  string                 `json:"toolName"`
	Args      map[string]interface{} `json:"args"`
	Timestamp int64                  `json:"timestamp"`
}

// CreatePlanFromToolCallsRequest represents a request to create a plan from buffered tool calls
type CreatePlanFromToolCallsRequest struct {
	WorkspaceID   string             `json:"workspaceId"`
	ChatMessageID string             `json:"chatMessageId"`
	ToolCalls     []BufferedToolCall `json:"toolCalls"`
	// PR3.2: Optional plan description for text-only plans
	// When provided, this is used instead of generating from tool calls
	Description string `json:"description,omitempty"`
}

// CreatePlanFromToolCallsResponse represents the response from plan creation
type CreatePlanFromToolCallsResponse struct {
	PlanID string `json:"planId"`
}

// CreatePlanFromToolCalls handles plan creation from AI SDK buffered tool calls
// POST /api/plan/create-from-tools
func CreatePlanFromToolCalls(w http.ResponseWriter, r *http.Request) {
	var req CreatePlanFromToolCallsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Debug("Failed to decode create plan request", zap.Error(err))
		writeBadRequest(w, "Invalid request body")
		return
	}

	// Validate required fields
	if req.WorkspaceID == "" {
		writeBadRequest(w, "workspaceId is required")
		return
	}
	if req.ChatMessageID == "" {
		writeBadRequest(w, "chatMessageId is required")
		return
	}
	// PR3.2: Allow empty tool calls for text-only plans (two-phase workflow)
	// When intent.isPlan=true and tools are disabled, we still create a plan record
	// but with empty tool calls. The plan text IS the plan, stored via chat message response.
	// Empty toolCalls array is valid for text-only plans.

	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	logger.Debug("CreatePlanFromToolCalls request",
		zap.String("workspaceId", req.WorkspaceID),
		zap.String("chatMessageId", req.ChatMessageID),
		zap.Int("toolCallCount", len(req.ToolCalls)),
		zap.Bool("hasDescription", req.Description != ""))

	// PR3.2: Use provided description for text-only plans, otherwise generate from tool calls
	var description string
	if req.Description != "" {
		description = req.Description
	} else {
		description = generatePlanDescription(req.ToolCalls)
	}

	// Extract action files from tool calls
	actionFiles := extractActionFiles(req.ToolCalls)

	// Serialize buffered tool calls to JSON for storage
	bufferedToolCallsJSON, err := json.Marshal(req.ToolCalls)
	if err != nil {
		logger.Errorf("Failed to serialize buffered tool calls: %v", err)
		writeInternalError(w, "Failed to serialize tool calls")
		return
	}

	// Create the plan with buffered tool calls
	planID, err := createPlanWithBufferedTools(ctx, req.WorkspaceID, req.ChatMessageID, description, actionFiles, bufferedToolCallsJSON)
	if err != nil {
		logger.Errorf("Failed to create plan: %v", err)
		writeInternalError(w, "Failed to create plan: "+err.Error())
		return
	}

	// Publish plan update event via Centrifugo
	publishPlanUpdate(ctx, req.WorkspaceID, planID)

	// PR3.0: Publish chatmessage-updated event so frontend receives responsePlanId
	// This allows the chat message to display the plan immediately without page reload
	publishChatMessageUpdate(ctx, req.WorkspaceID, req.ChatMessageID)

	writeJSON(w, http.StatusOK, CreatePlanFromToolCallsResponse{
		PlanID: planID,
	})
}

// generatePlanDescription creates a markdown description of what the plan will do
func generatePlanDescription(toolCalls []BufferedToolCall) string {
	// PR3.2: Handle text-only plans (empty tool calls)
	if len(toolCalls) == 0 {
		return "Plan awaiting approval. Click 'Create Chart' to proceed with file creation."
	}

	var lines []string
	lines = append(lines, "I'll make the following changes:\n")

	for _, tc := range toolCalls {
		if tc.ToolName == "textEditor" {
			command, _ := tc.Args["command"].(string)
			path, _ := tc.Args["path"].(string)

			switch command {
			case "create":
				lines = append(lines, fmt.Sprintf("- Create file: `%s`", path))
			case "str_replace":
				lines = append(lines, fmt.Sprintf("- Modify file: `%s`", path))
			}
		}
	}

	return strings.Join(lines, "\n")
}

// extractActionFiles extracts unique action files from tool calls
func extractActionFiles(toolCalls []BufferedToolCall) []workspacetypes.ActionFile {
	var files []workspacetypes.ActionFile
	seen := make(map[string]bool)

	for _, tc := range toolCalls {
		if tc.ToolName == "textEditor" {
			path, _ := tc.Args["path"].(string)
			command, _ := tc.Args["command"].(string)

			if path == "" || seen[path] {
				continue
			}
			seen[path] = true

			action := "update"
			if command == "create" {
				action = "create"
			}

			files = append(files, workspacetypes.ActionFile{
				Path:   path,
				Action: action,
				Status: "pending",
			})
		}
	}
	return files
}

// createPlanWithBufferedTools creates a plan record with buffered tool calls in a single transaction
func createPlanWithBufferedTools(ctx context.Context, workspaceID, chatMessageID, description string, actionFiles []workspacetypes.ActionFile, bufferedToolCallsJSON []byte) (string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Generate plan ID
	planID, err := securerandom.Hex(6)
	if err != nil {
		return "", fmt.Errorf("error generating plan ID: %w", err)
	}

	chatMessageIDs := []string{chatMessageID}
	now := time.Now()

	// Insert plan with buffered tool calls
	query := `INSERT INTO workspace_plan
		(id, workspace_id, chat_message_ids, created_at, updated_at, version, status, description, proceed_at, buffered_tool_calls)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, null, $9)`
	_, err = tx.Exec(ctx, query, planID, workspaceID, chatMessageIDs, now, now, 1, workspacetypes.PlanStatusReview, description, bufferedToolCallsJSON)
	if err != nil {
		return "", fmt.Errorf("error creating plan: %w", err)
	}

	// Update chat message with plan ID
	query = `UPDATE workspace_chat SET response_plan_id = $1 WHERE id = $2`
	_, err = tx.Exec(ctx, query, planID, chatMessageID)
	if err != nil {
		return "", fmt.Errorf("error updating chat message response plan ID: %w", err)
	}

	// Insert action files
	if err := workspace.UpdatePlanActionFiles(ctx, tx, planID, actionFiles); err != nil {
		return "", fmt.Errorf("error creating action files: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("error committing transaction: %w", err)
	}

	return planID, nil
}

// publishPlanUpdate sends plan update events via Centrifugo
func publishPlanUpdate(ctx context.Context, workspaceID, planID string) {
	plan, err := workspace.GetPlan(ctx, nil, planID)
	if err != nil {
		logger.Errorf("Failed to get plan for update event: %v", err)
		return
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, workspaceID)
	if err != nil {
		logger.Errorf("Failed to get user IDs for plan update: %v", err)
		return
	}

	recipient := realtimetypes.Recipient{UserIDs: userIDs}
	event := &realtimetypes.PlanUpdatedEvent{
		WorkspaceID: workspaceID,
		Plan:        plan,
	}

	if err := realtime.SendEvent(ctx, recipient, event); err != nil {
		logger.Errorf("Failed to send plan update event: %v", err)
	}
}

// UpdateActionFileStatusRequest represents a request to update a single action file's status
type UpdateActionFileStatusRequest struct {
	WorkspaceID string `json:"workspaceId"`
	PlanID      string `json:"planId"`
	Path        string `json:"path"`
	Status      string `json:"status"` // "pending", "creating", "created"
}

// UpdateActionFileStatus updates a single action file's status and publishes the plan update
// POST /api/plan/update-action-file-status
func UpdateActionFileStatus(w http.ResponseWriter, r *http.Request) {
	var req UpdateActionFileStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(w, "Invalid request body")
		return
	}

	// Validate required fields
	if req.WorkspaceID == "" || req.PlanID == "" || req.Path == "" || req.Status == "" {
		writeBadRequest(w, "workspaceId, planId, path, and status are required")
		return
	}

	// Validate status value
	validStatuses := map[string]bool{"pending": true, "creating": true, "created": true}
	if !validStatuses[req.Status] {
		writeBadRequest(w, "status must be one of: pending, creating, created")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Update the action file status in DB
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		writeInternalError(w, "Failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Get current plan
	plan, err := workspace.GetPlan(ctx, tx, req.PlanID)
	if err != nil {
		writeInternalError(w, "Failed to get plan: "+err.Error())
		return
	}

	// Update the specific action file's status
	found := false
	for i, af := range plan.ActionFiles {
		if af.Path == req.Path {
			plan.ActionFiles[i].Status = req.Status
			found = true
			break
		}
	}

	if !found {
		writeBadRequest(w, "Action file not found: "+req.Path)
		return
	}

	// Save updated action files
	if err := workspace.UpdatePlanActionFiles(ctx, tx, plan.ID, plan.ActionFiles); err != nil {
		writeInternalError(w, "Failed to update action files: "+err.Error())
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeInternalError(w, "Failed to commit transaction: "+err.Error())
		return
	}

	// Publish plan update event
	publishPlanUpdate(ctx, req.WorkspaceID, req.PlanID)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
	})
}

// publishChatMessageUpdate sends chat message update events via Centrifugo
// This is used to notify the frontend when a message's responsePlanId is set
func publishChatMessageUpdate(ctx context.Context, workspaceID, chatMessageID string) {
	chatMessage, err := workspace.GetChatMessage(ctx, chatMessageID)
	if err != nil {
		logger.Errorf("Failed to get chat message for update event: %v", err)
		return
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, workspaceID)
	if err != nil {
		logger.Errorf("Failed to get user IDs for chat message update: %v", err)
		return
	}

	recipient := realtimetypes.Recipient{UserIDs: userIDs}
	event := &realtimetypes.ChatMessageUpdatedEvent{
		WorkspaceID: workspaceID,
		ChatMessage: chatMessage,
	}

	if err := realtime.SendEvent(ctx, recipient, event); err != nil {
		logger.Errorf("Failed to send chat message update event: %v", err)
	}
}

// PublishPlanUpdateRequest represents the request to publish a plan update event
type PublishPlanUpdateRequest struct {
	WorkspaceID string `json:"workspaceId"`
	PlanID      string `json:"planId"`
}

// PublishPlanUpdate is an HTTP endpoint that publishes a plan update event via Centrifugo.
// Called from TypeScript after plan status changes (e.g., after proceedPlanAction).
// POST /api/plan/publish-update
func PublishPlanUpdate(w http.ResponseWriter, r *http.Request) {
	var req PublishPlanUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(w, "Invalid request body")
		return
	}

	if req.WorkspaceID == "" || req.PlanID == "" {
		writeBadRequest(w, "workspaceId and planId are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	publishPlanUpdate(ctx, req.WorkspaceID, req.PlanID)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
	})
}

