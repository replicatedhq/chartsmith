package workspace

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
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

// min function for file.go
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func SetFileContentPending(ctx context.Context, path string, revisionNumber int, chartID string, workspaceID string, contentPending string) error {
	// DEBUG-CONTENT-PENDING: Log inputs to SetFileContentPending
	fmt.Printf("DEBUG-CONTENT-PENDING: SetFileContentPending called: path=%s, rev=%d, chartID=%s, workspaceID=%s, content_len=%d, snippet=%s\n", 
		path, revisionNumber, chartID, workspaceID, len(contentPending), contentPending[:min(50, len(contentPending))])
	
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		fmt.Printf("DEBUG-CONTENT-PENDING: Error beginning transaction: %v\n", err)
		return fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// get the file id
	query := `SELECT id FROM workspace_file WHERE file_path = $1 AND revision_number = $2`
	row := tx.QueryRow(ctx, query, path, revisionNumber)
	var fileID string
	err = row.Scan(&fileID)
	if err != nil && err != pgx.ErrNoRows {
		fmt.Printf("DEBUG-CONTENT-PENDING: Error scanning file ID: %v\n", err)
		return fmt.Errorf("error scanning file id: %w", err)
	}

	// set the content pending
	if fileID != "" {
		fmt.Printf("DEBUG-CONTENT-PENDING: Updating existing file with ID=%s\n", fileID)
		query = `UPDATE workspace_file SET content_pending = $1 WHERE id = $2 AND revision_number = $3`
		result, err := tx.Exec(ctx, query, contentPending, fileID, revisionNumber)
		if err != nil {
			fmt.Printf("DEBUG-CONTENT-PENDING: Error updating content_pending: %v\n", err)
			return fmt.Errorf("error updating file content pending: %w", err)
		}
		
		rowsAffected := result.RowsAffected()
		fmt.Printf("DEBUG-CONTENT-PENDING: Update affected %d rows\n", rowsAffected)
	} else {
		fmt.Printf("DEBUG-CONTENT-PENDING: Creating new file since fileID is empty\n")
		id, err := securerandom.Hex(16)
		if err != nil {
			fmt.Printf("DEBUG-CONTENT-PENDING: Error generating file ID: %v\n", err)
			return fmt.Errorf("error generating file id: %w", err)
		}

		query = `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, content_pending) VALUES ($1, $2, $3, $4, $5, $6, $7)`
		result, err := tx.Exec(ctx, query, id, revisionNumber, chartID, workspaceID, path, "", contentPending)
		if err != nil {
			fmt.Printf("DEBUG-CONTENT-PENDING: Error inserting file: %v\n", err)
			return fmt.Errorf("error inserting file: %w", err)
		}
		
		rowsAffected := result.RowsAffected()
		fmt.Printf("DEBUG-CONTENT-PENDING: Insert affected %d rows\n", rowsAffected)
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Printf("DEBUG-CONTENT-PENDING: Error committing transaction: %v\n", err)
		return fmt.Errorf("error committing transaction: %w", err)
	}
	
	fmt.Printf("DEBUG-CONTENT-PENDING: Successfully committed transaction to update/insert content_pending\n")
	return nil
}
