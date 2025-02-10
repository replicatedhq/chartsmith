package workspace

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func GetRenderedChart(ctx context.Context, id string) (*types.RenderedChart, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT wrc.id, wrc.workspace_id, wrc.revision_number, wrc.chart_id, wrc.stdout, wrc.stderr, wrc.manifests, wrc.created_at, wrc.completed_at, c.name
	FROM workspace_rendered_chart wrc LEFT JOIN workspace_chart c ON wrc.chart_id = c.id WHERE wrc.id = $1`

	var renderedChart types.RenderedChart
	row := conn.QueryRow(ctx, query, id)

	var stdout sql.NullString
	var stderr sql.NullString
	var manifests sql.NullString

	var completedAt sql.NullTime

	if err := row.Scan(&renderedChart.ID, &renderedChart.WorkspaceID, &renderedChart.RevisionNumber, &renderedChart.ChartID, &stdout, &stderr, &manifests, &renderedChart.CreatedAt, &completedAt, &renderedChart.Name); err != nil {
		return nil, fmt.Errorf("failed to get rendered chart: %w", err)
	}

	renderedChart.Stdout = stdout.String
	renderedChart.Stderr = stderr.String
	renderedChart.Manifests = manifests.String
	renderedChart.CompletedAt = &completedAt.Time

	return &renderedChart, nil
}

func FinishRenderedChart(ctx context.Context, id string, stdout string, stderr string, manifests string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `
		UPDATE workspace_rendered_chart
		SET stdout = $2, stderr = $3, manifests = $4, completed_at = now()
		WHERE id = $1`

	_, err := conn.Exec(ctx, query, id, stdout, stderr, manifests)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart: %w", err)
	}

	return nil
}

func SetRenderedChartStdout(ctx context.Context, id string, stdout string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET stdout = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, stdout)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart stdout: %w", err)
	}

	return nil
}

func SetRenderedChartStderr(ctx context.Context, id string, stderr string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET stderr = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, stderr)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart stderr: %w", err)
	}

	return nil
}

func SetRenderedChartManifests(ctx context.Context, id string, manifests string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET manifests = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, manifests)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart manifests: %w", err)
	}

	return nil
}
