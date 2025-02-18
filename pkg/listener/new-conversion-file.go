package listener

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

type newConversionFilePayload struct {
	WorkspaceID  string `json:"workspaceId"`
	ConversionID string `json:"conversionId"`
	FileID       string `json:"fileId"`
}

func handleConversionFileNotification(ctx context.Context, payload string) error {
	logger.Info("Received conversion file notification", zap.String("payload", payload))

	p := newConversionFilePayload{}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, p.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	cf, err := workspace.GetConversionFile(ctx, p.ConversionID, p.FileID)
	if err != nil {
		return fmt.Errorf("failed to get conversion file: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("failed to list user IDs for workspace: %w", err)
	}

	// send a test message
	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	e := realtimetypes.ConversionFileStatusEvent{
		WorkspaceID:  w.ID,
		ConversionID: p.ConversionID,
		FilePath:     cf.FilePath,
		Status:       "pending",
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversion file status event: %w", err)
	}

	return nil
}
