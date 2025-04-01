package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

// PublishWorkspacePayload represents the payload sent from the frontend
type PublishWorkspacePayload struct {
	WorkspaceID string `json:"workspaceId"`
	UserID      string `json:"userId"`
	Revision    string `json:"revision"`
}

// Chart represents the structure of Chart.yaml
type Chart struct {
	APIVersion  string `yaml:"apiVersion"`
	Name        string `yaml:"name"`
	Version     string `yaml:"version"`
	Description string `yaml:"description"`
}

// handlePublishWorkspaceNotification processes the publish_workspace queue item
func handlePublishWorkspaceNotification(ctx context.Context, payload string) error {
	var p PublishWorkspacePayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal publish workspace payload: %w", err)
	}

	logger.Info("Processing publish workspace request",
		zap.String("workspaceId", p.WorkspaceID),
		zap.String("userId", p.UserID),
		zap.String("revision", p.Revision))

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	w, err := workspace.GetWorkspace(ctx, p.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	charts, err := workspace.ListCharts(ctx, p.WorkspaceID, w.CurrentRevision)
	if err != nil {
		return fmt.Errorf("failed to list charts: %w", err)
	}

	if len(charts) == 0 {
		return fmt.Errorf("no charts found")
	}

	chart := charts[0]

	version, name, url, err := workspace.PublishChart(ctx, chart, p.WorkspaceID, w.CurrentRevision)
	if err != nil {
		return fmt.Errorf("failed to publish chart: %w", err)
	}

	logger.Info("Successfully published chart",
		zap.String("workspaceId", p.WorkspaceID),
		zap.String("chartName", name),
		zap.String("chartVersion", version),
		zap.String("repoUrl", url))

	return nil
}

// simulatePublishingDelay simulates the time it would take to publish a workspace
func simulatePublishingDelay(ctx context.Context) {
	// Simulate work being done for 1-3 seconds
	select {
	case <-time.After(time.Second * 2):
		return
	case <-ctx.Done():
		return
	}
}
