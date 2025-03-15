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
	actionFound := false
	actionIndex := -1
	currentStatus := ""

	logger.Info("Looking for action in plan",
		zap.String("path", p.Path),
		zap.String("planId", p.PlanID),
		zap.Int("actionFilesCount", len(plan.ActionFiles)))

	for i, item := range plan.ActionFiles {
		if item.Path == p.Path {
			actionFound = true
			actionIndex = i
			currentStatus = item.Status

			logger.Info("Found action in plan",
				zap.String("path", p.Path),
				zap.String("planId", p.PlanID),
				zap.String("currentStatus", currentStatus),
				zap.Int("actionIndex", i))

			if item.Status != string(llmtypes.ActionPlanStatusPending) {
				logger.Info("Skipping non-pending action",
					zap.String("path", p.Path),
					zap.String("status", item.Status),
					zap.String("planId", p.PlanID))
				return nil // Skip instead of error
			}

			// update the action to creating
			logger.Info("Updating action status to creating",
				zap.String("path", p.Path),
				zap.String("planId", p.PlanID),
				zap.String("oldStatus", item.Status))

			item.Status = string(llmtypes.ActionPlanStatusCreating)
			plan.ActionFiles[i] = item
			break
		}
	}

	if !actionFound {
		logger.Error(fmt.Errorf("action not found in plan"),
			zap.String("path", p.Path),
			zap.String("planId", p.PlanID))
		return fmt.Errorf("action not found in plan for path %s", p.Path)
	}

	logger.Info("Updating plan action files in database",
		zap.String("path", p.Path),
		zap.String("planId", p.PlanID),
		zap.Int("actionIndex", actionIndex))

	if err := workspace.UpdatePlanActionFiles(ctx, tx, plan.ID, plan.ActionFiles); err != nil {
		logger.Error(fmt.Errorf("failed to update plan: %w", err),
			zap.String("path", p.Path),
			zap.String("planId", p.PlanID))
		return fmt.Errorf("failed to update plan: %w", err)
	}

	logger.Info("Committing transaction",
		zap.String("path", p.Path),
		zap.String("planId", p.PlanID))

	if err := tx.Commit(ctx); err != nil {
		logger.Error(fmt.Errorf("failed to commit transaction: %w", err),
			zap.String("path", p.Path),
			zap.String("planId", p.PlanID))
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	logger.Info("Transaction committed successfully, closing connection",
		zap.String("path", p.Path),
		zap.String("planId", p.PlanID))

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
	finalContentCh := make(chan string)
	errCh := make(chan error)

	go func() {
		logger.Info("Starting execute action goroutine",
			zap.String("path", p.Path),
			zap.String("planId", p.PlanID))

		action := ""

		for _, item := range plan.ActionFiles {
			if item.Path == p.Path {
				action = item.Action
				break
			}
		}

		// Log the action we're about to execute
		logger.Info("Executing action",
			zap.String("path", p.Path),
			zap.String("planId", p.PlanID),
			zap.String("actionLength", fmt.Sprintf("%d", len(action))))

		apwp := llmtypes.ActionPlanWithPath{
			ActionPlan: llmtypes.ActionPlan{
				Action: action,
				Type:   "file",
				Status: llmtypes.ActionPlanStatusPending,
			},
			Path: p.Path,
		}

		finalContent, err := llm.ExecuteAction(ctx, apwp, plan, currentContent, patchCh)
		if err != nil {
			logger.Error(fmt.Errorf("failed to execute action: %w", err),
				zap.String("path", p.Path),
				zap.String("planId", p.PlanID))
			errCh <- fmt.Errorf("failed to execute action: %w", err)
			return
		}

		logger.Info("Action execution successful",
			zap.String("path", p.Path),
			zap.String("planId", p.PlanID),
			zap.String("contentLength", fmt.Sprintf("%d", len(finalContent))))

		finalContentCh <- finalContent
		errCh <- nil
	}()

	timeout := time.After(5 * time.Minute)
	logger.Info("Starting response processing loop",
		zap.String("path", p.Path),
		zap.String("planId", p.PlanID))

	for {
		select {
		case <-timeout:
			logger.Error(fmt.Errorf("timeout waiting for action execution"),
				zap.String("path", p.Path),
				zap.String("planId", p.PlanID),
				zap.String("timeout", "5m"))
			return fmt.Errorf("timeout waiting for action execution")

		case err := <-errCh:
			if err != nil {
				logger.Error(fmt.Errorf("error received from action execution"),
					zap.Error(err),
					zap.String("path", p.Path),
					zap.String("planId", p.PlanID))
				return err
			}
			logger.Info("Received nil error signal",
				zap.String("path", p.Path),
				zap.String("planId", p.PlanID))

		case finalContent := <-finalContentCh:
			logger.Info("Received final content",
				zap.String("path", p.Path),
				zap.String("planId", p.PlanID),
				zap.String("contentLength", fmt.Sprintf("%d", len(finalContent))))

			if err := finalizeFile(ctx, finalContent, updatedPlan, p, w, c, realtimeRecipient); err != nil {
				logger.Error(fmt.Errorf("failed to finalize file: %w", err),
					zap.String("path", p.Path),
					zap.String("planId", p.PlanID))
				return err
			}
			return nil

		case patchContent := <-patchCh:
			logger.Info("Received patch update",
				zap.String("path", p.Path),
				zap.String("planId", p.PlanID),
				zap.String("patchLength", fmt.Sprintf("%d", len(patchContent))))

			if err := workspace.AddPendingPatch(ctx, updatedPlan.WorkspaceID, w.CurrentRevision, c.ID, p.Path, patchContent); err != nil {
				return fmt.Errorf("failed to create or patch file: %w", err)
			}

			if err := realtime.SendPatchesToWorkspace(ctx, updatedPlan.WorkspaceID, p.Path, currentContent, []string{patchContent}); err != nil {
				return fmt.Errorf("failed to send artifact update: %w", err)
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send artifact update: %w", err)
			}
		}
	}
}

func finalizeFile(ctx context.Context, finalContent string, updatedPlan *workspacetypes.Plan, p executeActionPayload, w *workspacetypes.Workspace, c workspacetypes.Chart, realtimeRecipient realtimetypes.Recipient) error {
	// update the action file to completed
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	finalUpdateTx, err := conn.Begin(ctx)
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

	e := realtimetypes.PlanUpdatedEvent{
		WorkspaceID: updatedPlan.WorkspaceID,
		Plan:        updatedPlan,
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
