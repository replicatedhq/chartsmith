package workspace

import (
	"context"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func GetConversation(ctx context.Context, id string) (*types.Conversion, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, workspace_id, chat_message_ids, created_at, status FROM workspace_conversion WHERE id = $1`

	var c types.Conversion
	if err := conn.QueryRow(ctx, query, id).Scan(&c.ID, &c.WorkspaceID, &c.ChatMessageIDs, &c.CreatedAt, &c.Status); err != nil {
		return nil, err
	}

	return &c, nil
}

func SetConversationStatus(ctx context.Context, id string, status types.ConversionStatus) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion SET status = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, status, id); err != nil {
		return err
	}

	return nil
}

func ListFilesToConvert(ctx context.Context, id string) ([]types.ConversionFile, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, conversion_id, file_path, file_content, file_status FROM workspace_conversion_file WHERE conversion_id = $1`
	rows, err := conn.Query(ctx, query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []types.ConversionFile
	for rows.Next() {
		var file types.ConversionFile
		if err := rows.Scan(&file.ID, &file.ConversionID, &file.FilePath, &file.FileContent, &file.FileStatus); err != nil {
			return nil, err
		}
		files = append(files, file)
	}

	return files, nil
}

func GetConversionFile(ctx context.Context, conversionID string, fileID string) (*types.ConversionFile, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, conversion_id, file_path, file_content, file_status FROM workspace_conversion_file WHERE conversion_id = $1 AND id = $2`

	var file types.ConversionFile
	if err := conn.QueryRow(ctx, query, conversionID, fileID).Scan(&file.ID, &file.ConversionID, &file.FilePath, &file.FileContent, &file.FileStatus); err != nil {
		return nil, err
	}

	return &file, nil
}

func SetConversionFileStatus(ctx context.Context, id string, status types.ConversionFileStatus) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion_file SET file_status = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, status, id); err != nil {
		return err
	}

	return nil
}
