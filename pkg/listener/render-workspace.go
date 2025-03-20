package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	helmutils "github.com/replicatedhq/chartsmith/helm-utils"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type renderWorkspacePayload struct {
	ID                    string `json:"id"`
	WorkspaceID           string `json:"workspaceId"`
	RevisionNumber        int    `json:"revisionNumber"`
	ChatMessageID         string `json:"chatMessageId"`
	IncludePendingPatches *bool  `json:"includePendingPatches"`
}

// ensureActiveConnection performs a lightweight operation to ensure database connection is alive
func ensureActiveConnection(ctx context.Context) error {
	// Get a fresh connection and perform a simple query to verify connectivity
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	// Perform a simple ping-like query
	var result int
	err := conn.QueryRow(ctx, "SELECT 1").Scan(&result)
	if err != nil {
		return fmt.Errorf("database connection check failed: %w", err)
	}

	if result != 1 {
		return fmt.Errorf("unexpected result from connection check: %d", result)
	}

	return nil
}

func handleRenderWorkspaceNotification(ctx context.Context, payload string) error {
	startTime := time.Now()
	
	// Create a timeout context to ensure we don't hang indefinitely
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	
	// Verify connection is active before proceeding
	if err := ensureActiveConnection(timeoutCtx); err != nil {
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
	
	logger.Info("Successfully parsed render payload",
		zap.String("id", p.ID),
		zap.String("workspaceID", p.WorkspaceID),
		zap.Int("revisionNumber", p.RevisionNumber),
		zap.String("chatMessageID", p.ChatMessageID),
	)

	// Handle request from TypeScript side with workspaceId and revisionNumber
	if p.ID == "" && p.WorkspaceID != "" && p.RevisionNumber > 0 {
		// Create a new render job for this workspace/revision
		chatMessageID := p.ChatMessageID // Use the provided chat message ID
		logger.Info("Handling render request from TypeScript",
			zap.String("workspaceID", p.WorkspaceID),
			zap.Int("revisionNumber", p.RevisionNumber),
			zap.String("chatMessageID", chatMessageID))

		if err := workspace.EnqueueRenderWorkspaceForRevision(ctx, p.WorkspaceID, p.RevisionNumber, chatMessageID); err != nil {
			return fmt.Errorf("failed to enqueue render job from TS request: %w", err)
		}
		return nil
	}

	// Traditional flow with existing render job ID
	logger.Info("Fetching existing render job",
		zap.String("renderID", p.ID),
	)
	
	renderedWorkspace, err := workspace.GetRendered(timeoutCtx, p.ID)
	if err != nil {
		logger.Error(fmt.Errorf("failed to get rendered: %w", err),
			zap.String("renderID", p.ID))
		return fmt.Errorf("failed to get rendered job with ID %s: %w", p.ID, err)
	}
	
	logger.Info("Successfully retrieved render job",
		zap.String("renderID", p.ID),
		zap.String("workspaceID", renderedWorkspace.WorkspaceID),
		zap.Int("chartCount", len(renderedWorkspace.Charts)),
	)

	logger.Info("Fetching workspace",
		zap.String("workspaceID", renderedWorkspace.WorkspaceID),
	)
	
	w, err := workspace.GetWorkspace(timeoutCtx, renderedWorkspace.WorkspaceID)
	if err != nil {
		logger.Error(fmt.Errorf("failed to get workspace: %w", err),
			zap.String("workspaceID", renderedWorkspace.WorkspaceID))
		return fmt.Errorf("failed to get workspace for render: %w", err)
	}
	
	logger.Info("Successfully retrieved workspace",
		zap.String("workspaceID", w.ID),
		zap.Int("chartCount", len(w.Charts)),
		zap.Int("fileCount", len(w.Files)),
	)

	// we need to render each chart in separate goroutines
	// and create a sync group to wait for them all to complete
	wg := sync.WaitGroup{}
	
	// Count of charts being rendered
	chartCount := len(renderedWorkspace.Charts)
	logger.Info("Preparing to render charts",
		zap.Int("chartCount", chartCount),
	)

	for _, chart := range renderedWorkspace.Charts {
		wg.Add(1)
		go func(chart workspacetypes.RenderedChart) {
			defer wg.Done()

			includePendingPatches := p.IncludePendingPatches != nil && *p.IncludePendingPatches

			if err := renderChart(ctx, &chart, renderedWorkspace, w, includePendingPatches); err != nil {
				logger.Error(err)
			}
		}(chart)
	}

	logger.Info("Waiting for all chart renders to complete...",
		zap.Int("pendingCharts", chartCount),
		zap.String("renderID", renderedWorkspace.ID),
	)
	
	// Create a timeout for waiting on goroutines
	waitDone := make(chan struct{})
	go func() {
		wg.Wait()
		close(waitDone)
	}()
	
	// Wait for either completion or timeout
	select {
	case <-waitDone:
		logger.Info("All chart renders completed successfully", 
			zap.String("renderID", renderedWorkspace.ID),
			zap.Duration("duration", time.Since(startTime)),
		)
	case <-timeoutCtx.Done():
		logger.Error(fmt.Errorf("timeout waiting for chart renders to complete"),
			zap.String("renderID", renderedWorkspace.ID),
			zap.Duration("elapsedTime", time.Since(startTime)),
		)
		return fmt.Errorf("timeout waiting for chart renders to complete")
	}

	logger.Info("Finalizing render job",
		zap.String("renderID", renderedWorkspace.ID),
	)
	
	if err := workspace.FinishRendered(timeoutCtx, renderedWorkspace.ID); err != nil {
		logger.Error(fmt.Errorf("failed to finish rendered workspace: %w", err),
			zap.String("renderID", renderedWorkspace.ID))
		return fmt.Errorf("failed to finish rendered workspace: %w", err)
	}

	logger.Info("Render job completed successfully",
		zap.String("renderID", renderedWorkspace.ID),
		zap.Duration("totalDuration", time.Since(startTime)),
	)
	
	return nil
}

func renderChart(ctx context.Context, renderedChart *workspacetypes.RenderedChart, renderedWorkspace *workspacetypes.Rendered, w *workspacetypes.Workspace, includePendingPatches bool) error {
	startTime := time.Now()
	
	// Create a timeout context to ensure the chart render doesn't hang
	timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	
	logger.Info("Starting chart render",
		zap.String("chartID", renderedChart.ChartID),
		zap.String("workspaceID", renderedWorkspace.WorkspaceID),
		zap.Time("startTime", startTime),
		zap.Bool("includePendingPatches", includePendingPatches))

	var chart *workspacetypes.Chart
	for _, c := range w.Charts {
		if c.ID == renderedChart.ChartID {
			chart = &c
			break
		}
	}

	if chart == nil {
		logger.Error(fmt.Errorf("chart not found"),
			zap.String("chartID", renderedChart.ChartID),
			zap.String("workspaceID", w.ID))
		return fmt.Errorf("chart ID %s not found in workspace %s", renderedChart.ChartID, w.ID)
	}
	
	logger.Info("Found chart in workspace",
		zap.String("chartID", chart.ID),
		zap.String("chartName", chart.Name),
		zap.Int("fileCount", len(chart.Files)))

	userIDs, err := workspace.ListUserIDsForWorkspace(timeoutCtx, w.ID)
	if err != nil {
		logger.Error(fmt.Errorf("failed to list user IDs for workspace: %w", err),
			zap.String("workspaceID", w.ID))
		return fmt.Errorf("failed to list user IDs for workspace: %w", err)
	}
	
	logger.Info("Retrieved user IDs for workspace",
		zap.String("workspaceID", w.ID),
		zap.Int("userCount", len(userIDs)))

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
	go func(includePendingPatches bool) {
		files := chart.Files

		err := helmutils.RenderChartExec(files, "", renderChannels)
		if err != nil {
			done <- err
			return
		}

		done <- nil
	}(includePendingPatches)

	workspaceFiles, err := workspace.ListFiles(ctx, w.ID, renderedWorkspace.RevisionNumber, chart.ID)
	if err != nil {
		return fmt.Errorf("failed to list files: %w", err)
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

					fmt.Printf("sending render file event: %+v\n", e)
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

			logger.Debug("new rendered file", zap.String("path", path), zap.String("id", renderedFile.ID))

			*renderedFiles = append(*renderedFiles, renderedFile)
			updatedFiles = append(updatedFiles, renderedFile)
		}
	}

	return updatedFiles, nil
}
