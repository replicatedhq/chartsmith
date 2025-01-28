package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ChooseRelevantFilesForChatMessage(ctx context.Context, w *types.Workspace, chartID string, revisionNumber int, c *types.Chat) ([]types.File, error) {
	fmt.Printf("Choosing relevant files for workspace %s, chart %s, revision %d, chat message %s\n", w.ID, chartID, revisionNumber, c.Prompt)
	// Get embeddings for the prompt
	promptEmbeddings, err := embedding.Embeddings(c.Prompt)
	if err != nil {
		return nil, fmt.Errorf("error getting embeddings for prompt: %w", err)
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Query files with embeddings and calculate cosine similarity
	// Note: Using pgvector's <=> operator for cosine distance
	query := `
		WITH similarities AS (
			SELECT
				id,
				revision_number,
				chart_id,
				workspace_id,
				file_path,
				content,
				summary,
				embeddings,
				1 - (embeddings <=> $1) as similarity
			FROM workspace_file
			WHERE workspace_id = $2
			AND revision_number = $3
			AND embeddings IS NOT NULL
		)
		SELECT
			id,
			revision_number,
			chart_id,
			workspace_id,
			file_path,
			content,
			summary,
			similarity
		FROM similarities
		WHERE similarity > 0.7  -- Threshold for relevance
		ORDER BY similarity DESC
		LIMIT 10  -- Limit to most relevant files
	`

	rows, err := conn.Query(ctx, query, promptEmbeddings, w.ID, revisionNumber)
	if err != nil {
		return nil, fmt.Errorf("error querying relevant files: %w", err)
	}
	defer rows.Close()

	var files []types.File
	for rows.Next() {
		var file types.File
		var similarity float64
		var summary sql.NullString

		err := rows.Scan(
			&file.ID,
			&file.RevisionNumber,
			&file.ChartID,
			&file.WorkspaceID,
			&file.FilePath,
			&file.Content,
			&summary,
			&similarity,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning file: %w", err)
		}

		if summary.Valid {
			file.Summary = summary.String
		}

		// Always include Chart.yaml and values.yaml if they exist
		if filepath.Base(file.FilePath) == "Chart.yaml" ||
			filepath.Base(file.FilePath) == "values.yaml" {
			files = append(files, file)
			continue
		}

		// Add other relevant files based on similarity
		if similarity > 0.7 {
			files = append(files, file)
		}
	}

	// If no files were found relevant, at least return Chart.yaml and values.yaml
	if len(files) == 0 {
		baseFiles, err := getBaseChartFiles(ctx, conn, w.ID, chartID, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("error getting base chart files: %w", err)
		}
		files = append(files, baseFiles...)
	}

	return files, nil
}

func getBaseChartFiles(ctx context.Context, conn *pgxpool.Conn, workspaceID string, chartID string, revisionNumber int) ([]types.File, error) {
	query := `
		SELECT
			id,
			revision_number,
			chart_id,
			workspace_id,
			file_path,
			content,
			summary
		FROM workspace_file
		WHERE workspace_id = $1
		AND chart_id = $2
		AND revision_number = $3
		AND (file_path = 'Chart.yaml' OR file_path = 'values.yaml')
	`

	rows, err := conn.Query(ctx, query, workspaceID, chartID, revisionNumber)
	if err != nil {
		return nil, fmt.Errorf("error querying base files: %w", err)
	}
	defer rows.Close()

	var files []types.File
	for rows.Next() {
		var file types.File
		var summary sql.NullString

		err := rows.Scan(
			&file.ID,
			&file.RevisionNumber,
			&file.ChartID,
			&file.WorkspaceID,
			&file.FilePath,
			&file.Content,
			&summary,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning file: %w", err)
		}

		if summary.Valid {
			file.Summary = summary.String
		}

		files = append(files, file)
	}

	return files, nil
}
