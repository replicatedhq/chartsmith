package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
	"go.uber.org/zap"
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
		pending_patches
	FROM
		workspace_file
	WHERE
		id = $1 AND revision_number = $2`

	row := conn.QueryRow(ctx, query, fileID, revisionNumber)
	var file types.File
	var chartID sql.NullString

	// Use pgtype.Array which is designed to handle PostgreSQL arrays properly
	var pendingPatches pgtype.Array[string]

	err := row.Scan(&file.ID, &file.RevisionNumber, &chartID, &file.WorkspaceID, &file.FilePath, &file.Content, &pendingPatches)
	if err != nil {
		return nil, fmt.Errorf("error scanning file: %w", err)
	}

	// Only set the PendingPatches if the array is not null
	if pendingPatches.Valid {
		file.PendingPatches = pendingPatches.Elements
	} else {
		// Initialize an empty slice if pending_patches is NULL
		file.PendingPatches = []string{}
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

func AddPendingPatch(ctx context.Context, workspaceID string, revisionNumber int, chartID string, filePath string, pendingPatch string) (*types.File, error) {
	if strings.TrimSpace(pendingPatch) == "" {
		return nil, nil
	}

	logger.Debug("Adding pending patch",
		zap.String("workspaceID", workspaceID),
		zap.Int("revisionNumber", revisionNumber),
		zap.String("chartID", chartID),
		zap.String("filePath", filePath),
		zap.String("pendingPatch", pendingPatch),
	)
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, pending_patches FROM workspace_file WHERE chart_id = $1 AND file_path = $2 AND workspace_id = $3 AND revision_number = $4`
	row := conn.QueryRow(ctx, query, chartID, filePath, workspaceID, revisionNumber)
	var fileID string
	var existingPatches pgtype.Array[string]
	err := row.Scan(&fileID, &existingPatches)
	if err == pgx.ErrNoRows {
		id, err := securerandom.Hex(6)
		if err != nil {
			return nil, fmt.Errorf("error generating file ID: %w", err)
		}

		// create the file with "" content and the pending patch
		query := `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, pending_patches) VALUES ($1, $2, $3, $4, $5, $6, $7)`
		_, err = conn.Exec(ctx, query, id, revisionNumber, chartID, workspaceID, filePath, "", []string{pendingPatch})
		if err != nil {
			return nil, fmt.Errorf("error inserting file in workspace: %w", err)
		}

		updatedFile, err := GetFile(ctx, id, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("error getting file: %w", err)
		}

		return updatedFile, nil
	} else {
		// Create a string slice for the patches
		var patches []string

		if existingPatches.Valid {
			// Use the existing patches and append the new one
			patches = append(existingPatches.Elements, pendingPatch)
		} else {
			// Start with just the new patch
			patches = []string{pendingPatch}
		}

		fmt.Printf("patches to save: %v\n", patches)
		fmt.Printf("fileID: %v\n", fileID)

		query := `UPDATE workspace_file SET pending_patches = $1 WHERE id = $2 AND revision_number = $3`
		_, err = conn.Exec(ctx, query, patches, fileID, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("error updating file in workspace: %w", err)
		}

		updatedFile, err := GetFile(ctx, fileID, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("error getting file: %w", err)
		}

		return updatedFile, nil
	}
}

func ListFiles(ctx context.Context, workspaceID string, revisionNumber int, chartID string) ([]types.File, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, revision_number, chart_id, workspace_id, file_path, content, pending_patches FROM workspace_file WHERE chart_id = $1 AND workspace_id = $2 AND revision_number = $3`
	rows, err := conn.Query(ctx, query, chartID, workspaceID, revisionNumber)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := []types.File{}
	for rows.Next() {
		var file types.File
		var chartID sql.NullString

		// Use pgtype.Array which is designed to handle PostgreSQL arrays properly
		var pendingPatches pgtype.Array[string]

		err := rows.Scan(&file.ID, &file.RevisionNumber, &chartID, &file.WorkspaceID, &file.FilePath, &file.Content, &pendingPatches)
		if err != nil {
			return nil, fmt.Errorf("error scanning file row: %w", err)
		}

		// Only set the PendingPatches if the array is not null
		if pendingPatches.Valid {
			file.PendingPatches = pendingPatches.Elements
		} else {
			// Initialize an empty slice if pending_patches is NULL
			file.PendingPatches = []string{}
		}

		file.ChartID = chartID.String
		files = append(files, file)
	}

	return files, nil
}
