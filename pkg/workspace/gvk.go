package workspace

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func FindRelevantFilesForPrompt(ctx context.Context, workspaceID string, chartID string, revision int, prompt string) ([]types.File, error) {
	fmt.Printf("Finding relevant files for workspace id: %s, chart id: %s, revision: %d, prompt: %s\n", workspaceID, chartID, revision, prompt)
	promptEmbeddings, err := embedding.Embeddings(prompt)
	if err != nil {
		return nil, err
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `
SELECT
    id,
    revision_number,
	chart_id,
	workspace_id,
    file_path,
    content,
    summary,
    (
        0.6 * (1 - (embeddings <=> $1)) +
        0.2 * CASE
            WHEN file_path LIKE '%values.yaml' THEN 1
            WHEN file_path LIKE '%_helpers.tpl' THEN 1
            WHEN file_path LIKE '%Chart.yaml' THEN 1
            ELSE 0.5
        END +
        0.2 * CASE
            WHEN summary IS NOT NULL THEN 1 - (embeddings <=> $1)
            ELSE 0
        END
    ) as relevance
        FROM workspace_file
        WHERE workspace_id = $2
		AND chart_id = $3
        AND revision_number = $4
        ORDER BY relevance DESC
        LIMIT 5`

	rows, err := conn.Query(ctx, query, promptEmbeddings, workspaceID, chartID, revision)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return nil, nil
}
