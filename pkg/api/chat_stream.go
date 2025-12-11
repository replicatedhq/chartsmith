package api

import (
	"encoding/json"
	"net/http"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

// HandleChatStream handles POST requests to /api/v1/chat/stream.
// It accepts AI SDK format messages and streams responses using the AI SDK Data Stream Protocol.
func HandleChatStream(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Only accept POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req ChatStreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error(err, zap.String("message", "Failed to parse chat request"))
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if len(req.Messages) == 0 {
		http.Error(w, "Messages array is required", http.StatusBadRequest)
		return
	}
	if req.WorkspaceID == "" {
		http.Error(w, "workspaceId is required", http.StatusBadRequest)
		return
	}
	if req.UserID == "" {
		http.Error(w, "userId is required", http.StatusBadRequest)
		return
	}

	// Verify user has access to workspace first (before checking if it exists)
	// This prevents leaking information about workspace existence
	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, req.WorkspaceID)
	if err != nil {
		// Don't distinguish between "workspace doesn't exist" and "access check failed"
		// to prevent information leakage
		logger.Error(err, zap.String("message", "Failed to check workspace access"))
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	hasAccess := false
	for _, id := range userIDs {
		if id == req.UserID {
			hasAccess = true
			break
		}
	}

	if !hasAccess {
		// Use same error message whether workspace exists or not
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Get workspace (only after access is verified)
	ws, err := workspace.GetWorkspace(ctx, req.WorkspaceID)
	if err != nil {
		logger.Error(err, zap.String("message", "Failed to get workspace"), zap.String("workspaceId", req.WorkspaceID))
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Convert AI SDK messages to chat history
	history, err := convertAISDKMessagesToChatHistory(req.Messages)
	if err != nil {
		logger.Error(err, zap.String("message", "Failed to convert messages"))
		http.Error(w, "Invalid message format", http.StatusBadRequest)
		return
	}

	// Extract prompt from last user message
	var prompt string
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			prompt = req.Messages[i].Content
			break
		}
	}

	if prompt == "" {
		http.Error(w, "No user message found", http.StatusBadRequest)
		return
	}

	// Create AI SDK stream writer
	streamWriter, err := llm.NewAISDKStreamWriter(w)
	if err != nil {
		logger.Error(err, zap.String("message", "Failed to create stream writer"))
		http.Error(w, "Failed to initialize stream", http.StatusInternalServerError)
		return
	}

	// Stream chat response
	if err := llm.StreamConversationalChatAISDK(ctx, streamWriter, ws, history, prompt); err != nil {
		logger.Error(err, zap.String("message", "Failed to stream chat"))
		// Try to write error to stream if possible
		_ = streamWriter.WriteError(err)
		return
	}
}

// convertAISDKMessagesToChatHistory converts AI SDK format messages to workspace Chat history.
// It pairs user and assistant messages together.
func convertAISDKMessagesToChatHistory(messages []AISDKMessage) ([]workspacetypes.Chat, error) {
	var history []workspacetypes.Chat
	var currentChat *workspacetypes.Chat

	for _, msg := range messages {
		if msg.Role == "user" {
			// Start a new chat pair
			if currentChat != nil {
				history = append(history, *currentChat)
			}
			currentChat = &workspacetypes.Chat{
				Prompt: msg.Content,
			}
		} else if msg.Role == "assistant" && currentChat != nil {
			// Add response to current chat pair
			currentChat.Response = msg.Content
		}
		// Ignore system messages and tool calls for history
	}

	// Add the last chat if it exists
	if currentChat != nil {
		history = append(history, *currentChat)
	}

	return history, nil
}
