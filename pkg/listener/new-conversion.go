package listener

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

type newConversionPayload struct {
	ConversionID string `json:"conversionId"`
}

func handleNewConversionNotification(ctx context.Context, payload string) error {
	logger.Info("Received new conversion notification",
		zap.String("payload", payload),
	)

	var p newConversionPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	c, err := workspace.GetConversation(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	newStatus := "first-pass"
	if err := workspace.SetConversationStatus(ctx, c.ID, newStatus); err != nil {
		return fmt.Errorf("failed to set conversation status: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, c.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to list user IDs for workspace: %w", err)
	}

	// send a test message
	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	e := realtimetypes.ConversationStatusEvent{
		WorkspaceID:  c.WorkspaceID,
		ConversionID: p.ConversionID,
		Status:       newStatus,
	}

	// our job is to find the files that need to be converted and queue each of them
	conversionFiles, err := workspace.ListFilesToConvert(ctx, c.ID)
	if err != nil {
		return fmt.Errorf("failed to list files to convert: %w", err)
	}

	for _, file := range conversionFiles {
		// TODO some preprossing that the file is a valid manifest

		if err := persistence.EnqueueWork(ctx, "conversion_file", map[string]interface{}{
			"workspaceId":  c.WorkspaceID,
			"conversionId": c.ID,
			"fileId":       file.ID,
		}); err != nil {
			return fmt.Errorf("failed to enqueue file conversion: %w", err)
		}
	}

	// Send the event that it's started
	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversation status event: %w", err)
	}

	return nil
}
