package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type applyPlanPayload struct {
	PlanID string `json:"planId"`
}

// applyPlanLockKeyExtractor extracts the workspace ID from the apply plan payload
// This ensures we only process one plan at a time per workspace
func applyPlanLockKeyExtractor(payload []byte) (string, error) {
	var payloadMap map[string]interface{}
	if err := json.Unmarshal(payload, &payloadMap); err != nil {
		return "", fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	planID, ok := payloadMap["planId"].(string)
	if !ok || planID == "" {
		return "", fmt.Errorf("planId not found in payload or is not a string: %v", payloadMap)
	}

	// Get workspace ID from plan ID
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	plan, err := workspace.GetPlan(ctx, nil, planID)
	if err != nil {
		return "", fmt.Errorf("error getting workspace ID for plan: %w", err)
	}

	return plan.WorkspaceID, nil
}

// handleApplyPlanNotification handles a apply_plan notification by processing
// all action files for a plan in sequence
func handleApplyPlanNotification(ctx context.Context, payload string) error {
	logger.Info("New apply plan notification received", zap.String("payload", payload))

	// Parse the payload
	var p applyPlanPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// Get the plan
	plan, err := workspace.GetPlan(ctx, nil, p.PlanID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	// Get the workspace
	w, err := workspace.GetWorkspace(ctx, plan.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	// Update plan status to applying
	if err := workspace.UpdatePlanStatus(ctx, plan.ID, workspacetypes.PlanStatusApplying); err != nil {
		return fmt.Errorf("error updating plan status: %w", err)
	}

	// Get user IDs for realtime updates
	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, plan.WorkspaceID)
	if err != nil {
		return fmt.Errorf("error getting user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	// Update plan status in realtime
	plan.Status = workspacetypes.PlanStatusApplying
	e := realtimetypes.PlanUpdatedEvent{
		WorkspaceID: w.ID,
		Plan:        plan,
	}
	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send plan update: %w", err)
	}

	// Process each action file sequentially
	for i, actionFile := range plan.ActionFiles {
		// Skip already completed action files
		if actionFile.Status == string(llmtypes.ActionPlanStatusCreated) {
			continue
		}

		logger.Info("Processing action file",
			zap.String("path", actionFile.Path),
			zap.String("action", actionFile.Action),
			zap.Int("index", i),
			zap.Int("total", len(plan.ActionFiles)))

		// Update the action file status to creating
		if err := updateActionFileStatus(ctx, plan.ID, actionFile.Path, string(llmtypes.ActionPlanStatusCreating)); err != nil {
			return fmt.Errorf("failed to update action file status: %w", err)
		}

		// Get the updated plan for realtime updates
		updatedPlan, err := workspace.GetPlan(ctx, nil, plan.ID)
		if err != nil {
			return fmt.Errorf("failed to get updated plan: %w", err)
		}

		// Send realtime update
		e := realtimetypes.PlanUpdatedEvent{
			WorkspaceID: w.ID,
			Plan:        updatedPlan,
		}
		if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
			return fmt.Errorf("failed to send plan update: %w", err)
		}

		// Process the file
		if err := processActionFile(ctx, w, updatedPlan, actionFile, realtimeRecipient); err != nil {
			return fmt.Errorf("failed to process action file: %w", err)
		}
	}

	// First update the status
	if err := workspace.UpdatePlanStatus(ctx, plan.ID, workspacetypes.PlanStatusApplied); err != nil {
		return fmt.Errorf("failed to set plan status: %w", err)
	}

	if err := workspace.SetRevisionComplete(ctx, w.ID, w.CurrentRevision); err != nil {
		return fmt.Errorf("failed to mark revision as complete: %w", err)
	}

	// Get the final plan state
	finalPlan, err := workspace.GetPlan(ctx, nil, plan.ID)
	if err != nil {
		return fmt.Errorf("failed to get final plan: %w", err)
	}

	// Send final plan update
	finalEvent := realtimetypes.PlanUpdatedEvent{
		WorkspaceID: w.ID,
		Plan:        finalPlan,
	}
	if err := realtime.SendEvent(ctx, realtimeRecipient, finalEvent); err != nil {
		return fmt.Errorf("failed to send final plan update: %w", err)
	}

	// Create a render job for the completed revision
	if len(finalPlan.ChatMessageIDs) > 0 {
		chatMessageID := finalPlan.ChatMessageIDs[len(finalPlan.ChatMessageIDs)-1]
		if err := workspace.EnqueueRenderWorkspaceForRevisionWithPendingContent(
			ctx, finalPlan.WorkspaceID, w.CurrentRevision, chatMessageID); err != nil {
			return fmt.Errorf("failed to create render job for completed plan: %w", err)
		}
	} else {
		logger.Warn("No chat messages found for plan, skipping render association",
			zap.String("planID", finalPlan.ID))
	}

	return nil
}

// updateActionFileStatus updates the status of an action file in a plan
func updateActionFileStatus(ctx context.Context, planID, path, status string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	plan, err := workspace.GetPlan(ctx, tx, planID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	for i, item := range plan.ActionFiles {
		if item.Path == path {
			plan.ActionFiles[i].Status = status
			break
		}
	}

	if err := workspace.UpdatePlanActionFiles(ctx, tx, plan.ID, plan.ActionFiles); err != nil {
		return fmt.Errorf("failed to update plan: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// processActionFile processes a single action file for a plan
func processActionFile(ctx context.Context, w *workspacetypes.Workspace, plan *workspacetypes.Plan, actionFile workspacetypes.ActionFile, realtimeRecipient realtimetypes.Recipient) error {
	// Get chart and current content
	currentContent := ""
	var chartID string

	if len(w.Charts) > 0 {
		c := w.Charts[0]
		chartID = c.ID

		for _, file := range c.Files {
			if file.FilePath == actionFile.Path {
				currentContent = file.Content
				break
			}
		}
	} else {
		return fmt.Errorf("no charts found in workspace")
	}

	// Set up channels for content updates
	interimContentCh := make(chan string)
	finalContentCh := make(chan string)
	errCh := make(chan error)

	// Process the file in a goroutine
	go func() {
		apwp := llmtypes.ActionPlanWithPath{
			ActionPlan: llmtypes.ActionPlan{
				Action: actionFile.Action,
				Type:   "file",
				Status: llmtypes.ActionPlanStatusPending,
			},
			Path: actionFile.Path,
		}

		finalContent, err := llm.ExecuteAction(ctx, apwp, plan, currentContent, interimContentCh)
		if err != nil {
			errCh <- fmt.Errorf("failed to execute action: %w", err)
			return
		}

		finalContentCh <- finalContent
		errCh <- nil
	}()

	// Set up timeouts
	timeout := time.After(10 * time.Minute)
	noActivityTimeout := time.After(3 * time.Minute)
	lastActivity := time.Now()

	// Get the file from the workspace, if it exists
	files, err := workspace.ListFiles(ctx, w.ID, w.CurrentRevision, chartID)
	if err != nil {
		return fmt.Errorf("failed to list files: %w", err)
	}

	var file *workspacetypes.File
	for _, f := range files {
		if f.FilePath == actionFile.Path {
			file = &f
			break
		}
	}

	// Process updates until done
	for {
		select {
		case <-timeout:
			return fmt.Errorf("timeout waiting for action execution")

		case <-noActivityTimeout:
			// If we haven't heard from the LLM in 3 minutes, assume it's stalled
			if time.Since(lastActivity) > 3*time.Minute {
				return fmt.Errorf("LLM operation stalled - no activity for over 3 minutes")
			}
			// Reset the timer for next check
			noActivityTimeout = time.After(3 * time.Minute)

		case err := <-errCh:
			if err != nil {
				return err
			}

		case interimContent := <-interimContentCh:
			// Reset activity timer when we get content
			lastActivity = time.Now()
			noActivityTimeout = time.After(3 * time.Minute)

			if file == nil {
				// We need to create the file since we got content
				err := workspace.AddFileToChart(ctx, chartID, w.ID, w.CurrentRevision, actionFile.Path, "")
				if err != nil {
					return fmt.Errorf("failed to add file to chart: %w", err)
				}

				files, err := workspace.ListFiles(ctx, w.ID, w.CurrentRevision, chartID)
				if err != nil {
					return fmt.Errorf("failed to list files: %w", err)
				}

				for _, f := range files {
					if f.FilePath == actionFile.Path {
						file = &f
						break
					}
				}
			}

			if file == nil {
				return fmt.Errorf("file not found in workspace")
			}

			file.ContentPending = &interimContent

			e := realtimetypes.ArtifactUpdatedEvent{
				WorkspaceID:   w.ID,
				WorkspaceFile: file,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send artifact update: %w", err)
			}

		case finalContent := <-finalContentCh:
			// Save final content
			if err := workspace.SetFileContentPending(ctx, actionFile.Path, w.CurrentRevision, chartID, w.ID, finalContent); err != nil {
				return fmt.Errorf("failed to set file content pending: %w", err)
			}

			// Get or create the file reference if not already loaded
			if file == nil {
				files, err := workspace.ListFiles(ctx, w.ID, w.CurrentRevision, chartID)
				if err != nil {
					return fmt.Errorf("failed to list files: %w", err)
				}

				for _, f := range files {
					if f.FilePath == actionFile.Path {
						file = &f
						break
					}
				}
			}

			if file == nil {
				return fmt.Errorf("file not found after saving content")
			}

			// Update the file's content pending
			file.ContentPending = &finalContent

			// Send artifact updated event so UI updates immediately
			artifactEvent := realtimetypes.ArtifactUpdatedEvent{
				WorkspaceID:   w.ID,
				WorkspaceFile: file,
			}
			if err := realtime.SendEvent(ctx, realtimeRecipient, artifactEvent); err != nil {
				return fmt.Errorf("failed to send artifact update: %w", err)
			}

			// Update action file status
			if err := updateActionFileStatus(ctx, plan.ID, actionFile.Path, string(llmtypes.ActionPlanStatusCreated)); err != nil {
				return fmt.Errorf("failed to update action file status: %w", err)
			}

			// Send plan update
			updatedPlan, err := workspace.GetPlan(ctx, nil, plan.ID)
			if err != nil {
				return fmt.Errorf("failed to get updated plan: %w", err)
			}

			e := realtimetypes.PlanUpdatedEvent{
				WorkspaceID: w.ID,
				Plan:        updatedPlan,
			}
			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send plan update: %w", err)
			}

			return nil
		}
	}
}
