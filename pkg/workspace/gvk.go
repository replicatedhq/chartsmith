package workspace

import (
	"context"
	"database/sql"

	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type GVKWithRelevance struct {
	types.GVK
	Relevance float64
}

func FindRelevantGVKsForPrompt(ctx context.Context, id string, revision int, prompt string) ([]types.GVK, error) {
	promptEmbeddings, err := embedding.Embeddings(prompt)
	if err != nil {
		return nil, err
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `
SELECT
    id,
    workspace_id,
    gvk,
    revision_number,
    file_path,
    created_at,
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
        FROM workspace_gvk
        WHERE workspace_id = $2
        AND revision_number = $3
        ORDER BY relevance DESC
        LIMIT 5`

	rows, err := conn.Query(ctx, query, promptEmbeddings, id, revision)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var gvks []GVKWithRelevance
	for rows.Next() {
		var gvk GVKWithRelevance

		err := rows.Scan(
			&gvk.ID,
			&gvk.WorkspaceID,
			&gvk.GVK.GVK,
			&gvk.RevisionNumber,
			&gvk.FilePath,
			&gvk.CreatedAt,
			&gvk.Content,
			&gvk.Summary,
			&gvk.Relevance,
		)
		if err != nil {
			return nil, err
		}
		gvks = append(gvks, gvk)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// return the raw gvks
	if len(gvks) == 0 {
		return nil, nil
	}

	plainGVKs := make([]types.GVK, len(gvks))
	for i, gvk := range gvks {
		plainGVKs[i] = gvk.GVK
	}

	return plainGVKs, nil
}

func GetGVK(ctx context.Context, id string) (*types.GVK, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
        workspace_gvk.id,
        workspace_gvk.workspace_id,
        workspace_gvk.gvk,
        workspace_gvk.revision_number,
        workspace_gvk.file_path,
        workspace_gvk.created_at,
        workspace_gvk.content,
        workspace_gvk.summary
    FROM
        workspace_gvk
    WHERE
        workspace_gvk.id = $1`

	row := conn.QueryRow(ctx, query, id)
	var gvk types.GVK
	var summary sql.NullString

	err := row.Scan(
		&gvk.ID,
		&gvk.WorkspaceID,
		&gvk.GVK,
		&gvk.RevisionNumber,
		&gvk.FilePath,
		&gvk.CreatedAt,
		&gvk.Content,
		&summary,
	)
	if err != nil {
		return nil, err
	}

	gvk.Summary = &summary.String

	return &gvk, nil
}
