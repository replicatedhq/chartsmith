package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

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
		pending_patch
	FROM
		workspace_file
	WHERE
		id = $1 AND revision_number = $2`

	row := conn.QueryRow(ctx, query, fileID, revisionNumber)
	var file types.File
	var pendingPatch sql.NullString
	err := row.Scan(&file.ID, &file.RevisionNumber, &file.ChartID, &file.WorkspaceID, &file.FilePath, &file.Content, &pendingPatch)
	if err != nil {
		return nil, err
	}

	file.PendingPatch = pendingPatch.String

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

func CreateOrPatchFile(ctx context.Context, workspaceID string, revisionNumber int, chartID string, filePath string, content string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, content FROM workspace_file WHERE chart_id = $1 AND file_path = $2 AND workspace_id = $3 AND revision_number = $4`
	row := conn.QueryRow(ctx, query, chartID, filePath, workspaceID, revisionNumber)
	var fileID string
	var existingContent string
	err := row.Scan(&fileID, &existingContent)
	if err == pgx.ErrNoRows {
		id, err := securerandom.Hex(6)
		if err != nil {
			return fmt.Errorf("error generating file ID: %w", err)
		}

		// For new files, create a patch showing the entire file as new
		generatedPatch := fmt.Sprintf(`--- %[1]s
+++ %[1]s
@@ -0,0 +1,%d @@
%s`, filePath, len(strings.Split(content, "\n")), content)

		query := `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, pending_patch) VALUES ($1, $2, $3, $4, $5, $6, $7)`
		_, err = conn.Exec(ctx, query, id, revisionNumber, chartID, workspaceID, filePath, "", generatedPatch)
		if err != nil {
			return fmt.Errorf("error inserting file in workspace: %w", err)
		}
	} else {
		// For existing files, create a patch showing the differences
		oldLines := strings.Split(existingContent, "\n")
		newLines := strings.Split(content, "\n")

		generatedPatch := fmt.Sprintf(`--- %[1]s
+++ %[1]s
@@ -1,%d +1,%d @@
%s`, filePath, len(oldLines), len(newLines), content)

		query := `UPDATE workspace_file SET pending_patch = $1 WHERE chart_id = $2 AND file_path = $3 AND workspace_id = $4 AND revision_number = $5`
		_, err := conn.Exec(ctx, query, generatedPatch, chartID, filePath, workspaceID, revisionNumber)
		if err != nil {
			return fmt.Errorf("error updating file in workspace: %w", err)
		}
	}

	return nil
}
