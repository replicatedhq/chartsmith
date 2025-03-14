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

type executeActionPayload struct {
	PlanID string `json:"planId"`
	Path   string `json:"path"`
}

func handleExecuteActionNotification(ctx context.Context, payload string) error {
	logger.Info("New execute action notification received", zap.String("payload", payload))

	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var p executeActionPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	plan, err := workspace.GetPlan(ctx, nil, p.PlanID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	// find the action, confirm it's still pending for now
	for i, item := range plan.ActionFiles {
		if item.Path == p.Path {
			if item.Status != string(llmtypes.ActionPlanStatusPending) {
				logger.Info("Skipping non-pending action", zap.String("path", p.Path), zap.String("status", item.Status), zap.String("planId", p.PlanID))
				return nil
			}

			// update the action to creating

			fmt.Printf("updating action file for path %s to creating\n", p.Path)
			item.Status = string(llmtypes.ActionPlanStatusCreating)

			plan.ActionFiles[i] = item

			break
		}
	}

	if err := workspace.UpdatePlanActionFiles(ctx, tx, plan.ID, plan.ActionFiles); err != nil {
		return fmt.Errorf("failed to update plan: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	conn.Close(ctx)

	w, err := workspace.GetWorkspace(ctx, plan.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	updatedPlan, err := workspace.GetPlan(ctx, nil, plan.ID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, updatedPlan.WorkspaceID)
	if err != nil {
		return fmt.Errorf("error getting user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	e := realtimetypes.PlanUpdatedEvent{
		WorkspaceID: updatedPlan.WorkspaceID,
		Plan:        updatedPlan,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send plan update: %w", err)
	}

	currentContent := ""
	c := w.Charts[0]
	for _, file := range c.Files {
		if file.FilePath == p.Path {
			currentContent = file.Content
			break
		}
	}

	patchCh := make(chan string)
	errCh := make(chan error)

	go func() {
		action := ""

		for _, item := range plan.ActionFiles {
			if item.Path == p.Path {
				action = item.Action
				break
			}
		}

		apwp := llmtypes.ActionPlanWithPath{
			ActionPlan: llmtypes.ActionPlan{
				Action: action,
				Type:   "file",
				Status: llmtypes.ActionPlanStatusPending,
			},
			Path: p.Path,
		}

		updatedContent, err := llm.ExecuteAction(ctx, apwp, plan, currentContent, patchCh)
		if err != nil {
			errCh <- fmt.Errorf("failed to execute action: %w", err)
		}

		patchCh <- updatedContent
		errCh <- nil
	}()

	done := false
	finalContent := ""
	timeout := time.After(5 * time.Minute)

	for !done {
		select {
		case <-timeout:
			fmt.Printf("Timeout reached for path: %s\n", p.Path)
			return fmt.Errorf("timeout waiting for action execution")
		case err := <-errCh:
			done = true
			if err != nil {
				return err
			}
		case finalContent = <-patchCh:
			// send the final content to the realtime server
			e := realtimetypes.ArtifactUpdatedEvent{
				WorkspaceID: updatedPlan.WorkspaceID,
				Artifact: realtimetypes.Artifact{
					RevisionNumber: w.CurrentRevision,
					Path:           p.Path,
					Content:        currentContent,
					PendingPatch:   finalContent,
				},
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send artifact update: %w", err)
			}
		}
	}

	// update the action file to completed
	conn2 := persistence.MustGeUunpooledPostgresSession()
	defer conn2.Close(ctx)
	finalUpdateTx, err := conn2.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer finalUpdateTx.Rollback(ctx)

	finalUpdatePlan, err := workspace.GetPlan(ctx, finalUpdateTx, updatedPlan.ID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	for i, item := range finalUpdatePlan.ActionFiles {
		if item.Path == p.Path {
			finalUpdatePlan.ActionFiles[i].Status = string(llmtypes.ActionPlanStatusCreated)
			break
		}
	}

	if err := workspace.UpdatePlanActionFiles(ctx, finalUpdateTx, finalUpdatePlan.ID, finalUpdatePlan.ActionFiles); err != nil {
		return fmt.Errorf("failed to update plan: %w", err)
	}

	if err := finalUpdateTx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// save the content of the file
	if err := workspace.CreateOrPatchFile(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision, c.ID, p.Path, finalContent); err != nil {
		return fmt.Errorf("failed to set file content in workspace: %w", err)
	}

	// send the updated plan to the realtime server
	e.Plan = finalUpdatePlan
	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send plan update: %w", err)
	}

	if finalUpdatePlan.IsComplete {
		// check if there are any pending actions in the queue that are incomplete
		pendingActionPaths, err := workspace.PendingActionPathsForPlan(ctx, finalUpdatePlan.ID)
		if err != nil {
			return fmt.Errorf("failed to list pending actions: %w", err)
		}

		countOtherPaths := 0
		for _, pap := range pendingActionPaths {
			if pap != p.Path {
				countOtherPaths++
			}
		}

		if countOtherPaths == 0 {
			// send the plan status as complete to the realtime server
			e.Plan.Status = workspacetypes.PlanStatusApplied

			if err := workspace.UpdatePlanStatus(ctx, finalUpdatePlan.ID, workspacetypes.PlanStatusApplied); err != nil {
				return fmt.Errorf("failed to set plan status: %w", err)
			}

			// Mark the revision as complete
			if err := workspace.SetRevisionComplete(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision); err != nil {
				return fmt.Errorf("failed to mark revision as complete: %w", err)
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send plan update: %w", err)
			}

			// trigger embeddings for the files in this workspace
			if err := workspace.NotifyWorkerToCaptureEmbeddings(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision); err != nil {
				return fmt.Errorf("failed to notify worker to capture embeddings: %w", err)
			}

			// Get the LAST chat message associated with this plan
			// This ensures we're associating the render with the most recent message
			var chatMessageID string
			if len(finalUpdatePlan.ChatMessageIDs) > 0 {
				chatMessageID = finalUpdatePlan.ChatMessageIDs[len(finalUpdatePlan.ChatMessageIDs)-1]

				// Log the chat message we're associating the render job with
				logger.Info("Associating render job with chat message",
					zap.String("chatMessageID", chatMessageID),
					zap.String("planID", finalUpdatePlan.ID),
					zap.Int("currentRevision", w.CurrentRevision))

				// Create a render job for the completed revision and associate it with the chat message
				if err := workspace.EnqueueRenderWorkspaceForRevision(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision, chatMessageID); err != nil {
					return fmt.Errorf("failed to create render job for completed plan: %w", err)
				}
			} else {
				logger.Warn("No chat messages found for plan, skipping render association",
					zap.String("planID", finalUpdatePlan.ID))
			}
		}
	}

	return nil
}
