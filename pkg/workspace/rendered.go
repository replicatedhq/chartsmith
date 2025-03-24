package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"runtime/debug"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
	"go.uber.org/zap"
)

func FinishRendered(ctx context.Context, id string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered SET completed_at = NOW(), error_message = NULL WHERE id = $1`
	_, err := conn.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to finish rendered: %w", err)
	}

	return nil
}

// FailRendered marks a render job as failed with an error message
func FailRendered(ctx context.Context, id string, errorMessage string) error {
	// Use a background context if the provided context is already done
	if ctx.Err() != nil {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Update the record with error message and mark as completed (but failed)
	query := `UPDATE workspace_rendered SET completed_at = NOW(), error_message = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, id, errorMessage)
	if err != nil {
		return fmt.Errorf("failed to mark render as failed: %w", err)
	}

	// Also update any incomplete rendered charts to mark them as failed
	query = `UPDATE workspace_rendered_chart
		SET completed_at = NOW(), is_success = false, helm_template_stderr = COALESCE(helm_template_stderr, '') || $2
		WHERE workspace_render_id = $1 AND completed_at IS NULL`
	_, err = conn.Exec(ctx, query, id, "\n\nRender operation failed: "+errorMessage)
	if err != nil {
		return fmt.Errorf("failed to mark rendered charts as failed: %w", err)
	}

	return nil
}

func GetRendered(ctx context.Context, id string) (*types.Rendered, error) {
	startTime := time.Now()
	logger.Info("GetRendered", zap.String("id", id))
	
	// Add panic recovery
	defer func() {
		if r := recover(); r != nil {
			logger.Error(fmt.Errorf("PANIC in GetRendered: %v", r),
				zap.String("id", id))
			debug.PrintStack()
		}
		
		logger.Debug("GetRendered completed",
			zap.String("id", id),
			zap.Duration("duration", time.Since(startTime)))
	}()

	logger.Debug("Getting DB connection", zap.String("id", id))
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()
	logger.Debug("Got DB connection", zap.String("id", id))

	query := `SELECT id, workspace_id, revision_number, created_at, completed_at, is_autorender FROM workspace_rendered WHERE id = $1`
	logger.Debug("Executing first query", 
		zap.String("id", id),
		zap.String("query", query))
		
	row := conn.QueryRow(ctx, query, id)
	logger.Debug("Got row from first query", zap.String("id", id))

	var rendered types.Rendered
	var completedAt sql.NullTime
	
	logger.Debug("About to scan row", zap.String("id", id))
	if err := row.Scan(&rendered.ID, &rendered.WorkspaceID, &rendered.RevisionNumber, &rendered.CreatedAt, &completedAt, &rendered.IsAutorender); err != nil {
		logger.Error(fmt.Errorf("failed to scan row: %w", err),
			zap.String("id", id))
		return nil, fmt.Errorf("failed to get rendered: %w", err)
	}
	logger.Debug("Successfully scanned row", 
		zap.String("id", id),
		zap.String("workspaceID", rendered.WorkspaceID),
		zap.Int("revisionNumber", rendered.RevisionNumber))

	rendered.CompletedAt = &completedAt.Time
	
	query = `SELECT id, chart_id, is_success, dep_update_command, dep_update_stdout, dep_update_stderr, helm_template_command, helm_template_stdout, helm_template_stderr, created_at, completed_at FROM workspace_rendered_chart WHERE workspace_render_id = $1`
	
	logger.Debug("Executing second query for charts", 
		zap.String("id", id),
		zap.String("workspaceID", rendered.WorkspaceID))
		
	rows, err := conn.Query(ctx, query, id)
	if err != nil {
		logger.Error(fmt.Errorf("failed to query rendered charts: %w", err),
			zap.String("id", id),
			zap.String("workspaceID", rendered.WorkspaceID))
		return nil, fmt.Errorf("failed to get rendered charts: %w", err)
	}
	
	logger.Debug("Successfully executed charts query", 
		zap.String("id", id),
		zap.String("workspaceID", rendered.WorkspaceID))
		
	defer rows.Close()

	rowCount := 0
	logger.Debug("Starting to iterate through rendered chart rows", 
		zap.String("id", id))
		
	for rows.Next() {
		rowCount++
		logger.Debug("Processing chart row", 
			zap.String("id", id),
			zap.Int("rowNumber", rowCount))
			
		var renderedChart types.RenderedChart

		var depUpdateCommand sql.NullString
		var depUpdateStdout sql.NullString
		var depUpdateStderr sql.NullString
		var helmTemplateCommand sql.NullString
		var helmTemplateStdout sql.NullString
		var helmTemplateStderr sql.NullString

		var completedAt sql.NullTime

		logger.Debug("About to scan chart row", 
			zap.String("id", id),
			zap.Int("rowNumber", rowCount))
			
		if err := rows.Scan(&renderedChart.ID, &renderedChart.ChartID, &renderedChart.IsSuccess, &depUpdateCommand, &depUpdateStdout, &depUpdateStderr, &helmTemplateCommand, &helmTemplateStdout, &helmTemplateStderr, &renderedChart.CreatedAt, &completedAt); err != nil {
			logger.Error(fmt.Errorf("failed to scan chart row: %w", err),
				zap.String("id", id),
				zap.Int("rowNumber", rowCount))
			return nil, fmt.Errorf("failed to get rendered chart: %w", err)
		}
		
		logger.Debug("Successfully scanned chart row", 
			zap.String("id", id),
			zap.String("chartID", renderedChart.ChartID),
			zap.Int("rowNumber", rowCount))

		renderedChart.DepupdateCommand = depUpdateCommand.String
		renderedChart.DepupdateStdout = depUpdateStdout.String
		renderedChart.DepupdateStderr = depUpdateStderr.String
		renderedChart.HelmTemplateCommand = helmTemplateCommand.String
		renderedChart.HelmTemplateStdout = helmTemplateStdout.String
		renderedChart.HelmTemplateStderr = helmTemplateStderr.String
		renderedChart.CompletedAt = &completedAt.Time

		rendered.Charts = append(rendered.Charts, renderedChart)
		logger.Debug("Added chart to rendered object", 
			zap.String("id", id),
			zap.String("chartID", renderedChart.ChartID),
			zap.Int("currentChartCount", len(rendered.Charts)))
	}

	logger.Debug("Completed processing all chart rows", 
		zap.String("id", id),
		zap.Int("totalRowsProcessed", rowCount),
		zap.Int("finalChartCount", len(rendered.Charts)))

	return &rendered, nil
}

func FinishRenderedChart(ctx context.Context, renderedChartID string, depupdateCommand string, depupdateStdout string, depupdateStderr string, helmTemplateCommand string, helmTemplateStdout string, helmTemplateStderr string, isSuccess bool) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `
		UPDATE workspace_rendered_chart
		SET dep_update_command = $2, dep_update_stdout = $3, dep_update_stderr = $4, helm_template_command = $5, helm_template_stdout = $6, helm_template_stderr = $7, completed_at = now(), is_success = $8
		WHERE id = $1`

	_, err := conn.Exec(ctx, query, renderedChartID, depupdateCommand, depupdateStdout, depupdateStderr, helmTemplateCommand, helmTemplateStdout, helmTemplateStderr, isSuccess)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart: %w", err)
	}

	return nil
}

func SetRenderedChartDepUpdateCommand(ctx context.Context, renderedChartID string, depUpdateCommand string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET dep_update_command = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, renderedChartID, depUpdateCommand)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart depUpdateCommand: %w", err)
	}

	return nil
}

func SetRenderedChartDepUpdateStdout(ctx context.Context, renderedChartID string, depUpdateStdout string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET dep_update_stdout = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, renderedChartID, depUpdateStdout)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart depUpdateStdout: %w", err)
	}

	return nil
}

func SetRenderedChartDepUpdateStderr(ctx context.Context, renderedChartID string, depUpdateStderr string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET dep_update_stderr = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, renderedChartID, depUpdateStderr)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart depUpdateStderr: %w", err)
	}

	return nil
}

func SetRenderedChartHelmTemplateCommand(ctx context.Context, renderedChartID string, helmTemplateCommand string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET helm_template_command = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, renderedChartID, helmTemplateCommand)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart helmTemplateCommand: %w", err)
	}

	return nil
}

func SetRenderedChartHelmTemplateStdout(ctx context.Context, renderedChartID string, helmTemplateStdout string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET helm_template_stdout = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, renderedChartID, helmTemplateStdout)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart helmTemplateStdout: %w", err)
	}

	return nil
}

func SetRenderedFileContents(ctx context.Context, workspaceID string, revisionNumber int, filePath string, renderedContent string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// get the file id from the workspace_file table
	query := `SELECT id FROM workspace_file WHERE workspace_id = $1 AND revision_number = $2 AND file_path = $3`
	var fileID string
	err := conn.QueryRow(ctx, query, workspaceID, revisionNumber, filePath).Scan(&fileID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil // this happend if we have a rendered file that doesn't exist in the workspace (deps)_
		}
		return fmt.Errorf("failed to get file id: %w", err)
	}

	query = `INSERT INTO workspace_rendered_file (file_id, workspace_id, revision_number, file_path, content) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (file_id, workspace_id, revision_number) DO UPDATE SET content = $5`
	_, err = conn.Exec(ctx, query, fileID, workspaceID, revisionNumber, filePath, renderedContent)
	if err != nil {
		return fmt.Errorf("failed to insert rendered file: %w", err)
	}

	return nil
}

func SetRenderedChartHelmTemplateStderr(ctx context.Context, renderedChartID string, helmTemplateStderr string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_rendered_chart SET helm_template_stderr = $2 WHERE id = $1`
	_, err := conn.Exec(ctx, query, renderedChartID, helmTemplateStderr)
	if err != nil {
		return fmt.Errorf("failed to update rendered chart helmTemplateStderr: %w", err)
	}

	return nil
}

func EnqueueRenderWorkspaceForRevisionWithPendingContent(ctx context.Context, workspaceID string, revisionNumber int, chatMessageID string) error {
	logger.Info("EnqueueRenderWorkspaceForRevisionWithPendingContent",
		zap.String("workspaceID", workspaceID),
		zap.Int("revisionNumber", revisionNumber),
		zap.String("chatMessageID", chatMessageID),
	)

	return enqueueRenderWorkspaceForRevision(ctx, workspaceID, revisionNumber, chatMessageID, true)
}

func EnqueueRenderWorkspaceForRevision(ctx context.Context, workspaceID string, revisionNumber int, chatMessageID string) error {
	logger.Info("EnqueueRenderWorkspaceForRevision",
		zap.String("workspaceID", workspaceID),
		zap.Int("revisionNumber", revisionNumber),
		zap.String("chatMessageID", chatMessageID),
	)

	return enqueueRenderWorkspaceForRevision(ctx, workspaceID, revisionNumber, chatMessageID, false)
}

func enqueueRenderWorkspaceForRevision(ctx context.Context, workspaceID string, revisionNumber int, chatMessageID string, usePendingContent bool) error {
	// Get workspace to retrieve charts
	w, err := GetWorkspace(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// First check if we already have a render job associated with this chat message
	// This prevents duplicate renders for the same chat message
	if chatMessageID != "" {
		query := `SELECT COUNT(*) FROM workspace_chat
			WHERE id = $1 AND response_render_id IS NOT NULL`
		var chatCount int
		err = conn.QueryRow(ctx, query, chatMessageID).Scan(&chatCount)
		if err != nil {
			return fmt.Errorf("failed to check for existing render job on chat message: %w", err)
		}

		// Skip if this chat message already has a render job
		if chatCount > 0 {
			logger.Info("Chat message already has a render job, skipping",
				zap.String("chatMessageID", chatMessageID),
				zap.String("workspaceID", workspaceID),
				zap.Int("revisionNumber", revisionNumber))
			return nil
		}
	}

	// Check if there's already a render job in progress for this revision
	query := `SELECT COUNT(*) FROM workspace_rendered
	         WHERE workspace_id = $1 AND revision_number = $2 AND completed_at IS NULL`
	var count int
	err = conn.QueryRow(ctx, query, workspaceID, revisionNumber).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check for existing render jobs: %w", err)
	}

	// Skip if there's already a render job in progress
	if count > 0 {
		logger.Info("Render job already in progress for this revision, skipping",
			zap.String("workspaceID", workspaceID),
			zap.Int("revisionNumber", revisionNumber))
		return nil
	}

	id, err := securerandom.Hex(6)
	if err != nil {
		return fmt.Errorf("failed to generate id: %w", err)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query = `INSERT INTO workspace_rendered (id, workspace_id, revision_number, created_at, is_autorender) VALUES ($1, $2, $3, now(), $4)`
	_, err = tx.Exec(ctx, query, id, workspaceID, revisionNumber, usePendingContent)
	if err != nil {
		return fmt.Errorf("failed to enqueue render workspace: %w", err)
	}

	for _, chart := range w.Charts {
		renderedChartID, err := securerandom.Hex(6)
		if err != nil {
			return fmt.Errorf("failed to generate rendered chart id: %w", err)
		}

		query := `INSERT INTO workspace_rendered_chart (id, workspace_render_id, chart_id, is_success, created_at) VALUES ($1, $2, $3, $4, now())`
		_, err = tx.Exec(ctx, query, renderedChartID, id, chart.ID, false)
		if err != nil {
			return fmt.Errorf("failed to enqueue render workspace: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Only update chat message if an ID was provided (not system-triggered)
	if chatMessageID != "" {
		query = `UPDATE workspace_chat SET response_render_id = $1 WHERE id = $2`
		_, err = conn.Exec(ctx, query, id, chatMessageID)
		if err != nil {
			return fmt.Errorf("failed to update chat message: %w", err)
		}
	}

	if err := persistence.EnqueueWork(ctx, "render_workspace", map[string]interface{}{
		"id":                id,
		"usePendingContent": usePendingContent,
	}); err != nil {
		return fmt.Errorf("failed to enqueue render workspace: %w", err)
	}

	return nil
}

func EnqueueRenderWorkspace(ctx context.Context, workspaceID string, chatMessageID string) error {
	w, err := GetWorkspace(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	return EnqueueRenderWorkspaceForRevision(ctx, workspaceID, w.CurrentRevision, chatMessageID)
}