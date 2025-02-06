package workspace

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func GetBootstrapWorkspace(ctx context.Context) (*types.BootstrapWorkspace, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		bootstrap_workspace.id,
		bootstrap_workspace.name,
		bootstrap_workspace.current_revision
	FROM
		bootstrap_workspace
	WHERE
		bootstrap_workspace.name = $1`

	row := conn.QueryRow(ctx, query, "default-workspace")
	var bootstrapWorkspace types.BootstrapWorkspace
	err := row.Scan(
		&bootstrapWorkspace.ID,
		&bootstrapWorkspace.Name,
		&bootstrapWorkspace.CurrentRevision,
	)

	if err != nil {
		return nil, fmt.Errorf("error scanning bootstrap workspace: %w", err)
	}

	charts, err := listChartsForBootstrapWorkspace(ctx, bootstrapWorkspace.ID, bootstrapWorkspace.CurrentRevision)
	if err != nil {
		return nil, fmt.Errorf("error listing charts for workspace: %w", err)
	}
	bootstrapWorkspace.Charts = charts

	// TODO bootstrap workspace files when we have them

	return &bootstrapWorkspace, nil
}

func listChartsForBootstrapWorkspace(ctx context.Context, bootstrapWorkspaceID string, revisionNumber int) ([]types.Chart, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		bootstrap_chart.id,
		bootstrap_chart.name
	FROM
		bootstrap_chart
	WHERE
		bootstrap_chart.workspace_id = $1`

	rows, err := conn.Query(ctx, query, bootstrapWorkspaceID)
	if err != nil {
		return nil, fmt.Errorf("error scanning bootstrap workspace charts: %w", err)
	}

	defer rows.Close()

	var charts []types.Chart
	for rows.Next() {
		var chart types.Chart
		err := rows.Scan(
			&chart.ID,
			&chart.Name,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning chart: %w", err)
		}
		charts = append(charts, chart)
	}
	rows.Close()

	// for each chart, get the files
	for i := range charts {
		files, err := listFilesForBootstrapChart(ctx, charts[i].ID, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("error listing files for bootstrap chart: %w", err)
		}
		charts[i].Files = files
	}

	return charts, nil
}

func listFilesForBootstrapChart(ctx context.Context, bootstrapChartID string, revisionNumber int) ([]types.File, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		id,
		chart_id,
		workspace_id,
		file_path,
		content
	FROM
		bootstrap_file
	WHERE
		bootstrap_file.chart_id = $1`

	rows, err := conn.Query(ctx, query, bootstrapChartID)
	if err != nil {
		return nil, fmt.Errorf("error scanning bootstrap chart files: %w", err)
	}

	defer rows.Close()

	var files []types.File
	for rows.Next() {
		var file types.File
		err := rows.Scan(
			&file.ID,
			&file.ChartID,
			&file.WorkspaceID,
			&file.FilePath,
			&file.Content,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning file: %w", err)
		}

		files = append(files, file)
	}
	rows.Close()

	return files, nil
}
