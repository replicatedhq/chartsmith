package workspace

import (
	"context"
	"database/sql"

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
		summary
	FROM
		workspace_file
	WHERE
		id = $1 AND revision_number = $2`

	row := conn.QueryRow(ctx, query, fileID, revisionNumber)
	var file types.File
	var summary sql.NullString
	err := row.Scan(&file.ID, &file.RevisionNumber, &file.ChartID, &file.WorkspaceID, &file.FilePath, &file.Content, &summary)
	if err != nil {
		return nil, err
	}
	file.Summary = summary.String

	return &file, nil
}

func SetFileSummaryAndEmbeddings(ctx context.Context, fileID string, revisionNumber int, summary string, embeddings string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_file SET summary = $1, embeddings = $2 WHERE id = $3 AND revision_number = $4`
	_, err := conn.Exec(ctx, query, summary, embeddings, fileID, revisionNumber)
	if err != nil {
		return err
	}

	return nil
}
