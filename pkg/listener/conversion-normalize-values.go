package listener

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type conversionNormalizeValuesPayload struct {
	WorkspaceID  string `json:"workspaceId"`
	ConversionID string `json:"conversionId"`
}

func handleConversionNormalizeValuesNotification(ctx context.Context, payload string) error {
	logger.Info("Received conversion normalize values notification",
		zap.String("payload", payload),
	)

	var p conversionNormalizeValuesPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	c, err := workspace.GetConversion(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	normalizedValuesYAML, err := llm.CleanUpConvertedValuesYAML(ctx, c.ValuesYAML)
	if err != nil {
		return fmt.Errorf("failed to clean up converted values.yaml: %w", err)
	}

	if err := workspace.UpdateValuesYAMLForConversion(ctx, p.ConversionID, normalizedValuesYAML); err != nil {
		return fmt.Errorf("failed to update values.yaml for conversion: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, p.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("failed to list user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	if err := workspace.SetConversionStatus(ctx, p.ConversionID, workspacetypes.ConversionStatusSimplifying); err != nil {
		return fmt.Errorf("failed to update conversion status: %w", err)
	}

	c, err = workspace.GetConversion(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	e := realtimetypes.ConversionStatusEvent{
		WorkspaceID: w.ID,
		Conversion:  *c,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversion status event: %w", err)
	}

	if err := persistence.EnqueueWork(ctx, "conversion_simplify", map[string]interface{}{
		"workspaceId":  w.ID,
		"conversionId": p.ConversionID,
	}); err != nil {
		return fmt.Errorf("failed to enqueue file conversion: %w", err)
	}

	return nil
}
