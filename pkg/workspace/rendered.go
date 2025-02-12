package workspace

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
)

func GetRenderedChart(ctx context.Context, id string) (*types.RenderedChart, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `
		SELECT
			wrc.id,
			wrc.workspace_id,
			wrc.revision_number,
			wrc.chart_id,
			wrc.is_success,
			wrc.dep_update_command,
			wrc.dep_update_stdout,
			wrc.dep_update_stderr,
			wrc.helm_template_command,
			wrc.helm_template_stdout,
			wrc.helm_template_stderr,
			wrc.created_at,
			wrc.completed_at,
			c.name
		FROM workspace_rendered_chart wrc
		LEFT JOIN workspace_chart c ON wrc.chart_id = c.id
		WHERE wrc.id = $1`

	var renderedChart types.RenderedChart
	row := conn.QueryRow(ctx, query, id)

	var depUpdateCommand sql.NullString
	var depUpdateStdout sql.NullString
	var depUpdateStderr sql.NullString
	var helmTemplateCommand sql.NullString
	var helmTemplateStdout sql.NullString
	var helmTemplateStderr sql.NullString

	var completedAt sql.NullTime

	if err := row.Scan(&renderedChart.ID, &renderedChart.WorkspaceID, &renderedChart.RevisionNumber, &renderedChart.ChartID, &renderedChart.IsSuccess, &depUpdateCommand, &depUpdateStdout, &depUpdateStderr, &helmTemplateCommand, &helmTemplateStdout, &helmTemplateStderr, &renderedChart.CreatedAt, &completedAt, &renderedChart.Name); err != nil {
		return nil, fmt.Errorf("failed to get rendered chart: %w", err)
	}

	renderedChart.DepupdateCommand = depUpdateCommand.String
	renderedChart.DepupdateStdout = depUpdateStdout.String
	renderedChart.DepupdateStderr = depUpdateStderr.String
	renderedChart.HelmTemplateCommand = helmTemplateCommand.String
	renderedChart.HelmTemplateStdout = helmTemplateStdout.String
	renderedChart.HelmTemplateStderr = helmTemplateStderr.String
	renderedChart.CompletedAt = &completedAt.Time

	return &renderedChart, nil
}

func FinishRenderedChart(ctx context.Context, id string, depupdateCommand string, depupdateStdout string, depupdateStderr string, helmTemplateCommand string, helmTemplateStdout string, helmTemplateStderr string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `
		UPDATE workspace_rendered_chart
		SET dep_update_command = $2, dep_update_stdout = $3, dep_update_stderr = $4, helm_template_command = $5, helm_template_stdout = $6, helm_template_stderr = $7, completed_at = now()
		WHERE id = $1`

	_, err := conn.Exec(ctx, query, id, depupdateCommand, depupdateStdout, depupdateStderr, helmTemplateCommand, helmTemplateStdout, helmTemplateStderr)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart: %w", err)
	}

	return nil
}

func SetRenderedChartDepUpdateCommand(ctx context.Context, id string, depUpdateCommand string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET dep_update_command = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, depUpdateCommand)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart depUpdateCommand: %w", err)
	}

	return nil
}

func SetRenderedChartDepUpdateStdout(ctx context.Context, id string, depUpdateStdout string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET dep_update_stdout = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, depUpdateStdout)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart depUpdateStdout: %w", err)
	}

	return nil
}

func SetRenderedChartDepUpdateStderr(ctx context.Context, id string, depUpdateStderr string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET dep_update_stderr = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, depUpdateStderr)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart depUpdateStderr: %w", err)
	}

	return nil
}

func SetRenderedChartHelmTemplateCommand(ctx context.Context, id string, helmTemplateCommand string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET helm_template_command = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, helmTemplateCommand)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart helmTemplateCommand: %w", err)
	}

	return nil
}

func SetRenderedChartHelmTemplateStdout(ctx context.Context, id string, helmTemplateStdout string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET helm_template_stdout = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, helmTemplateStdout)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart helmTemplateStdout: %w", err)
	}

	return nil
}

func SetRenderedFileContents(ctx context.Context, workspaceID string, revisionNumber int, filePath string, renderedContent string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// get the file id from the workspace_file table
	query := `SELECT id FROM workspace_file WHERE workspace_id = $1 AND revision_number = $2 AND file_path = $3`
	var fileID string
	err := conn.QueryRow(ctx, query, workspaceID, revisionNumber, filePath).Scan(&fileID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil // this happend if we have a rendered file that doesn't exist in the workspace (deps)_
		}
		return fmt.Errorf("failed to get file id: %w", err)
	}

	query = `INSERT INTO workspace_rendered_file (file_id, workspace_id, revision_number, file_path, content) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (file_id, workspace_id, revision_number) DO UPDATE SET content = $5`
	_, err = conn.Exec(ctx, query, fileID, workspaceID, revisionNumber, filePath, renderedContent)
	if err != nil {
		return fmt.Errorf("failed to insert rendered file: %w", err)
	}

	return nil
}

func SetRenderedChartHelmTemplateStderr(ctx context.Context, id string, helmTemplateStderr string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET helm_template_stderr = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, helmTemplateStderr)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart helmTemplateStderr: %w", err)
	}

	return nil
}

func EnqueueRenderWorkspace(ctx context.Context, workspaceID string) error {
	w, err := GetWorkspace(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	id, err := securerandom.Hex(6)
	if err != nil {
		return fmt.Errorf("failed to generate id: %w", err)
	}

	query := `INSERT INTO workspace_rendered_chart (id, workspace_id, revision_number, chart_id, is_success, created_at) VALUES ($1, $2, $3, $4, $5, now())`
	_, err = conn.Exec(ctx, query, id, workspaceID, w.CurrentRevision, w.Charts[0].ID, false)
	if err != nil {
		return fmt.Errorf("failed to enqueue render workspace: %w", err)
	}

	if err := persistence.EnqueueWork(ctx, "render_workspace", map[string]interface{}{
		"id": id,
	}); err != nil {
		return fmt.Errorf("failed to enqueue render workspace: %w", err)
	}

	return nil
}
