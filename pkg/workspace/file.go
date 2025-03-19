package workspace

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func GetFile(ctx context.Context, fileID string, revisionNumber int) (*types.File, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		id,
		revision_number,
		chart_id,
		workspace_id,
		file_path,
		content,
		content_pending
	FROM
		workspace_file
	WHERE
		id = $1 AND revision_number = $2`

	row := conn.QueryRow(ctx, query, fileID, revisionNumber)
	var file types.File
	var chartID sql.NullString

	// Use pgtype.Array which is designed to handle PostgreSQL arrays properly
	var contentPending sql.NullString

	err := row.Scan(&file.ID, &file.RevisionNumber, &chartID, &file.WorkspaceID, &file.FilePath, &file.Content, &contentPending)
	if err != nil {
		return nil, fmt.Errorf("error scanning file: %w", err)
	}

	if contentPending.Valid {
		file.ContentPending = &contentPending.String
	}

	file.ChartID = chartID.String
	return &file, nil
}

func SetFileEmbeddings(ctx context.Context, fileID string, revisionNumber int, embeddings string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_file SET embeddings = $1 WHERE id = $2 AND revision_number = $3`
	_, err := conn.Exec(ctx, query, embeddings, fileID, revisionNumber)
	if err != nil {
		return err
	}

	return nil
}

func ListFiles(ctx context.Context, workspaceID string, revisionNumber int, chartID string) ([]types.File, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, revision_number, chart_id, workspace_id, file_path, content, content_pending FROM workspace_file WHERE chart_id = $1 AND workspace_id = $2 AND revision_number = $3`
	rows, err := conn.Query(ctx, query, chartID, workspaceID, revisionNumber)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := []types.File{}
	for rows.Next() {
		var file types.File
		var chartID sql.NullString

		var contentPending sql.NullString

		err := rows.Scan(&file.ID, &file.RevisionNumber, &chartID, &file.WorkspaceID, &file.FilePath, &file.Content, &contentPending)
		if err != nil {
			return nil, fmt.Errorf("error scanning file row: %w", err)
		}

		if contentPending.Valid {
			file.ContentPending = &contentPending.String
		}

		file.ChartID = chartID.String
		files = append(files, file)
	}

	return files, nil
}
