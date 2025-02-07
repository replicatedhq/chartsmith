package workspace

import (
	"context"
	"errors"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

func GetRevision(ctx context.Context, workspaceID string, revisionNumber int) (*types.Revision, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
        workspace_revision.workspace_id,
        workspace_revision.revision_number,
        workspace_revision.created_at,
        workspace_revision.created_by_user_id,
        workspace_revision.created_type,
        workspace_revision.is_complete,
		workspace_revision.is_rendered
    FROM
        workspace_revision
    WHERE
        workspace_revision.workspace_id = $1 AND workspace_revision.revision_number = $2`

	row := conn.QueryRow(ctx, query, workspaceID, revisionNumber)
	var revision types.Revision
	err := row.Scan(
		&revision.WorkspaceID,
		&revision.RevisionNumber,
		&revision.CreatedAt,
		&revision.CreatedByUserID,
		&revision.CreatedType,
		&revision.IsComplete,
		&revision.IsRendered,
	)
	if err != nil {
		return nil, err
	}

	return &revision, nil
}

func CreateRevision(ctx context.Context, workspaceID string, planID string, userID string) (types.Revision, error) {
	logger.Info("Creating revision",
		zap.String("workspace_id", workspaceID),
		zap.String("plan_id", planID),
		zap.String("user_id", userID))

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Start transaction
	tx, err := conn.Begin(ctx)
	if err != nil {
		return types.Revision{}, err
	}
	defer tx.Rollback(ctx) // Will be ignored if tx.Commit() is called

	// Get next revision number
	var newRevisionNumber int
	err = tx.QueryRow(ctx, `
        WITH latest_revision AS (
            SELECT * FROM workspace_revision
            WHERE workspace_id = $1
            ORDER BY revision_number DESC
            LIMIT 1
        ),
        next_revision AS (
            SELECT COALESCE(MAX(revision_number), 0) + 1 as next_num
            FROM workspace_revision
            WHERE workspace_id = $1
        )
        INSERT INTO workspace_revision (
            workspace_id, revision_number, created_at,
            created_by_user_id, created_type, is_complete, is_rendered, plan_id
        )
        SELECT
            $1,
            next_num,
            NOW(),
            $2,
            COALESCE(lr.created_type, 'manual'),
            false,
            false,
            $3
        FROM next_revision
        LEFT JOIN latest_revision lr ON true
        RETURNING revision_number
    `, workspaceID, userID, planID).Scan(&newRevisionNumber)
	if err != nil {
		return types.Revision{}, err
	}

	previousRevisionNumber := newRevisionNumber - 1

	// Copy workspace_chart records from previous revision
	_, err = tx.Exec(ctx, `
        INSERT INTO workspace_chart (id, revision_number, workspace_id, name)
        SELECT id, $1, workspace_id, name
        FROM workspace_chart
        WHERE workspace_id = $2 AND revision_number = $3
    `, newRevisionNumber, workspaceID, previousRevisionNumber)
	if err != nil {
		return types.Revision{}, err
	}

	// Copy workspace_file records from previous revision
	_, err = tx.Exec(ctx, `
        INSERT INTO workspace_file (
            id, revision_number, chart_id, workspace_id, file_path,
            content, embeddings
        )
        SELECT
            id, $1, chart_id, workspace_id, file_path,
            content, embeddings
        FROM workspace_file
        WHERE workspace_id = $2 AND revision_number = $3
    `, newRevisionNumber, workspaceID, previousRevisionNumber)
	if err != nil {
		return types.Revision{}, err
	}

	// Update workspace current revision
	_, err = tx.Exec(ctx, `
        UPDATE workspace
        SET current_revision_number = $1
        WHERE id = $2
    `, newRevisionNumber, workspaceID)
	if err != nil {
		return types.Revision{}, err
	}

	// Commit transaction
	err = tx.Commit(ctx)
	if err != nil {
		return types.Revision{}, err
	}

	// Notify about new revision after commit
	_, err = conn.Exec(ctx, `SELECT pg_notify('execute_plan', $1)`, planID)
	if err != nil {
		logger.Error(errors.New("failed to send execute_plan notification"))
		// Don't return error here since the revision was created successfully
	}

	// Get and return the newly created revision
	revision, err := GetRevision(ctx, workspaceID, newRevisionNumber)
	if err != nil {
		return types.Revision{}, err
	}
	return *revision, nil
}
