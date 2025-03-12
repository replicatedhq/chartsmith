package workspace

import (
	"context"
	"database/sql"

	"github.com/jackc/pgx/v5"
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

func CreateRevision(ctx context.Context, workspaceID string, planID *string, userID string) (types.Revision, error) {
	logger.Info("Creating revision",
		zap.String("workspace_id", workspaceID),
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

	if err := persistence.EnqueueWork(ctx, "execute_plan", map[string]interface{}{
		"planId": planID,
	}); err != nil {
		logger.Warn("failed to enqueue execute_plan notification", zap.Error(err))
		// but do not exit
	}

	// Get and return the newly created revision
	revision, err := GetRevision(ctx, workspaceID, newRevisionNumber)
	if err != nil {
		return types.Revision{}, err
	}
	return *revision, nil
}

func SetRevisionComplete(ctx context.Context, workspaceID string, revisionNumber int) error {
	logger.Info("Setting revision complete",
		zap.String("workspace_id", workspaceID),
		zap.Int("revision_number", revisionNumber))

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Check if revision is already complete
	var isComplete bool
	err = tx.QueryRow(ctx, `SELECT is_complete FROM workspace_revision WHERE workspace_id = $1 AND revision_number = $2`,
		workspaceID, revisionNumber).Scan(&isComplete)
	if err != nil {
		return err
	}

	if !isComplete {
		// Update the revision to be complete
		_, err = tx.Exec(ctx, `UPDATE workspace_revision SET is_complete = true WHERE workspace_id = $1 AND revision_number = $2`,
			workspaceID, revisionNumber)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Try to get the last chat message id for this revision
	chatMessageID := ""
	err = conn.QueryRow(ctx, `SELECT id FROM workspace_chat WHERE workspace_id = $1 AND revision_number = $2 ORDER BY created_at DESC LIMIT 1`,
		workspaceID, revisionNumber).Scan(&chatMessageID)
	if err != nil {
		if err != pgx.ErrNoRows {
			return err
		}
		logger.Warn("No chat message found for revision, will use empty chat ID",
			zap.String("workspaceID", workspaceID),
			zap.Int("revisionNumber", revisionNumber))
	}

	// Check if this is a plan-initiated revision
	var planID sql.NullString
	err = conn.QueryRow(ctx, `SELECT plan_id FROM workspace_revision WHERE workspace_id = $1 AND revision_number = $2`,
		workspaceID, revisionNumber).Scan(&planID)
	if err != nil {
		return err
	}

	// Only create a render job if this is NOT a plan-related revision
	// This avoids duplicate renders since execute-action.go already creates
	// a render job when a plan is applied
	if !planID.Valid {
		logger.Info("Creating render job for non-plan revision",
			zap.String("workspaceID", workspaceID),
			zap.Int("revisionNumber", revisionNumber),
			zap.String("chatMessageID", chatMessageID))

		if err := EnqueueRenderWorkspaceForRevision(ctx, workspaceID, revisionNumber, chatMessageID); err != nil {
			return err
		}
	} else {
		logger.Info("Not creating render job for plan-related revision to avoid duplicates",
			zap.String("workspaceID", workspaceID),
			zap.Int("revisionNumber", revisionNumber),
			zap.String("planID", planID.String))
	}

	return nil
}
