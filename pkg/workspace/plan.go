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

func GetMostRecentPlan(ctx context.Context, workspaceID string) (*types.Plan, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id FROM workspace_plan WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`
	row := conn.QueryRow(ctx, query, workspaceID)

	var planID string
	err := row.Scan(&planID)
	if err != nil {
		return nil, fmt.Errorf("error scanning plan: %w", err)
	}
	return GetPlan(ctx, nil, planID)
}

func PendingActionPathsForPlan(ctx context.Context, planID string) ([]string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT path FROM action_queue WHERE plan_id = $1 AND completed_at IS NULL`
	rows, err := conn.Query(ctx, query, planID)
	if err != nil {
		return nil, fmt.Errorf("error listing pending actions: %w", err)
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, fmt.Errorf("error scanning path: %w", err)
		}
		paths = append(paths, path)
	}
	return paths, nil
}

func listPlans(ctx context.Context, workspaceID string) ([]types.Plan, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `SELECT
		id,
		workspace_id,
		chat_message_ids,
		created_at,
		updated_at,
		version,
		status,
		description,
		is_complete
	FROM workspace_plan WHERE workspace_id = $1 ORDER BY created_at DESC`

	rows, err := tx.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("error listing plans: %w", err)
	}
	defer rows.Close()

	var plans []types.Plan
	for rows.Next() {
		var plan types.Plan
		var description sql.NullString
		err := rows.Scan(
			&plan.ID,
			&plan.WorkspaceID,
			&plan.ChatMessageIDs,
			&plan.CreatedAt,
			&plan.UpdatedAt,
			&plan.Version,
			&plan.Status,
			&description,
			&plan.IsComplete,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning plan: %w", err)
		}
		plan.Description = description.String

		plans = append(plans, plan)
	}

	rows.Close()

	for i, plan := range plans {
		afs, err := listActionFiles(ctx, tx, plan.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to list action files: %w", err)
		}
		plans[i].ActionFiles = afs
	}

	return plans, nil
}

func GetPlan(ctx context.Context, tx pgx.Tx, planID string) (*types.Plan, error) {
	shouldCommit := false
	if tx == nil {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		t, err := conn.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to begin transaction: %w", err)
		}
		tx = t

		defer tx.Rollback(ctx)

		shouldCommit = true
	}

	query := `SELECT
		id,
		workspace_id,
		chat_message_ids,
		created_at,
		updated_at,
		version,
		status,
		description,
		is_complete
	FROM workspace_plan WHERE id = $1`

	row := tx.QueryRow(ctx, query, planID)

	var plan types.Plan
	var description sql.NullString
	err := row.Scan(
		&plan.ID,
		&plan.WorkspaceID,
		&plan.ChatMessageIDs,
		&plan.CreatedAt,
		&plan.UpdatedAt,
		&plan.Version,
		&plan.Status,
		&description,
		&plan.IsComplete,
	)
	if err != nil {
		return nil, fmt.Errorf("error scanning plan: %w", err)
	}
	plan.Description = description.String

	afs, err := listActionFiles(ctx, tx, planID)
	if err != nil {
		return nil, fmt.Errorf("failed to list action files: %w", err)
	}
	plan.ActionFiles = afs

	if shouldCommit {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("failed to commit transaction: %w", err)
		}
	}

	return &plan, nil
}

func listActionFiles(ctx context.Context, tx pgx.Tx, planID string) ([]types.ActionFile, error) {
	query := `SELECT
		action,
		path,
		status
	FROM workspace_plan_action_file WHERE plan_id = $1 ORDER BY created_at ASC`

	rows, err := tx.Query(ctx, query, planID)
	if err != nil {
		return nil, fmt.Errorf("error listing action files: %w", err)
	}

	var actionFiles []types.ActionFile
	for rows.Next() {
		var actionFile types.ActionFile
		err := rows.Scan(&actionFile.Action, &actionFile.Path, &actionFile.Status)
		if err != nil {
			return nil, fmt.Errorf("error scanning action file: %w", err)
		}
		actionFiles = append(actionFiles, actionFile)
	}

	return actionFiles, nil
}

func AppendPlanDescription(ctx context.Context, planID string, description string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	if description == "" {
		return nil
	}

	// Simple concatenation, trusting the input stream's spacing
	query := `
		UPDATE workspace_plan
		SET description = CASE
			WHEN description IS NULL OR description = '' THEN $1
			ELSE description || $1
		END
		WHERE id = $2`

	_, err := conn.Exec(ctx, query, description, planID)
	if err != nil {
		return fmt.Errorf("error appending plan description: %w", err)
	}
	return nil
}

func UpdatePlanStatus(ctx context.Context, planID string, status types.PlanStatus) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_plan SET status = $1 WHERE id = $2`
	_, err := conn.Exec(ctx, query, status, planID)
	if err != nil {
		return fmt.Errorf("error updating plan status: %w", err)
	}
	return nil
}

func UpdatePlanActionFiles(ctx context.Context, tx pgx.Tx, planID string, actionFiles []types.ActionFile) error {
	_, err := tx.Exec(ctx, `DELETE FROM workspace_plan_action_file WHERE plan_id = $1`, planID)
	if err != nil {
		return fmt.Errorf("error deleting existing action files: %w", err)
	}

	for _, actionFile := range actionFiles {
		query := `INSERT INTO workspace_plan_action_file (plan_id, action, path, status, created_at) VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT (plan_id, path) DO UPDATE SET status = EXCLUDED.status`

		_, err := tx.Exec(ctx, query, planID, actionFile.Action, actionFile.Path, actionFile.Status, time.Now())
		if err != nil {
			return fmt.Errorf("error updating plan action files: %w", err)
		}
	}

	return nil
}

func SetPlanIsComplete(ctx context.Context, planID string, isComplete bool) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_plan SET is_complete = $1 WHERE id = $2`
	_, err := conn.Exec(ctx, query, isComplete, planID)
	if err != nil {
		return fmt.Errorf("error updating plan is complete: %w", err)
	}
	return nil
}
