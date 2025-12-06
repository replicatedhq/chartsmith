// Package handlers contains HTTP handlers for AI SDK tool execution endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
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

// ConversionFile represents a K8s manifest file to convert
type ConversionFile struct {
	FilePath    string `json:"filePath"`
	FileContent string `json:"fileContent"`
}

// StartConversionRequest represents a request to start K8s to Helm conversion
type StartConversionRequest struct {
	WorkspaceID   string           `json:"workspaceId"`
	ChatMessageID string           `json:"chatMessageId"`
	SourceFiles   []ConversionFile `json:"sourceFiles"`
}

// StartConversionResponse represents the response from starting a conversion
type StartConversionResponse struct {
	ConversionID string `json:"conversionId"`
}

// StartConversion handles starting a K8s to Helm conversion
// POST /api/conversion/start
func StartConversion(w http.ResponseWriter, r *http.Request) {
	var req StartConversionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Debug("Failed to decode start conversion request", zap.Error(err))
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
	if len(req.SourceFiles) == 0 {
		writeBadRequest(w, "sourceFiles array is required and must not be empty")
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	logger.Debug("StartConversion request",
		zap.String("workspaceId", req.WorkspaceID),
		zap.String("chatMessageId", req.ChatMessageID),
		zap.Int("fileCount", len(req.SourceFiles)))

	// Create the conversion record
	conversionID, err := createConversion(ctx, req.WorkspaceID, req.ChatMessageID, req.SourceFiles)
	if err != nil {
		logger.Errorf("Failed to create conversion: %v", err)
		writeInternalError(w, "Failed to create conversion: "+err.Error())
		return
	}

	// Enqueue conversion work
	err = persistence.EnqueueWork(ctx, "new_conversion", map[string]interface{}{
		"conversionId": conversionID,
	})
	if err != nil {
		logger.Errorf("Failed to enqueue conversion work: %v", err)
		writeInternalError(w, "Failed to enqueue conversion: "+err.Error())
		return
	}

	// Publish initial conversion event
	publishConversionUpdate(ctx, req.WorkspaceID, conversionID)

	writeJSON(w, http.StatusOK, StartConversionResponse{
		ConversionID: conversionID,
	})
}

// createConversion creates a conversion record and its associated files
func createConversion(ctx context.Context, workspaceID, chatMessageID string, sourceFiles []ConversionFile) (string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	// Generate conversion ID
	conversionID, err := securerandom.Hex(6)
	if err != nil {
		return "", err
	}

	chatMessageIDs := []string{chatMessageID}
	now := time.Now()

	// Create conversion record
	query := `INSERT INTO workspace_conversion 
		(id, workspace_id, chat_message_ids, created_at, status)
		VALUES ($1, $2, $3, $4, $5)`
	_, err = tx.Exec(ctx, query, conversionID, workspaceID, chatMessageIDs, now, workspacetypes.ConversionStatusPending)
	if err != nil {
		return "", err
	}

	// Update chat message with conversion ID
	query = `UPDATE workspace_chat SET response_conversion_id = $1 WHERE id = $2`
	_, err = tx.Exec(ctx, query, conversionID, chatMessageID)
	if err != nil {
		return "", err
	}

	// Create conversion file records
	for _, file := range sourceFiles {
		fileID, err := securerandom.Hex(6)
		if err != nil {
			return "", err
		}

		query = `INSERT INTO workspace_conversion_file 
			(id, conversion_id, file_path, file_content, file_status)
			VALUES ($1, $2, $3, $4, $5)`
		_, err = tx.Exec(ctx, query, fileID, conversionID, file.FilePath, file.FileContent, workspacetypes.ConversionFileStatusPending)
		if err != nil {
			return "", err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}

	return conversionID, nil
}

// publishConversionUpdate sends conversion update events via Centrifugo
func publishConversionUpdate(ctx context.Context, workspaceID, conversionID string) {
	conversion, err := workspace.GetConversion(ctx, conversionID)
	if err != nil {
		logger.Errorf("Failed to get conversion for update event: %v", err)
		return
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, workspaceID)
	if err != nil {
		logger.Errorf("Failed to get user IDs for conversion update: %v", err)
		return
	}

	recipient := realtimetypes.Recipient{UserIDs: userIDs}
	event := realtimetypes.ConversionStatusEvent{
		WorkspaceID: workspaceID,
		Conversion:  *conversion,
	}

	if err := realtime.SendEvent(ctx, recipient, event); err != nil {
		logger.Errorf("Failed to send conversion update event: %v", err)
	}
}

