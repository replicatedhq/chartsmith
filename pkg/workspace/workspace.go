package workspace

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
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

func GetWorkspace(ctx context.Context, id string) (*types.Workspace, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace.id,
		workspace.created_at,
		workspace.last_updated_at,
		workspace.name,
		workspace.current_revision_number
	FROM
		workspace
	WHERE
		workspace.id = $1`

	row := conn.QueryRow(ctx, query, id)
	var workspace types.Workspace
	err := row.Scan(
		&workspace.ID,
		&workspace.CreatedAt,
		&workspace.LastUpdatedAt,
		&workspace.Name,
		&workspace.CurrentRevision,
	)

	if err != nil {
		return nil, err
	}

	files, err := listFilesForWorkspace(ctx, id, workspace.CurrentRevision)
	if err != nil {
		return nil, err
	}

	workspace.Files = files

	return &workspace, nil
}

func listFilesForWorkspace(ctx context.Context, workspaceID string, revisionNumber int) ([]types.File, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace_file.file_path,
		workspace_file.content,
		workspace_file.name
	FROM
		workspace_file
	WHERE
		workspace_file.workspace_id = $1 AND workspace_file.revision_number = $2`

	rows, err := conn.Query(ctx, query, workspaceID, revisionNumber)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var files []types.File
	for rows.Next() {
		var file types.File
		err := rows.Scan(
			&file.Path,
			&file.Content,
			&file.Name,
		)
		if err != nil {
			return nil, err
		}
		files = append(files, file)
	}

	return files, nil
}

func CreateWorkspaceRevision(ctx context.Context, workspace *types.Workspace) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// get the current revision number
	query := `SELECT
		workspace.current_revision_number
	FROM
		workspace
	WHERE
		workspace.id = $1`

	row := tx.QueryRow(ctx, query, workspace.ID)
	var currentRevisionNumber int
	err = row.Scan(&currentRevisionNumber)
	if err != nil {
		return err
	}

	newRevisionNumber := currentRevisionNumber + 1

	// update the workspace
	query = `UPDATE workspace
	SET
		name = $1,
		last_updated_at = now(),
		current_revision_number = $2
	WHERE
		id = $3`

	_, err = conn.Exec(ctx, query, workspace.Name, newRevisionNumber, workspace.ID)
	if err != nil {
		return err
	}

	for _, file := range workspace.Files {
		// insert the file
		query = `INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name)
		VALUES ($1, $2, $3, now(), now(), $4, $5)`

		_, err = conn.Exec(ctx, query, workspace.ID, file.Path, newRevisionNumber, file.Content, file.Name)
		if err != nil {
			return err
		}

		// split the file into separate YAML documents
		for _, document := range strings.Split(file.Content, "---") {
			// trim the document
			document = strings.TrimSpace(document)

			// skip empty documents
			if document == "" {
				continue
			}

			// try to parse the gvk in the format of <group>/<version>/<kind>, for well known types, we have a
			// static string, but there could be emptys too
			gvk, err := ParseGVK(file.Path, document)
			if err != nil {
				continue
			}

			// insert the document
			gvkID, err := securerandom.Hex(12)
			if err != nil {
				return err
			}
			query = `INSERT INTO workspace_gvk (id, workspace_id, gvk, revision_number, file_path, created_at, content)
			VALUES ($1, $2, $3, $4, $5, now(), $6)`

			_, err = conn.Exec(ctx, query, gvkID, workspace.ID, gvk, newRevisionNumber, file.Path, document)
			if err != nil {
				return err
			}

			// notify the worker
			query = `SELECT pg_notify('new_gvk', $1)`
			_, err = conn.Exec(ctx, query, gvkID)
			if err != nil {
				return err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	return nil
}

func ParseGVK(filePath string, content string) (string, error) {
	if filepath.Ext(filePath) != ".yaml" {
		return "", nil
	}

	if filepath.Base(filePath) == "values.yaml" {
		return "values", nil
	}

	if filepath.Base(filePath) == "Chart.yaml" {
		return "chart", nil
	}

	var group string
	var version string
	var kind string

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "apiVersion:") {
			groupVersionParts := strings.Split(strings.TrimSpace(strings.TrimPrefix(line, "apiVersion:")), "/")
			if len(groupVersionParts) == 2 {
				group = groupVersionParts[0]
				version = groupVersionParts[1]
			} else {
				version = groupVersionParts[0]
			}
		}
		if strings.HasPrefix(line, "kind:") {
			kind = strings.TrimSpace(strings.TrimPrefix(line, "kind:"))
		}
	}

	if group == "" && version != "" && kind != "" {
		return fmt.Sprintf("%s/%s", version, kind), nil
	} else if group != "" && version != "" && kind != "" {
		return fmt.Sprintf("%s/%s/%s", group, version, kind), nil
	}

	return "", nil
}
