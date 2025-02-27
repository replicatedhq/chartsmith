package workspace

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
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

func AddFileToChart(ctx context.Context, chartID string, workspaceID string, revisionNumber int, path string, content string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	fileID, err := securerandom.Hex(12)
	if err != nil {
		return fmt.Errorf("failed to generate random ID: %w", err)
	}

	query := `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err = conn.Exec(ctx, query, fileID, revisionNumber, chartID, workspaceID, path, content)
	if err != nil {
		return fmt.Errorf("failed to insert file: %w", err)
	}

	return nil
}
