package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5"
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
		return nil, fmt.Errorf("error scanning user ID: %w", err)
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
		return nil, fmt.Errorf("error scanning workspace: %w", err)
	}

	charts, err := listChartsForWorkspace(ctx, id, workspace.CurrentRevision)
	if err != nil {
		return nil, fmt.Errorf("error listing charts for workspace: %w", err)
	}
	workspace.Charts = charts

	files, err := listFilesWithoutChartsForWorkspace(ctx, id, workspace.CurrentRevision)
	if err != nil {
		return nil, fmt.Errorf("error listing files for workspace: %w", err)
	}

	workspace.Files = files

	// look for an incomplete revision
	query = `
		SELECT
			workspace_revision.revision_number
		FROM
			workspace_revision
		WHERE
			workspace_revision.workspace_id = $1 AND
			workspace_revision.is_complete = false AND
			workspace_revision.revision_number > $2
		ORDER BY
			workspace_revision.revision_number DESC
		LIMIT 1
	`

	row = conn.QueryRow(ctx, query, id, workspace.CurrentRevision)
	var incompleteRevisionNumber int
	err = row.Scan(&incompleteRevisionNumber)
	if err != nil {
		if err != pgx.ErrNoRows {
			return nil, fmt.Errorf("error scanning incomplete revision number: %w", err)
		}
	}

	if incompleteRevisionNumber > 0 {
		workspace.IncompleteRevisionNumber = &incompleteRevisionNumber
	}

	return &workspace, nil
}

func listChartsForWorkspace(ctx context.Context, workspaceID string, revisionNumber int) ([]types.Chart, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace_chart.id,
		workspace_chart.name
	FROM
		workspace_chart
	WHERE
		workspace_chart.workspace_id = $1 and workspace_chart.revision_number = $2`

	rows, err := conn.Query(ctx, query, workspaceID, revisionNumber)
	if err != nil {
		return nil, fmt.Errorf("error scanning workspace charts: %w", err)
	}

	defer rows.Close()

	var charts []types.Chart
	for rows.Next() {
		var chart types.Chart
		err := rows.Scan(
			&chart.ID,
			&chart.Name,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning chart: %w", err)
		}
		charts = append(charts, chart)
	}
	rows.Close()

	// for each chart, get the files
	for i := range charts {
		files, err := listFilesForChart(ctx, charts[i].ID, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("error listing files for chart: %w", err)
		}
		charts[i].Files = files
	}

	return charts, nil
}

func listFilesForChart(ctx context.Context, chartID string, revisionNumber int) ([]types.File, error) {
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
		workspace_file.chart_id = $1 and workspace_file.revision_number = $2`

	rows, err := conn.Query(ctx, query, chartID, revisionNumber)
	if err != nil {
		return nil, fmt.Errorf("error scanning chart files: %w", err)
	}

	defer rows.Close()

	var files []types.File
	for rows.Next() {
		var file types.File
		var summary sql.NullString
		err := rows.Scan(
			&file.ID,
			&file.RevisionNumber,
			&file.ChartID,
			&file.WorkspaceID,
			&file.FilePath,
			&file.Content,
			&summary,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning file: %w", err)
		}
		if summary.Valid {
			file.Summary = summary.String
		}
		files = append(files, file)
	}
	rows.Close()

	return files, nil
}

func listFilesWithoutChartsForWorkspace(ctx context.Context, workspaceID string, revisionNumber int) ([]types.File, error) {
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
		revision_number = $1 AND
		workspace_id = $2 AND
		chart_id IS NULL`

	rows, err := conn.Query(ctx, query, revisionNumber, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("error scanning files without charts: %w", err)
	}

	defer rows.Close()

	var files []types.File
	for rows.Next() {
		var file types.File
		var summary sql.NullString
		err := rows.Scan(
			&file.ID,
			&file.RevisionNumber,
			&file.ChartID,
			&file.WorkspaceID,
			&file.FilePath,
			&file.Content,
			&summary,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning file: %w", err)
		}
		if summary.Valid {
			file.Summary = summary.String
		}
		files = append(files, file)
	}

	return files, nil
}

func SetCurrentRevision(ctx context.Context, tx pgx.Tx, workspace *types.Workspace, revision int) (*types.Workspace, error) {
	shouldCommit := false

	if tx == nil {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		tx, err := conn.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("error starting transaction: %w", err)
		}
		defer tx.Rollback(ctx)

		shouldCommit = true
	}

	query := `UPDATE workspace
	SET current_revision_number = $1
	WHERE id = $2`

	_, err := tx.Exec(ctx, query, revision, workspace.ID)
	if err != nil {
		return nil, fmt.Errorf("error updating workspace: %w", err)
	}

	query = `UPDATE workspace_revision set is_complete = true WHERE workspace_id = $1 AND revision_number = $2`
	_, err = tx.Exec(ctx, query, workspace.ID, revision)
	if err != nil {
		return nil, fmt.Errorf("error updating workspace revision: %w", err)
	}

	if shouldCommit {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("error committing transaction: %w", err)
		}
	}

	return GetWorkspace(ctx, workspace.ID)
}

func SetChartName(ctx context.Context, tx pgx.Tx, workspaceID string, chartID string, name string, revisionNumber int) error {
	query := `UPDATE workspace_chart SET name = $1 WHERE id = $2 AND workspace_id = $3 AND revision_number = $4`
	_, err := tx.Exec(ctx, query, name, chartID, workspaceID, revisionNumber)
	if err != nil {
		return fmt.Errorf("error updating chart name: %w", err)
	}
	return nil
}

func NotifyWorkerToCaptureEmbeddings(ctx context.Context, workspaceID string, revisionNumber int) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	filesNeedingSummariesAndEmbeddings := []types.File{}

	query := `SELECT
		id,
		revision_number,
		chart_id,
		workspace_id,
		file_path,
		content
	FROM
		workspace_file
	WHERE
		workspace_id = $1 AND revision_number = $2 AND (summary IS NULL OR embeddings IS NULL)`

	rows, err := conn.Query(ctx, query, workspaceID, revisionNumber)
	if err != nil {
		return fmt.Errorf("error scanning files needing summaries and embeddings: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var file types.File
		err := rows.Scan(&file.ID, &file.RevisionNumber, &file.ChartID, &file.WorkspaceID, &file.FilePath, &file.Content)
		if err != nil {
			return fmt.Errorf("error scanning file: %w", err)
		}
		filesNeedingSummariesAndEmbeddings = append(filesNeedingSummariesAndEmbeddings, file)
	}
	rows.Close()

	// the payload is file_id/revision_number
	for _, file := range filesNeedingSummariesAndEmbeddings {
		payload := fmt.Sprintf("%s/%d", file.ID, file.RevisionNumber)

		// pg_notify this with the payload
		conn.Exec(ctx, `SELECT pg_notify('new_file', $1)`, payload)
	}

	return nil
}

func SetFilesInWorkspace(ctx context.Context, tx pgx.Tx, workspace *types.Workspace, revision int) error {
	shouldCommit := false
	if tx == nil {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		localTx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		defer localTx.Rollback(ctx)

		tx = localTx
		shouldCommit = true
	}

	for _, chart := range workspace.Charts {
		for _, file := range chart.Files {
			if file.ID == "" {
				fileID, err := securerandom.Hex(12)
				if err != nil {
					return fmt.Errorf("error generating file ID: %w", err)
				}
				file.ID = fileID

				query := `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, summary, embeddings)
				VALUES ($1, $2, $3, $4, $5, $6, null, null)`
				_, err = tx.Exec(ctx, query, file.ID, revision, chart.ID, workspace.ID, file.FilePath, file.Content)
				if err != nil {
					return fmt.Errorf("error inserting file: %w", err)
				}

			} else {
				query := `UPDATE workspace_file
				SET content = $1, embeddings = NULL, summary = NULL
				WHERE id = $2 AND revision_number = $3`
				_, err := tx.Exec(ctx, query, file.Content, file.ID, revision)
				if err != nil {
					return fmt.Errorf("error updating file: %w", err)
				}
			}
		}
	}

	for _, file := range workspace.Files {
		if file.ID == "" {
			fileID, err := securerandom.Hex(12)
			if err != nil {
				return fmt.Errorf("error generating file ID: %w", err)
			}
			file.ID = fileID
		}

		query := `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, summary, embeddings)
VALUES ($1, $2, null, $3, $4, $5, null, null)`
		_, err := tx.Exec(ctx, query, file.ID, revision, workspace.ID, file.FilePath, file.Content)
		if err != nil {
			return err
		}
	}

	// only commit the transaction if we started it
	if shouldCommit {
		if err := tx.Commit(ctx); err != nil {
			return err
		}
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
