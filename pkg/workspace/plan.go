package workspace

import (
	"context"
	"fmt"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

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

	// Trim any whitespace from the description to avoid extra spaces
	description = strings.TrimSpace(description)
	if description == "" {
		return nil
	}

	// Use COALESCE and string_agg to properly handle concatenation
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
