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

type conversionNextFilePayload struct {
	WorkspaceID  string `json:"workspaceId"`
	ConversionID string `json:"conversionId"`
}

func handleConversionNextFileNotification(ctx context.Context, payload string) error {
	logger.Info("Received conversion file notification",
		zap.String("payload", payload))

	p := conversionNextFilePayload{}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, p.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	c, err := workspace.GetConversion(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	// get all files, sort and pick the next one to conver
	conversionFiles, err := workspace.ListFilesToConvert(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to list files to convert: %w", err)
	}
	sortedConversionFiles := sortByConversionOrder(conversionFiles)

	if len(sortedConversionFiles) == 0 {
		return nil
	}

	cf := &sortedConversionFiles[0]

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("failed to list user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	if err := workspace.SetConversionFileStatus(ctx, cf.ID, workspacetypes.ConversionFileStatusConverting); err != nil {
		return fmt.Errorf("failed to set conversion file status: %w", err)
	}

	cf, err = workspace.GetConversionFile(ctx, p.ConversionID, cf.ID)
	if err != nil {
		return fmt.Errorf("failed to get conversion file: %w", err)
	}

	e := realtimetypes.ConversionFileStatusEvent{
		WorkspaceID:    w.ID,
		ConversionID:   p.ConversionID,
		ConversionFile: cf,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversion file status event: %w", err)
	}

	convertedFiles, updatedValuesYAML, err := llm.ConvertFile(ctx, llm.ConvertFileOpts{
		Path:       cf.FilePath,
		Content:    cf.FileContent,
		ValuesYAML: c.ValuesYAML,
	})
	if err != nil {
		logger.Error(fmt.Errorf("failed to convert file: %w", err))
	}

	if err := workspace.SetConversionFileStatus(ctx, cf.ID, workspacetypes.ConversionFileStatusConverted); err != nil {
		return fmt.Errorf("failed to set conversion file status: %w", err)
	}

	if err := workspace.UpdateValuesYAMLForConversion(ctx, p.ConversionID, updatedValuesYAML); err != nil {
		return fmt.Errorf("failed to update values.yaml for conversion: %w", err)
	}

	if err := workspace.UpdateConvertedContentForFileConversion(ctx, cf.ID, convertedFiles); err != nil {
		return fmt.Errorf("failed to update converted content for file conversion: %w", err)
	}

	cf, err = workspace.GetConversionFile(ctx, p.ConversionID, cf.ID)
	if err != nil {
		return fmt.Errorf("failed to get conversion file: %w", err)
	}

	e = realtimetypes.ConversionFileStatusEvent{
		WorkspaceID:    w.ID,
		ConversionID:   p.ConversionID,
		ConversionFile: cf,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversion file status event: %w", err)
	}

	// and check if there are more files to convert, add back to the queue if so
	if len(sortedConversionFiles) > 1 {
		if err := persistence.EnqueueWork(ctx, "conversion_next_file", map[string]interface{}{
			"workspaceId":  w.ID,
			"conversionId": p.ConversionID,
		}); err != nil {
			return fmt.Errorf("failed to enqueue file conversion: %w", err)
		}
	} else {
		// advance the conversion step and queue the next job
		if err := workspace.SetConversionStatus(ctx, p.ConversionID, workspacetypes.ConversionStatusNormalizing); err != nil {
			return fmt.Errorf("failed to set conversion status: %w", err)
		}

		c, err := workspace.GetConversion(ctx, p.ConversionID)
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

		if err := persistence.EnqueueWork(ctx, "conversion_normalize_values", map[string]interface{}{
			"workspaceId":  w.ID,
			"conversionId": p.ConversionID,
		}); err != nil {
			return fmt.Errorf("failed to enqueue file conversion: %w", err)
		}
	}

	return nil
}
