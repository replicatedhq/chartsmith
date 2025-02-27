package listener

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

type conversionSimplifyPayload struct {
	WorkspaceID  string `json:"workspaceId"`
	ConversionID string `json:"conversionId"`
}

func handleConversionSimplifyNotification(ctx context.Context, payload string) error {
	logger.Info("Received conversion simplify notification",
		zap.String("payload", payload))

	p := conversionSimplifyPayload{}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, p.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	// userIDs, err := workspace.ListUserIDsForWorkspace(ctx, p.WorkspaceID)
	// if err != nil {
	// 	return fmt.Errorf("failed to list user IDs for workspace: %w", err)
	// }

	c, err := workspace.GetConversion(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	// write to the workspace, this is skipping a step but
	// we can start to see the result
	convertedFiles, err := workspace.ListConvertedFiles(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to list files to convert: %w", err)
	}

	chart, err := workspace.CreateChart(ctx, w.ID, 1)
	if err != nil {
		return fmt.Errorf("failed to create chart: %w", err)
	}

	if err := workspace.AddFileToChart(ctx, chart.ID, w.ID, 1, "values.yaml", c.ValuesYAML); err != nil {
		return fmt.Errorf("failed to add file to chart: %w", err)
	}
	if err := workspace.AddFileToChart(ctx, chart.ID, w.ID, 1, "Chart.yaml", c.ChartYAML); err != nil {
		return fmt.Errorf("failed to add file to chart: %w", err)
	}

	for filePath, fileContent := range convertedFiles {
		if err := workspace.AddFileToChart(ctx, chart.ID, w.ID, 1, filePath, fileContent); err != nil {
			return fmt.Errorf("failed to add file to chart: %w", err)
		}
	}

	if err := workspace.NotifyWorkerToCaptureEmbeddings(ctx, w.ID, 1); err != nil {
		return fmt.Errorf("failed to notify worker to capture embeddings: %w", err)
	}

	// mark the revision as complete
	_, err = workspace.SetCurrentRevision(ctx, nil, w, 1)
	if err != nil {
		return fmt.Errorf("failed to set revision complete: %w", err)
	}

	return nil
}
