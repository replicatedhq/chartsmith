package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	helmutils "github.com/replicatedhq/chartsmith/helm-utils"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type renderWorkspacePayload struct {
	ID                string `json:"id"`
	WorkspaceID       string `json:"workspaceId"`
	RevisionNumber    int    `json:"revisionNumber"`
	ChatMessageID     string `json:"chatMessageId"`
	UsePendingContent *bool  `json:"usePendingContent"`
}

// Note: ensureActiveConnection is now defined in heartbeat.go

func handleRenderWorkspaceNotification(ctx context.Context, payload string) error {
	startTime := time.Now()

	// Add panic recovery
	defer func() {
		if r := recover(); r != nil {
			err := fmt.Errorf("PANIC in handleRenderWorkspaceNotification: %v", r)
			logger.Error(err)
			logger.Error(fmt.Errorf("Stack trace (if available):\n%s", string(debug.Stack())))
		}
	}()

	// Create a timeout context to ensure we don't hang indefinitely
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute) // Increased timeout to 10 minutes
	defer cancel()

	// Use a separate shorter timeout just for the connection check
	connCheckCtx, connCheckCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer connCheckCancel()

	// Verify connection is active before proceeding
	if err := ensureActiveConnection(connCheckCtx); err != nil {
		logger.Error(fmt.Errorf("connection check failed before processing notification: %w", err))
		// Continue anyway, as we're using a fresh connection below
	}

	logger.Info("Processing render workspace notification",
		zap.String("payload", payload),
		zap.Time("startTime", startTime),
	)

	var p renderWorkspacePayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		logger.Error(fmt.Errorf("failed to unmarshal render workspace notification: %w", err),
			zap.String("payload", payload))
		return fmt.Errorf("failed to unmarshal render workspace notification: %w", err)
	}

	// Handle request from TypeScript side with workspaceId and revisionNumber
	if p.ID == "" && p.WorkspaceID != "" && p.RevisionNumber > 0 {
		// Create a new render job for this workspace/revision
		chatMessageID := p.ChatMessageID // Use the provided chat message ID
		if err := workspace.EnqueueRenderWorkspaceForRevision(ctx, p.WorkspaceID, p.RevisionNumber, chatMessageID); err != nil {
			return fmt.Errorf("failed to enqueue render job from TS request: %w", err)
		}
		return nil
	}

	renderedWorkspace, err := workspace.GetRendered(ctx, p.ID)

	if err != nil {
		logger.Error(fmt.Errorf("failed to get rendered: %w", err))
		if strings.Contains(err.Error(), "context deadline exceeded") ||
			strings.Contains(err.Error(), "context canceled") {
			logger.Error(fmt.Errorf("timeout fetching render job, marking as failed: %w", err),
				zap.String("renderID", p.ID))
			// Try to mark the render as failed and return
			workspace.FailRendered(context.Background(), p.ID, "Timeout fetching render data")
			return fmt.Errorf("timeout fetching render job: %w", err)
		}

		logger.Error(fmt.Errorf("failed to get rendered: %w", err),
			zap.String("renderID", p.ID))
		return fmt.Errorf("failed to get rendered job with ID %s: %w", p.ID, err)
	}

	logger.Info("Successfully retrieved render job",
		zap.String("renderID", p.ID),
		zap.String("workspaceID", renderedWorkspace.WorkspaceID),
		zap.Int("chartCount", len(renderedWorkspace.Charts)),
	)

	w, err := workspace.GetWorkspace(ctx, renderedWorkspace.WorkspaceID)
	if err != nil {
		if strings.Contains(err.Error(), "context deadline exceeded") ||
			strings.Contains(err.Error(), "context canceled") {
			logger.Error(fmt.Errorf("timeout fetching workspace, marking render as failed: %w", err),
				zap.String("workspaceID", renderedWorkspace.WorkspaceID))
			// Try to mark the render as failed and return
			workspace.FailRendered(context.Background(), p.ID, "Timeout fetching workspace data")
			return fmt.Errorf("timeout fetching workspace: %w", err)
		}

		logger.Error(fmt.Errorf("failed to get workspace: %w", err),
			zap.String("workspaceID", renderedWorkspace.WorkspaceID))
		return fmt.Errorf("failed to get workspace for render: %w", err)
	}

	// we need to render each chart in separate goroutines
	// and create a sync group to wait for them all to complete
	wg := sync.WaitGroup{}

	// Create error channel to collect errors from goroutines
	errorChan := make(chan error, len(renderedWorkspace.Charts))

	for _, chart := range renderedWorkspace.Charts {
		wg.Add(1)
		go func(chart workspacetypes.RenderedChart) {
			defer wg.Done()

			usePendingContent := p.UsePendingContent != nil && *p.UsePendingContent

			if err := renderChart(ctx, &chart, renderedWorkspace, w, usePendingContent); err != nil {
				logger.Error(err)
				errorChan <- err
			}
		}(chart)
	}

	// Create a timeout for waiting on goroutines - 8 minutes (keeping 2 minutes for finalization)
	renderTimeout := 8 * time.Minute
	renderTimeoutTimer := time.NewTimer(renderTimeout)
	defer renderTimeoutTimer.Stop()

	// Create a channel for completion
	waitDone := make(chan struct{})
	go func() {
		wg.Wait()
		close(waitDone)
	}()

	// Wait for either completion, errors, or timeout
	select {
	case <-waitDone:
		logger.Info("All chart renders completed successfully",
			zap.String("renderID", renderedWorkspace.ID),
			zap.Duration("duration", time.Since(startTime)),
		)
	case err := <-errorChan:
		logger.Error(fmt.Errorf("chart render failed: %w", err),
			zap.String("renderID", renderedWorkspace.ID),
			zap.Duration("elapsedTime", time.Since(startTime)),
		)
		// Mark the render as failed
		workspace.FailRendered(context.Background(), renderedWorkspace.ID, err.Error())
		return fmt.Errorf("chart render failed: %w", err)
	case <-renderTimeoutTimer.C:
		logger.Error(fmt.Errorf("timeout waiting for chart renders to complete"),
			zap.String("renderID", renderedWorkspace.ID),
			zap.Duration("elapsedTime", time.Since(startTime)),
			zap.Duration("timeout", renderTimeout),
		)
		// Mark the render as failed
		workspace.FailRendered(context.Background(), renderedWorkspace.ID, "Render operation timed out")
		return fmt.Errorf("timeout waiting for chart renders to complete")
	case <-timeoutCtx.Done():
		logger.Error(fmt.Errorf("context canceled during render operation"),
			zap.String("renderID", renderedWorkspace.ID),
			zap.Duration("elapsedTime", time.Since(startTime)),
		)
		// Mark the render as failed
		workspace.FailRendered(context.Background(), renderedWorkspace.ID, "Context canceled during render")
		return fmt.Errorf("context canceled during render operation")
	}

	// Create a new timeout context for the final database operation
	finishCtx, finishCancel := context.WithTimeout(ctx, 30*time.Second)
	defer finishCancel()

	if err := workspace.FinishRendered(finishCtx, renderedWorkspace.ID); err != nil {
		if strings.Contains(err.Error(), "context deadline exceeded") ||
			strings.Contains(err.Error(), "context canceled") {
			logger.Error(fmt.Errorf("timeout finalizing render: %w", err),
				zap.String("renderID", renderedWorkspace.ID))
			// Try one more time with a background context
			if finalErr := workspace.FinishRendered(context.Background(), renderedWorkspace.ID); finalErr != nil {
				logger.Error(fmt.Errorf("final attempt to finish render failed: %w", finalErr),
					zap.String("renderID", renderedWorkspace.ID))
				return fmt.Errorf("timeout finalizing render: %w", err)
			}
		} else {
			logger.Error(fmt.Errorf("failed to finish rendered workspace: %w", err),
				zap.String("renderID", renderedWorkspace.ID))
			return fmt.Errorf("failed to finish rendered workspace: %w", err)
		}
	}

	return nil
}

func renderChart(ctx context.Context, renderedChart *workspacetypes.RenderedChart, renderedWorkspace *workspacetypes.Rendered, w *workspacetypes.Workspace, usePendingContent bool) error {
	// Add panic recovery
	defer func() {
		if r := recover(); r != nil {
			logger.Error(fmt.Errorf("PANIC in renderChart: %v", r))
			logger.Error(fmt.Errorf("Stack trace (if available):\n%s", string(debug.Stack())))
		}
	}()

	var chart *workspacetypes.Chart
	for _, c := range w.Charts {
		if c.ID == renderedChart.ChartID {
			chart = &c
			break
		}
	}

	if chart == nil {
		err := fmt.Errorf("chart ID %s not found in workspace %s", renderedChart.ChartID, w.ID)
		logger.Error(err,
			zap.String("chartID", renderedChart.ChartID),
			zap.String("workspaceID", w.ID))

		// Update the rendered chart to mark it as failed
		workspace.FinishRenderedChart(context.Background(), renderedChart.ID,
			"", "", "", "", "",
			fmt.Sprintf("Chart not found: %s", renderedChart.ChartID), false)

		return err
	}

	// Create a shorter timeout for database operations
	dbCtx, dbCancel := context.WithTimeout(ctx, 30*time.Second)
	defer dbCancel()

	userIDs, err := workspace.ListUserIDsForWorkspace(dbCtx, w.ID)
	if err != nil {
		// Check for timeout or cancellation
		if strings.Contains(err.Error(), "context deadline exceeded") ||
			strings.Contains(err.Error(), "context canceled") {
			err = fmt.Errorf("timeout listing user IDs for workspace: %w", err)
		} else {
			err = fmt.Errorf("failed to list user IDs for workspace: %w", err)
		}

		logger.Error(err, zap.String("workspaceID", w.ID))

		// Update the rendered chart to mark it as failed
		workspace.FinishRenderedChart(context.Background(), renderedChart.ID,
			"", "", "", "", "",
			fmt.Sprintf("Database operation failed: %v", err), false)

		return err
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	renderChannels := helmutils.RenderChannels{
		DepUpdateCmd:       make(chan string, 1),
		DepUpdateStderr:    make(chan string, 1),
		DepUpdateStdout:    make(chan string, 1),
		HelmTemplateCmd:    make(chan string, 1),
		HelmTemplateStderr: make(chan string, 1),
		HelmTemplateStdout: make(chan string, 1),

		Done: make(chan error),
	}

	done := make(chan error)
	go func(usePendingContent bool) {
		files := chart.Files

		err := helmutils.RenderChartExec(files, "", renderChannels)
		if err != nil {
			done <- err
			return
		}
		done <- nil
	}(usePendingContent)

	// Create a new context just for database operations
	filesCtx, filesCancel := context.WithTimeout(ctx, 30*time.Second)
	defer filesCancel()

	workspaceFiles, err := workspace.ListFiles(filesCtx, w.ID, renderedWorkspace.RevisionNumber, chart.ID)
	if err != nil {
		// Check for timeout or cancellation
		if strings.Contains(err.Error(), "context deadline exceeded") ||
			strings.Contains(err.Error(), "context canceled") {
			err = fmt.Errorf("timeout listing files: %w", err)
		} else {
			err = fmt.Errorf("failed to list files: %w", err)
		}

		logger.Error(err)

		// Update the rendered chart to mark it as failed
		workspace.FinishRenderedChart(context.Background(), renderedChart.ID,
			"", "", "", "", "",
			fmt.Sprintf("Database operation failed: %v", err), false)

		return err
	}

	renderedFiles := []workspacetypes.RenderedFile{}

	for {
		select {
		case err := <-renderChannels.Done:
			isSuccess := true
			if err != nil {
				isSuccess = false
				logger.Errorf("Render error: %v", err)
			}

			if err := workspace.FinishRenderedChart(ctx, renderedChart.ID, renderedChart.DepupdateCommand, renderedChart.DepupdateStdout, renderedChart.DepupdateStderr, renderedChart.HelmTemplateCommand, renderedChart.HelmTemplateStdout, renderedChart.HelmTemplateStderr, isSuccess); err != nil {
				return fmt.Errorf("failed to finish rendered chart: %w", err)
			}

			now := time.Now()
			e := realtimetypes.RenderStreamEvent{
				WorkspaceID:         w.ID,
				RenderID:            renderedWorkspace.ID,
				RenderChartID:       renderedChart.ID,
				DepUpdateCommand:    renderedChart.DepupdateCommand,
				DepUpdateStdout:     renderedChart.DepupdateStdout,
				DepUpdateStderr:     renderedChart.DepupdateStderr,
				HelmTemplateCommand: renderedChart.HelmTemplateCommand,
				HelmTemplateStdout:  renderedChart.HelmTemplateStdout,
				HelmTemplateStderr:  renderedChart.HelmTemplateStderr,
				CompletedAt:         &now,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render stream event: %w", err)
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render stream event: %w", err)
			}

			updatedRenderedFiles, err := parseRenderedFiles(ctx, renderedChart.HelmTemplateStdout, chart.Name, &renderedFiles, workspaceFiles)
			if err != nil {
				return fmt.Errorf("failed to parse rendered files: %w", err)
			}

			for _, file := range updatedRenderedFiles {
				if file.ID != "" {
					e := realtimetypes.RenderFileEvent{
						WorkspaceID:   w.ID,
						RenderID:      renderedWorkspace.ID,
						RenderChartID: renderedChart.ID,
						RenderedFile:  file,
					}

					if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
						return fmt.Errorf("failed to send render updated event: %w", err)
					}
				}

				if err := workspace.SetRenderedFileContents(ctx, w.ID, renderedWorkspace.RevisionNumber, file.FilePath, file.RenderedContent); err != nil {
					return fmt.Errorf("failed to set rendered file contents: %w", err)
				}
			}

			return nil

		case depUpdateCommand := <-renderChannels.DepUpdateCmd:
			renderedChart.DepupdateCommand += depUpdateCommand

			e := realtimetypes.RenderStreamEvent{
				WorkspaceID:         w.ID,
				RenderID:            renderedWorkspace.ID,
				RenderChartID:       renderedChart.ID,
				DepUpdateCommand:    renderedChart.DepupdateCommand,
				DepUpdateStdout:     renderedChart.DepupdateStdout,
				DepUpdateStderr:     renderedChart.DepupdateStderr,
				HelmTemplateCommand: renderedChart.HelmTemplateCommand,
				HelmTemplateStdout:  renderedChart.HelmTemplateStdout,
				HelmTemplateStderr:  renderedChart.HelmTemplateStderr,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render stream event: %w", err)
			}

			if err := workspace.SetRenderedChartDepUpdateCommand(ctx, renderedChart.ID, renderedChart.DepupdateCommand); err != nil {
				return fmt.Errorf("failed to set rendered chart depUpdateCommand: %w", err)
			}

		case depUpdateStdout := <-renderChannels.DepUpdateStdout:
			renderedChart.DepupdateStdout += depUpdateStdout

			e := realtimetypes.RenderStreamEvent{
				WorkspaceID:         w.ID,
				RenderID:            renderedWorkspace.ID,
				RenderChartID:       renderedChart.ID,
				DepUpdateCommand:    renderedChart.DepupdateCommand,
				DepUpdateStdout:     renderedChart.DepupdateStdout,
				DepUpdateStderr:     renderedChart.DepupdateStderr,
				HelmTemplateCommand: renderedChart.HelmTemplateCommand,
				HelmTemplateStdout:  renderedChart.HelmTemplateStdout,
				HelmTemplateStderr:  renderedChart.HelmTemplateStderr,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render stream event: %w", err)
			}

			if err := workspace.SetRenderedChartDepUpdateStdout(ctx, renderedChart.ID, renderedChart.DepupdateStdout); err != nil {
				return fmt.Errorf("failed to set rendered chart depUpdateStdout: %w", err)
			}

		case depUpdateStderr := <-renderChannels.DepUpdateStderr:
			renderedChart.DepupdateStderr += depUpdateStderr

			e := realtimetypes.RenderStreamEvent{
				WorkspaceID:         w.ID,
				RenderChartID:       renderedChart.ID,
				RenderID:            renderedWorkspace.ID,
				DepUpdateCommand:    renderedChart.DepupdateCommand,
				DepUpdateStdout:     renderedChart.DepupdateStdout,
				DepUpdateStderr:     renderedChart.DepupdateStderr,
				HelmTemplateCommand: renderedChart.HelmTemplateCommand,
				HelmTemplateStdout:  renderedChart.HelmTemplateStdout,
				HelmTemplateStderr:  renderedChart.HelmTemplateStderr,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render stream event: %w", err)
			}

			if err := workspace.SetRenderedChartDepUpdateStderr(ctx, renderedChart.ID, renderedChart.DepupdateStderr); err != nil {
				return fmt.Errorf("failed to set rendered chart depUpdateStderr: %w", err)
			}

		case helmTemplateCommand := <-renderChannels.HelmTemplateCmd:
			renderedChart.HelmTemplateCommand += helmTemplateCommand

			e := realtimetypes.RenderStreamEvent{
				WorkspaceID:         w.ID,
				RenderID:            renderedWorkspace.ID,
				RenderChartID:       renderedChart.ID,
				DepUpdateCommand:    renderedChart.DepupdateCommand,
				DepUpdateStdout:     renderedChart.DepupdateStdout,
				DepUpdateStderr:     renderedChart.DepupdateStderr,
				HelmTemplateCommand: renderedChart.HelmTemplateCommand,
				HelmTemplateStdout:  renderedChart.HelmTemplateStdout,
				HelmTemplateStderr:  renderedChart.HelmTemplateStderr,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send render stream event: %w", err)
			}

			if err := workspace.SetRenderedChartHelmTemplateCommand(ctx, renderedChart.ID, renderedChart.HelmTemplateCommand); err != nil {
				return fmt.Errorf("failed to set rendered chart helmTemplateCommand: %w", err)
			}

		case helmTemplateStdout := <-renderChannels.HelmTemplateStdout:
			renderedChart.HelmTemplateStdout += helmTemplateStdout

			// it's intentional, we don't stream stdout to the client
			// b/c we instead stream the rendered files
			// so that we can display the ui in more useful ways

			// updatedRenderedFiles is the list of files that have changes in this call
			// not the entire list again.  this is the list we need to send to a client who might be watching
			updatedRenderedFiles, err := parseRenderedFiles(ctx, renderedChart.HelmTemplateStdout, chart.Name, &renderedFiles, workspaceFiles)
			if err != nil {
				return fmt.Errorf("failed to parse rendered files: %w", err)
			}

			for _, file := range updatedRenderedFiles {
				if file.ID != "" {
					e := realtimetypes.RenderFileEvent{
						WorkspaceID:   w.ID,
						RenderID:      renderedWorkspace.ID,
						RenderChartID: renderedChart.ID,
						RenderedFile:  file,
					}

					if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
						return fmt.Errorf("failed to send render updated event: %w", err)
					}
				}

				if err := workspace.SetRenderedFileContents(ctx, w.ID, renderedWorkspace.RevisionNumber, file.FilePath, file.RenderedContent); err != nil {
					return fmt.Errorf("failed to set rendered file contents: %w", err)
				}
			}

			if err := workspace.SetRenderedChartHelmTemplateStdout(ctx, renderedChart.ID, renderedChart.HelmTemplateStdout); err != nil {
				return fmt.Errorf("failed to set rendered chart helmTemplateStdout: %w", err)
			}

		case helmTemplateStderr := <-renderChannels.HelmTemplateStderr:
			renderedChart.HelmTemplateStderr += helmTemplateStderr
			if err := workspace.SetRenderedChartHelmTemplateStderr(ctx, renderedChart.ID, renderedChart.HelmTemplateStderr); err != nil {
				return fmt.Errorf("failed to set rendered chart helmTemplateStderr: %w", err)
			}
		}
	}
}

func parseRenderedFiles(ctx context.Context, stdout string, chartName string, renderedFiles *[]workspacetypes.RenderedFile, workspaceFiles []workspacetypes.File) ([]workspacetypes.RenderedFile, error) {
	// Add panic recovery
	defer func() {
		if r := recover(); r != nil {
			logger.Error(fmt.Errorf("PANIC in parseRenderedFiles: %v", r))
			logger.Error(fmt.Errorf("Stack trace (if available):\n%s", string(debug.Stack())))
		}
	}()
	if stdout == "" {
		return []workspacetypes.RenderedFile{}, nil
	}

	// Normalize the input by trimming any leading/trailing whitespace
	stdout = strings.TrimSpace(stdout)

	// If the file starts with ---, remove it to avoid an empty first document
	if strings.HasPrefix(stdout, "---") {
		stdout = strings.TrimPrefix(stdout, "---")
	}

	// Split the stdout into individual YAML documents
	documents := strings.Split(stdout, "\n---\n")

	updatedFiles := []workspacetypes.RenderedFile{}

	for _, doc := range documents {
		if strings.TrimSpace(doc) == "" {
			continue
		}

		lines := strings.Split(doc, "\n")
		if len(lines) == 0 {
			continue
		}

		pathLine := strings.TrimSpace(lines[0])
		if !strings.HasPrefix(pathLine, "# Source:") {
			continue
		}

		path := strings.TrimSpace(strings.TrimPrefix(pathLine, "# Source:"))

		// remove the chartName/ prefix from the path if it exists
		if strings.HasPrefix(path, chartName+"/") {
			path = strings.TrimPrefix(path, chartName+"/")
		}

		content := strings.Join(lines[1:], "\n")

		renderedFile := workspacetypes.RenderedFile{
			FilePath:        path,
			RenderedContent: content,
		}

		// Check if this file exists and has different content
		found := false
		for i, existing := range *renderedFiles {
			if existing.FilePath == path {
				found = true
				if existing.RenderedContent != content {
					// Content has changed, update it and add to updatedFiles
					(*renderedFiles)[i].RenderedContent = content
					renderedFile.ID = existing.ID
					updatedFiles = append(updatedFiles, renderedFile)
				}
				break
			}
		}

		if !found {
			// New file, add it to both lists
			// here we need to get the ID
			for _, workspaceFile := range workspaceFiles {
				if workspaceFile.FilePath == path {
					renderedFile.ID = workspaceFile.ID
					break
				}
			}

			*renderedFiles = append(*renderedFiles, renderedFile)
			updatedFiles = append(updatedFiles, renderedFile)
		}
	}

	return updatedFiles, nil
}
