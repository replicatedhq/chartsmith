package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	helmutils "github.com/replicatedhq/chartsmith/helm-utils"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type renderWorkspacePayload struct {
	ID string `json:"id"`
}

func handleRenderWorkspaceNotification(ctx context.Context, payload string) error {
	logger.Info("Received render workspace notification",
		zap.String("payload", payload),
	)

	var p renderWorkspacePayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal render workspace notification: %w", err)
	}

	renderedWorkspace, err := workspace.GetRendered(ctx, p.ID)
	if err != nil {
		return fmt.Errorf("failed to get rendered: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, renderedWorkspace.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	// we need to render each chart in separate goroutines
	// and create a sync group to wait for them all to complete

	wg := sync.WaitGroup{}
	for _, chart := range renderedWorkspace.Charts {
		wg.Add(1)
		go func(chart workspacetypes.RenderedChart) {
			defer wg.Done()
			if err := renderChart(ctx, &chart, renderedWorkspace, w); err != nil {
				logger.Error(err)
			} else {
				logger.Info("Completed render chart",
					zap.String("chartID", chart.ChartID),
				)
			}
		}(chart)
	}

	wg.Wait()

	// now we mark the top render as completed
	logger.Info("Completed render workspace",
		zap.String("workspaceID", renderedWorkspace.WorkspaceID),
	)

	if err := workspace.FinishRendered(ctx, renderedWorkspace.ID); err != nil {
		return fmt.Errorf("failed to finish rendered workspace: %w", err)
	}

	return nil
}

func renderChart(ctx context.Context, renderedChart *workspacetypes.RenderedChart, renderedWorkspace *workspacetypes.Rendered, w *workspacetypes.Workspace) error {
	var chart *workspacetypes.Chart
	for _, c := range w.Charts {
		if c.ID == renderedChart.ChartID {
			chart = &c
			break
		}
	}

	if chart == nil {
		return fmt.Errorf("chart not found")
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("failed to list user IDs for workspace: %w", err)
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
	go func() {
		err := helmutils.RenderChartExec(chart.Files, "", renderChannels)
		if err != nil {
			done <- err
			return
		}

		done <- nil
	}()

	workspaceFiles, err := workspace.ListFiles(ctx, w.ID, renderedWorkspace.RevisionNumber, chart.ID)
	if err != nil {
		return fmt.Errorf("failed to list files: %w", err)
	}

	renderedFiles := []workspacetypes.RenderedFile{}

	for {
		select {
		case err := <-renderChannels.Done:
			logger.Debug("Received render done",
				zap.String("chartID", renderedChart.ChartID),
			)

			isSuccess := true
			if err != nil {
				isSuccess = false
			}

			if err := workspace.FinishRenderedChart(ctx, renderedChart.ID, renderedChart.DepupdateCommand, renderedChart.DepupdateStdout, renderedChart.DepupdateStderr, renderedChart.HelmTemplateCommand, renderedChart.HelmTemplateStdout, renderedChart.HelmTemplateStderr, isSuccess); err != nil {
				return fmt.Errorf("failed to finish rendered chart: %w", err)
			}

			updatedRenderedFiles, err := parseRenderedFiles(ctx, renderedChart.HelmTemplateStdout, chart.Name, &renderedFiles, workspaceFiles)
			if err != nil {
				return fmt.Errorf("failed to parse rendered files: %w", err)
			}

			for _, file := range updatedRenderedFiles {
				if file.ID != "" {
					e := realtimetypes.RenderFileEvent{
						WorkspaceID:       w.ID,
						RenderWorkspaceID: renderedWorkspace.ID,
						RenderChartID:     renderedChart.ID,
						RenderedFile:      file,
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
				RenderWorkspaceID:   renderedWorkspace.ID,
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
				RenderWorkspaceID:   renderedWorkspace.ID,
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
				RenderWorkspaceID:   renderedWorkspace.ID,
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
				RenderWorkspaceID:   renderedWorkspace.ID,
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

			// we can't keep up with the cli if we parse every line...  we will catch the tail here
			// in the done handler
			lineCount := strings.Count(renderedChart.HelmTemplateStdout, "\n")
			if lineCount%30 != 0 {
				continue
			}

			// updatedRenderedFiles is the list of files that have changes in this call
			// not the entire list again.  this is the list we need to send to a client who might be watching
			updatedRenderedFiles, err := parseRenderedFiles(ctx, renderedChart.HelmTemplateStdout, chart.Name, &renderedFiles, workspaceFiles)
			if err != nil {
				return fmt.Errorf("failed to parse rendered files: %w", err)
			}

			for _, file := range updatedRenderedFiles {
				if file.ID != "" {
					e := realtimetypes.RenderFileEvent{
						WorkspaceID:       w.ID,
						RenderWorkspaceID: renderedWorkspace.ID,
						RenderChartID:     renderedChart.ID,
						RenderedFile:      file,
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

			// logger.Debug("new rendered filefile", zap.String("path", path), zap.String("id", renderedFile.ID))

			*renderedFiles = append(*renderedFiles, renderedFile)
			updatedFiles = append(updatedFiles, renderedFile)
		}
	}

	return updatedFiles, nil
}
