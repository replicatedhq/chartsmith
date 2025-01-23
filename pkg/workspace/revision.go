package workspace

import (
	"context"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func GetRevision(ctx context.Context, workspaceID string, revisionNumber int) (*types.Revision, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
        workspace_revision.workspace_id,
        workspace_revision.revision_number,
        workspace_revision.created_at,
        workspace_revision.created_by_user_id,
        workspace_revision.created_type,
        workspace_revision.is_complete
    FROM
        workspace_revision
    WHERE
        workspace_revision.workspace_id = $1 AND workspace_revision.revision_number = $2`

	row := conn.QueryRow(ctx, query, workspaceID, revisionNumber)
	var revision types.Revision
	err := row.Scan(
		&revision.WorkspaceID,
		&revision.RevisionNumber,
		&revision.CreatedAt,
		&revision.CreatedByUserID,
		&revision.CreatedType,
		&revision.IsComplete,
	)
	if err != nil {
		return nil, err
	}

	return &revision, nil
}
