package workspace

import (
	"context"
	"fmt"

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
        workspace_revision.chat_message_id,
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
		&revision.ChatMessageID,
		&revision.CreatedByUserID,
		&revision.CreatedType,
		&revision.IsComplete,
	)
	if err != nil {
		return nil, err
	}

	return &revision, nil
}

func GetFilesForGVKs(ctx context.Context, workspaceID string, revisionNumber int, gvks []types.GVK) ([]types.File, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	ids := make([]string, len(gvks))
	for i, gvk := range gvks {
		ids[i] = gvk.ID
	}

	query := fmt.Sprintf(`
    SELECT f.file_path, f.content, f.name
    FROM workspace_gvk g
    JOIN workspace_file f ON
        f.workspace_id = g.workspace_id AND
        f.revision_number = g.revision_number AND
        f.file_path = g.file_path
    WHERE g.workspace_id = $1
    AND g.revision_number = $2
    AND g.id = ANY($3::text[])`)

	rows, err := conn.Query(ctx, query, workspaceID, revisionNumber, ids)
	if err != nil {
		return nil, fmt.Errorf("query error: %w", err)
	}
	defer rows.Close()

	files := make([]types.File, 0, len(gvks))
	for rows.Next() {
		var file types.File
		var gvkID string
		if err := rows.Scan(&file.Path, &file.Content, &file.Name); err != nil {
			return nil, fmt.Errorf("scan error: %w", err)
		}
		fmt.Printf("Found file for GVK %s: %s\n", gvkID, file.Path)
		files = append(files, file)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	fmt.Printf("Found %d files for %d GVKs\n", len(files), len(gvks))
	return files, nil
}

func gvkIDsFromGVKs(gvks []types.GVK) []string {
	ids := make([]string, len(gvks))
	for i, gvk := range gvks {
		ids[i] = gvk.ID
	}
	return ids
}
