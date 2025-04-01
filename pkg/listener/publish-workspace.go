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
	RepoURL     string `json:"repoUrl"`
	Timestamp   string `json:"timestamp"`
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
		zap.String("repoUrl", p.RepoURL))

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Update the status to "processing"
	_, err := conn.Exec(ctx, `
		UPDATE workspace_publish
		SET status = $1, processing_started_at = NOW()
		WHERE workspace_id = $2 AND user_id = $3 AND repository_url = $4
	`, "processing", p.WorkspaceID, p.UserID, p.RepoURL)
	if err != nil {
		return fmt.Errorf("failed to update publish status to processing: %w", err)
	}

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

	version, name, url, err := workspace.PublishChart(ctx, chart.ID, p.WorkspaceID, w.CurrentRevision)
	if err != nil {
		return fmt.Errorf("failed to publish chart: %w", err)
	}

	// Store the chart details in the database for retrieval in the frontend
	_, err = conn.Exec(ctx, `
		UPDATE workspace_publish
		SET
			chart_version = $1,
			chart_name = $2,
			repository_url = $3
		WHERE workspace_id = $4 AND user_id = $5 AND repository_url = $6
	`, version, name, url, p.WorkspaceID, p.UserID, p.RepoURL)
	if err != nil {
		logger.Warn("Failed to update chart details in database",
			zap.String("workspaceId", p.WorkspaceID),
			zap.Error(err))
	}

	// Update the status to "completed"
	_, err = conn.Exec(ctx, `
		UPDATE workspace_publish
		SET
			status = $1,
			completed_at = NOW(),
			error_message = NULL
		WHERE workspace_id = $2 AND user_id = $3 AND repository_url = $4
	`, "completed", p.WorkspaceID, p.UserID, p.RepoURL)
	if err != nil {
		return fmt.Errorf("failed to update publish status to completed: %w", err)
	}

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
