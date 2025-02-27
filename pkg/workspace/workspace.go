package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
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

func SetChatMessageResponse(ctx context.Context, chatMessageID string, response string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_chat SET response = $1 WHERE id = $2`
	_, err := conn.Exec(ctx, query, response, chatMessageID)
	if err != nil {
		return fmt.Errorf("error updating chat message response: %w", err)
	}
	return nil
}

func AppendChatMessageResponse(ctx context.Context, chatMessageID string, response string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_chat SET response = COALESCE(response, '') || $1 WHERE id = $2`
	_, err := conn.Exec(ctx, query, response, chatMessageID)
	if err != nil {
		return fmt.Errorf("error updating chat message response: %w", err)
	}
	return nil
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

	var currentPlanId sql.NullString
	query = `SELECT plan_id FROM workspace_revision WHERE workspace_id = $1 AND revision_number = $2`
	row = conn.QueryRow(ctx, query, id, workspace.CurrentRevision)
	err = row.Scan(&currentPlanId)
	if err != nil {
		if err != pgx.ErrNoRows {
			return nil, fmt.Errorf("error scanning current plan created at: %w", err)
		}
	}

	workspacePlans, err := listPlans(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error listing plans: %w", err)
	}

	var currentPlanCreatedAt *time.Time
	if currentPlanId.Valid {
		for _, plan := range workspacePlans {
			if plan.ID == currentPlanId.String {
				currentPlanCreatedAt = &plan.CreatedAt
			}
		}
	}

	for _, plan := range workspacePlans {
		if currentPlanCreatedAt == nil {
			workspace.CurrentPlans = append(workspace.CurrentPlans, plan)
		} else {
			if plan.CreatedAt.Before(*currentPlanCreatedAt) {
				workspace.PreviousPlans = append(workspace.PreviousPlans, plan)
			} else {
				workspace.CurrentPlans = append(workspace.CurrentPlans, plan)
			}
		}
	}

	workspace.CurrentPlans = workspacePlans
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
		content
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
		var chartID sql.NullString
		err := rows.Scan(
			&file.ID,
			&file.RevisionNumber,
			&chartID,
			&file.WorkspaceID,
			&file.FilePath,
			&file.Content,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning file: %w", err)
		}

		file.ChartID = chartID.String

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
		content
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
		var chartID sql.NullString
		err := rows.Scan(
			&file.ID,
			&file.RevisionNumber,
			&chartID,
			&file.WorkspaceID,
			&file.FilePath,
			&file.Content,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning file: %w", err)
		}
		file.ChartID = chartID.String
		files = append(files, file)
	}

	return files, nil
}

func SetCurrentRevision(ctx context.Context, tx pgx.Tx, workspace *types.Workspace, revision int) (*types.Workspace, error) {
	shouldCommit := false

	if tx == nil {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		t, err := conn.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("error starting transaction: %w", err)
		}
		tx = t
		defer t.Rollback(ctx)

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

	if err := NotifyWorkerToCaptureEmbeddings(ctx, workspace.ID, revision); err != nil {
		return nil, fmt.Errorf("error notifying worker to capture embeddings: %w", err)
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

	filesNeedingEmbeddings := []types.File{}

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
		workspace_id = $1 AND revision_number = $2 AND embeddings IS NULL`

	rows, err := conn.Query(ctx, query, workspaceID, revisionNumber)
	if err != nil {
		return fmt.Errorf("error scanning files needing summaries and embeddings: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var file types.File
		var chartID sql.NullString
		err := rows.Scan(&file.ID, &file.RevisionNumber, &chartID, &file.WorkspaceID, &file.FilePath, &file.Content)
		if err != nil {
			return fmt.Errorf("error scanning file: %w", err)
		}
		file.ChartID = chartID.String
		filesNeedingEmbeddings = append(filesNeedingEmbeddings, file)
	}
	rows.Close()

	// the payload is file_id/revision_number
	for _, file := range filesNeedingEmbeddings {
		p := map[string]interface{}{
			"fileId":   file.ID,
			"revision": file.RevisionNumber,
		}

		if err := persistence.EnqueueWork(ctx, "new_summarize", p); err != nil {
			return fmt.Errorf("error enqueuing work: %w", err)
		}
	}

	return nil
}
