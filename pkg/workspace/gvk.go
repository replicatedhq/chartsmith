package workspace

import (
	"context"
	"database/sql"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

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
        workspace_gvk.summary,
        CASE
            WHEN workspace_gvk.embeddings IS NULL THEN NULL
            ELSE array[workspace_gvk.embeddings]
        END as embeddings
    FROM
        workspace_gvk
    WHERE
        workspace_gvk.id = $1`

	row := conn.QueryRow(ctx, query, id)
	var gvk types.GVK
	var summary sql.NullString
	var embeddings []sql.NullFloat64

	err := row.Scan(
		&gvk.ID,
		&gvk.WorkspaceID,
		&gvk.GVK,
		&gvk.RevisionNumber,
		&gvk.FilePath,
		&gvk.CreatedAt,
		&gvk.Content,
		&summary,
		&embeddings,
	)
	if err != nil {
		return nil, err
	}

	gvk.Summary = &summary.String

	// Convert NullFloat64 array to float64 array, skipping NULL values
	if embeddings != nil {
		floats := make([]float64, 0, len(embeddings))
		for _, e := range embeddings {
			if e.Valid {
				floats = append(floats, e.Float64)
			}
		}
		gvk.Embeddings = floats
	}

	return &gvk, nil
}
