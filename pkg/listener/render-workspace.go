package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/replicatedhq/chartsmith/helm-utils"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type renderWorkspacePayload struct {
	ID string `json:"id"`
}

func handleRenderWorkspaceNotification(ctx context.Context, payload string) error {
	logger.Info("Received render workspace notification",
		zap.String("payload", payload),
	)

	var p renderWorkspacePayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal render workspace notification: %w", err)
	}

	renderedChart, err := workspace.GetRenderedChart(ctx, p.ID)
	if err != nil {
		return fmt.Errorf("failed to get rendered chart: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, renderedChart.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	var chart *workspacetypes.Chart
	for _, c := range w.Charts {
		if c.ID == renderedChart.ChartID {
			chart = &c
			break
		}
	}

	if chart == nil {
		return fmt.Errorf("chart not found")
	}

	// Get values.yaml content if it exists
	var valuesYAML string
	for _, file := range chart.Files {
		if file.FilePath == "values.yaml" {
			valuesYAML = file.Content
			break
		}
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("failed to list user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	e := realtimetypes.RenderUpdatedEvent{
		WorkspaceID:   w.ID,
		RenderedChart: *renderedChart,
	}

	stdoutCh := make(chan string, 1)
	stderrCh := make(chan string, 1)
	resultCh := make(chan string, 1)

	done := make(chan error)
	go func() {
		err := helmutils.RenderChartExec(chart.Files, valuesYAML, "", stdoutCh, stderrCh, resultCh)
		if err != nil {
			logger.Error(fmt.Errorf("failed to render chart: %w", err))
		}

		done <- nil
	}()

	for {
		select {
		case err := <-done:
			if err != nil {
				return fmt.Errorf("failed to render chart: %w", err)
			}

			now := time.Now()
			e.RenderedChart.CompletedAt = &now
			if err := workspace.FinishRenderedChart(ctx, p.ID, e.RenderedChart.Stdout, e.RenderedChart.Stderr, e.RenderedChart.Manifests); err != nil {
				return fmt.Errorf("failed to finish rendered chart: %w", err)
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render updated event: %w", err)
			}

			return nil
		case stdout := <-stdoutCh:
			e.RenderedChart.Stdout += stdout
			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render updated event: %w", err)
			}

			if err := workspace.SetRenderedChartStdout(ctx, p.ID, e.RenderedChart.Stdout); err != nil {
				return fmt.Errorf("failed to set rendered chart stdout: %w", err)
			}
		case stderr := <-stderrCh:
			e.RenderedChart.Stderr += stderr
			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render updated event: %w", err)
			}

			if err := workspace.SetRenderedChartStderr(ctx, p.ID, e.RenderedChart.Stderr); err != nil {
				return fmt.Errorf("failed to set rendered chart stderr: %w", err)
			}
		case result := <-resultCh:
			// we get these line by line, and we catch the final result
			// in the done handler
			// so here, we want to rate limit ourselves and only hit the database and socket
			// for every n lines

			e.RenderedChart.Manifests += result

			lineCount := strings.Count(e.RenderedChart.Manifests, "\n")
			if lineCount%12 == 0 {
				if err := workspace.SetRenderedChartManifests(ctx, p.ID, e.RenderedChart.Manifests); err != nil {
					return fmt.Errorf("failed to set rendered chart manifests: %w", err)
				}

				if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
					return fmt.Errorf("failed to send render updated event: %w", err)
				}
			}
		}
	}
}
