package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"time"

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

// GetFileIDByPath retrieves a file's ID by its path, workspace, and revision
func GetFileIDByPath(ctx context.Context, workspaceID string, revisionNumber int, filePath string) (string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	var fileID string
	err := conn.QueryRow(ctx,
		`SELECT id FROM workspace_file WHERE workspace_id = $1 AND revision_number = $2 AND file_path = $3`,
		workspaceID, revisionNumber, filePath,
	).Scan(&fileID)
	if err != nil {
		return "", fmt.Errorf("failed to get file ID: %w", err)
	}
	return fileID, nil
}

func SetFileContentPending(ctx context.Context, path string, revisionNumber int, chartID string, workspaceID string, contentPending string) error {
	// Create dedicated database context with timeout
	dbCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Get a fresh connection for this operation
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(dbCtx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(dbCtx)

	// get the file id - only filter by path and revision for maximum compatibility with different chart structures
	query := `SELECT id FROM workspace_file WHERE file_path = $1 AND revision_number = $2 AND workspace_id = $3`
	row := tx.QueryRow(dbCtx, query, path, revisionNumber, workspaceID)
	var fileID string
	err = row.Scan(&fileID)

	// More specific error handling
	if err != nil {
		if err == pgx.ErrNoRows {
			// Continue with file creation below
		} else {
			return fmt.Errorf("error scanning file id: %w", err)
		}
	}

	// set the content pending
	if fileID != "" {
		// Update existing file
		query = `UPDATE workspace_file SET content_pending = $1 WHERE id = $2 AND revision_number = $3`
		_, err := tx.Exec(dbCtx, query, contentPending, fileID, revisionNumber)
		if err != nil {
			return fmt.Errorf("error updating file content pending: %w", err)
		}
	} else {
		// Create new file
		id, err := securerandom.Hex(16)
		if err != nil {
			return fmt.Errorf("error generating file id: %w", err)
		}

		query = `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, content_pending) VALUES ($1, $2, $3, $4, $5, $6, $7)`
		_, err = tx.Exec(dbCtx, query, id, revisionNumber, chartID, workspaceID, path, "", contentPending)
		if err != nil {
			return fmt.Errorf("error inserting file: %w", err)
		}
	}

	// Try to commit the transaction
	if err := tx.Commit(dbCtx); err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	return nil
}
