package workspace

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	helmutils "github.com/replicatedhq/chartsmith/helm-utils"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
	"gopkg.in/yaml.v2"
)

func CreateChart(ctx context.Context, workspaceID string, revisionNumber int) (*types.Chart, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// let's drop it into the workspace
	chartID, err := securerandom.Hex(12)
	if err != nil {
		return nil, fmt.Errorf("failed to generate random ID: %w", err)
	}

	query := `INSERT INTO workspace_chart (id, workspace_id, name, revision_number) VALUES ($1, $2, $3, $4)`
	_, err = conn.Exec(ctx, query, chartID, workspaceID, "converted-chart", revisionNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to insert chart: %w", err)
	}

	return &types.Chart{
		ID:    chartID,
		Name:  "converted-chart",
		Files: []types.File{},
	}, nil
}

func AddFileToChart(ctx context.Context, chartID string, workspaceID string, revisionNumber int, path string, content string) (string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	fileID, err := securerandom.Hex(12)
	if err != nil {
		return "", fmt.Errorf("failed to generate random ID: %w", err)
	}

	query := `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err = conn.Exec(ctx, query, fileID, revisionNumber, chartID, workspaceID, path, content)
	if err != nil {
		return "", fmt.Errorf("failed to insert file: %w", err)
	}

	return fileID, nil
}

func ListCharts(ctx context.Context, workspaceID string, revisionNumber int) ([]*types.Chart, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, name FROM workspace_chart WHERE workspace_id = $1 AND revision_number = $2`
	rows, err := conn.Query(ctx, query, workspaceID, revisionNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to list charts: %w", err)
	}
	defer rows.Close()

	charts := []*types.Chart{}
	for rows.Next() {
		var chart types.Chart
		err := rows.Scan(&chart.ID, &chart.Name)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chart: %w", err)
		}
		charts = append(charts, &chart)
	}

	rows.Close()

	for _, chart := range charts {
		query = `SELECT id, file_path, content FROM workspace_file WHERE chart_id = $1 AND workspace_id = $2 AND revision_number = $3`
		rows, err := conn.Query(ctx, query, chart.ID, workspaceID, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("failed to list files: %w", err)
		}
		defer rows.Close()

		files := []types.File{}
		for rows.Next() {
			var file types.File
			err := rows.Scan(&file.ID, &file.FilePath, &file.Content)
			if err != nil {
				return nil, fmt.Errorf("failed to scan file: %w", err)
			}
			files = append(files, file)
		}
		chart.Files = files
	}

	return charts, nil
}

func PublishChart(ctx context.Context, chart *types.Chart, workspaceID string, revisionNumber int) (string, string, string, error) {
	// Use the root ttl.sh URL since that's all that works reliably
	displayUrl := "ttl.sh"

	// parse the files, find the chart yaml and get the chart version from it
	chartVersion := "0.1.0" // Default version if not found
	for _, file := range chart.Files {
		// Check if this file is Chart.yaml (could be at root or nested like mychart/Chart.yaml)
		if filepath.Base(file.FilePath) == "Chart.yaml" {
			// parse the chart yaml
			var chartYaml map[interface{}]interface{}
			err := yaml.Unmarshal([]byte(file.Content), &chartYaml)
			if err != nil {
				return "", "", "", fmt.Errorf("failed to unmarshal chart yaml: %w", err)
			}
			if chartYaml["version"] != nil {
				chartVersion = chartYaml["version"].(string)
			}
			break // Found the Chart.yaml, no need to continue
		}
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Insert initial processing status
	query := `INSERT INTO workspace_publish
			(workspace_id, revision_number, chart_name, chart_version, status, created_at, processing_started_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (workspace_id, revision_number, chart_name, chart_version) DO UPDATE SET
			status = $5, processing_started_at = $7, error_message = NULL`
	_, err := conn.Exec(ctx, query,
		workspaceID, revisionNumber, chart.Name, chartVersion,
		"processing", time.Now(), time.Now())
	if err != nil {
		return "", "", "", fmt.Errorf("failed to insert initial publish status: %w", err)
	}

	// Publish the chart
	if err := helmutils.PublishChartExec(chart.Files, workspaceID, chart.Name); err != nil {
		// Update to failed status
		failQuery := `UPDATE workspace_publish SET status = $1, error_message = $2, completed_at = $3 
					WHERE workspace_id = $4 AND revision_number = $5 AND chart_name = $6 AND chart_version = $7`
		_, _ = conn.Exec(ctx, failQuery, "failed", err.Error(), time.Now(), workspaceID, revisionNumber, chart.Name, chartVersion)
		return "", "", "", fmt.Errorf("failed to publish chart: %w", err)
	}

	// Update processing status in database to completed
	completeQuery := `UPDATE workspace_publish SET status = $1, completed_at = $2 
					WHERE workspace_id = $3 AND revision_number = $4 AND chart_name = $5 AND chart_version = $6`
	_, err = conn.Exec(ctx, completeQuery,
		"completed", time.Now(),
		workspaceID, revisionNumber, chart.Name, chartVersion)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to update publish status to completed: %w", err)
	}
	return chartVersion, chart.Name, displayUrl, nil
}
