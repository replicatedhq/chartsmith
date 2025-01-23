package workspace

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func listPlans(ctx context.Context, workspaceID string) ([]types.Plan, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		id,
		workspace_id,
		chat_message_ids,
		created_at,
		updated_at,
		version,
		status
	FROM workspace_plan WHERE workspace_id = $1 ORDER BY created_at DESC`

	rows, err := conn.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("error listing plans: %w", err)
	}
	defer rows.Close()

	var plans []types.Plan
	for rows.Next() {
		var plan types.Plan
		err := rows.Scan(
			&plan.ID,
			&plan.WorkspaceID,
			&plan.ChatMessageIDs,
			&plan.CreatedAt,
			&plan.UpdatedAt,
			&plan.Version,
			&plan.Status,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning plan: %w", err)
		}
		plans = append(plans, plan)
	}

	return plans, nil
}

func GetPlan(ctx context.Context, planID string) (*types.Plan, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		id,
		workspace_id,
		chat_message_ids,
		created_at,
		updated_at,
		version,
		status
	FROM workspace_plan WHERE id = $1`

	row := conn.QueryRow(ctx, query, planID)

	var plan types.Plan
	err := row.Scan(
		&plan.ID,
		&plan.WorkspaceID,
		&plan.ChatMessageIDs,
		&plan.CreatedAt,
		&plan.UpdatedAt,
		&plan.Version,
		&plan.Status,
	)
	if err != nil {
		return nil, fmt.Errorf("error scanning plan: %w", err)
	}

	return &plan, nil
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
