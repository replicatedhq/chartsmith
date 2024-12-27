package workspace

import (
	"context"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

func ListUserIDsForWorkspace(ctx context.Context, workspaceID string) ([]string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace.created_by_user_id
	FROM
		workspace
	WHERE
		workspace.id = $1`

	row := conn.QueryRow(ctx, query, workspaceID)
	var userID string

	err := row.Scan(
		&userID,
	)

	if err != nil {
		return nil, err
	}

	return []string{userID}, nil
}
