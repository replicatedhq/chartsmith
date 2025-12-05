// Package handlers contains HTTP handlers for AI SDK tool execution endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

// publishArtifactUpdate sends a Centrifugo event to update file explorer in real-time
func publishArtifactUpdate(ctx context.Context, workspaceID string, revisionNumber int, chartID, fileID, filePath, content string, contentPending *string) {
	logger.Debug("Publishing artifact update",
		zap.String("workspaceID", workspaceID),
		zap.String("fileID", fileID),
		zap.String("filePath", filePath))

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, workspaceID)
	if err != nil {
		logger.Errorf("Failed to get user IDs for realtime workspaceID=%s: %v", workspaceID, err)
		return
	}

	logger.Debug("Got user IDs for realtime", zap.Strings("userIDs", userIDs))

	recipient := realtimetypes.Recipient{UserIDs: userIDs}
	event := &realtimetypes.ArtifactUpdatedEvent{
		WorkspaceID: workspaceID,
		WorkspaceFile: &workspacetypes.File{
			ID:             fileID,
			RevisionNumber: revisionNumber,
			ChartID:        chartID,
			WorkspaceID:    workspaceID,
			FilePath:       filePath,
			Content:        content,
			ContentPending: contentPending,
		},
	}

	if err := realtime.SendEvent(ctx, recipient, event); err != nil {
		logger.Errorf("Failed to send artifact update workspaceID=%s: %v", workspaceID, err)
	} else {
		logger.Debug("Successfully published artifact update", zap.String("filePath", filePath))
	}
}

// TextEditorRequest represents a request to the text editor endpoint
type TextEditorRequest struct {
	Command        string `json:"command"`               // view, create, str_replace
	WorkspaceID    string `json:"workspaceId"`
	Path           string `json:"path"`
	Content        string `json:"content,omitempty"`     // For create
	OldStr         string `json:"oldStr,omitempty"`      // For str_replace
	NewStr         string `json:"newStr,omitempty"`      // For str_replace
	RevisionNumber int    `json:"revisionNumber"`        // Required for file operations
}

// TextEditorResponse represents the response from the text editor endpoint
type TextEditorResponse struct {
	Success bool   `json:"success"`
	Content string `json:"content,omitempty"`
	Message string `json:"message,omitempty"`
}

// TextEditor handles file view/create/str_replace operations
// POST /api/tools/editor
func TextEditor(w http.ResponseWriter, r *http.Request) {
	var req TextEditorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Debug("Failed to decode text editor request", zap.Error(err))
		writeBadRequest(w, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Command == "" {
		writeBadRequest(w, "command is required")
		return
	}
	if req.WorkspaceID == "" {
		writeBadRequest(w, "workspaceId is required")
		return
	}
	if req.Path == "" {
		writeBadRequest(w, "path is required")
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	logger.Debug("Text editor request",
		zap.String("command", req.Command),
		zap.String("workspaceId", req.WorkspaceID),
		zap.String("path", req.Path),
		zap.Int("revisionNumber", req.RevisionNumber))

	switch req.Command {
	case "view":
		handleView(ctx, w, req)
	case "create":
		handleCreate(ctx, w, req)
	case "str_replace":
		handleStrReplace(ctx, w, req)
	default:
		writeBadRequest(w, "Invalid command. Supported: view, create, str_replace")
	}
}

// handleView handles the view command - returns file content
func handleView(ctx context.Context, w http.ResponseWriter, req TextEditorRequest) {
	// Get charts to find the file
	charts, err := workspace.ListCharts(ctx, req.WorkspaceID, req.RevisionNumber)
	if err != nil {
		logger.Debug("Failed to list charts", zap.Error(err))
		writeInternalError(w, "Failed to access workspace")
		return
	}

	// Find the file in charts
	for _, chart := range charts {
		for _, file := range chart.Files {
			if file.FilePath == req.Path {
				// Return file content (use pending content if available)
				content := file.Content
				if file.ContentPending != nil && *file.ContentPending != "" {
					content = *file.ContentPending
				}
				
				writeJSON(w, http.StatusOK, TextEditorResponse{
					Success: true,
					Content: content,
					Message: "File retrieved successfully",
				})
				return
			}
		}
	}

	// File not found
	writeJSON(w, http.StatusOK, TextEditorResponse{
		Success: false,
		Message: "Error: File does not exist. Use create instead.",
	})
}

// handleCreate handles the create command - creates a new file
func handleCreate(ctx context.Context, w http.ResponseWriter, req TextEditorRequest) {
	if req.Content == "" {
		writeBadRequest(w, "content is required for create command")
		return
	}

	// Get charts to check if file exists and get chart ID
	charts, err := workspace.ListCharts(ctx, req.WorkspaceID, req.RevisionNumber)
	if err != nil {
		logger.Debug("Failed to list charts", zap.Error(err))
		writeInternalError(w, "Failed to access workspace")
		return
	}

	// Check if file already exists
	var chartID string
	for _, chart := range charts {
		if chartID == "" {
			chartID = chart.ID // Use first chart if no specific chart
		}
		for _, file := range chart.Files {
			if file.FilePath == req.Path {
				writeJSON(w, http.StatusOK, TextEditorResponse{
					Success: false,
					Message: "Error: File already exists. Use view and str_replace instead.",
				})
				return
			}
		}
	}

	if chartID == "" {
		writeBadRequest(w, "No chart found in workspace")
		return
	}

	// Create the file with content in content_pending column for AI SDK path
	fileID, err := workspace.AddFileToChartPending(ctx, chartID, req.WorkspaceID, req.RevisionNumber, req.Path, req.Content)
	if err != nil {
		logger.Debug("Failed to create file", zap.Error(err))
		writeInternalError(w, "Failed to create file")
		return
	}

	// Publish realtime update for file explorer
	publishArtifactUpdate(ctx, req.WorkspaceID, req.RevisionNumber, chartID, fileID, req.Path, "", &req.Content)

	writeJSON(w, http.StatusOK, TextEditorResponse{
		Success: true,
		Content: req.Content,
		Message: "File created successfully",
	})
}

// handleStrReplace handles the str_replace command - replaces text in a file
func handleStrReplace(ctx context.Context, w http.ResponseWriter, req TextEditorRequest) {
	if req.OldStr == "" {
		writeBadRequest(w, "oldStr is required for str_replace command")
		return
	}

	// Get charts to find the file
	charts, err := workspace.ListCharts(ctx, req.WorkspaceID, req.RevisionNumber)
	if err != nil {
		logger.Debug("Failed to list charts", zap.Error(err))
		writeInternalError(w, "Failed to access workspace")
		return
	}

	// Find the file
	var foundFile *struct {
		chartID string
		content string
		path    string
	}
	
	for _, chart := range charts {
		for _, file := range chart.Files {
			if file.FilePath == req.Path {
				content := file.Content
				if file.ContentPending != nil && *file.ContentPending != "" {
					content = *file.ContentPending
				}
				foundFile = &struct {
					chartID string
					content string
					path    string
				}{
					chartID: chart.ID,
					content: content,
					path:    file.FilePath,
				}
				break
			}
		}
		if foundFile != nil {
			break
		}
	}

	if foundFile == nil {
		writeJSON(w, http.StatusOK, TextEditorResponse{
			Success: false,
			Message: "Error: File does not exist. Use create instead.",
		})
		return
	}

	// Perform string replacement using existing llm package function
	newContent, _, err := llm.PerformStringReplacement(foundFile.content, req.OldStr, req.NewStr)
	if err != nil {
		// Check if it's a "not found" error
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "Approximate match") {
			writeJSON(w, http.StatusOK, TextEditorResponse{
				Success: false,
				Message: "Error: String to replace not found in file.",
			})
			return
		}
		
		logger.Debug("String replacement failed", zap.Error(err))
		writeJSON(w, http.StatusOK, TextEditorResponse{
			Success: false,
			Message: "Error: String replacement failed - " + err.Error(),
		})
		return
	}

	// Update the file with new content
	err = workspace.SetFileContentPending(ctx, req.Path, req.RevisionNumber, foundFile.chartID, req.WorkspaceID, newContent)
	if err != nil {
		logger.Debug("Failed to update file", zap.Error(err))
		writeInternalError(w, "Failed to update file")
		return
	}

	// Publish realtime update for file explorer
	fileID, err := workspace.GetFileIDByPath(ctx, req.WorkspaceID, req.RevisionNumber, req.Path)
	if err != nil {
		logger.Errorf("Failed to get file ID for realtime: %v", err)
	} else {
		publishArtifactUpdate(ctx, req.WorkspaceID, req.RevisionNumber, foundFile.chartID, fileID, req.Path, foundFile.content, &newContent)
	}

	writeJSON(w, http.StatusOK, TextEditorResponse{
		Success: true,
		Content: newContent,
		Message: "String replaced successfully",
	})
}

