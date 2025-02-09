package listener

import (
	"context"
	"fmt"

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

func HandleExecuteActionNotification(ctx context.Context, planID string, path string) error {
	logger.Info("New execute action notification received", zap.String("plan_id", planID), zap.String("path", path))

	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	plan, err := workspace.GetPlan(ctx, nil, planID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	// find the action, confirm it's still pending for now
	for i, item := range plan.ActionFiles {
		if item.Path == path {
			if item.Status != string(llmtypes.ActionPlanStatusPending) {
				return fmt.Errorf("action is not pending: %s", item.Status)
			}

			// update the action to creating

			fmt.Printf("updating action file for path %s to creating\n", path)
			item.Status = string(llmtypes.ActionPlanStatusCreating)

			plan.ActionFiles[i] = item

			break
		}
	}

	if err := workspace.UpdatePlanActionFiles(ctx, tx, planID, plan.ActionFiles); err != nil {
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

	updatedPlan, err := workspace.GetPlan(ctx, nil, planID)
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
		if file.FilePath == path {
			currentContent = file.Content
			break
		}
	}

	streamCh := make(chan string)
	doneCh := make(chan error)

	go func() {
		action := ""

		for _, item := range plan.ActionFiles {
			if item.Path == path {
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
			Path: path,
		}

		if err := llm.ExecuteAction(ctx, apwp, plan, currentContent, streamCh, doneCh); err != nil {
			logger.Error(fmt.Errorf("failed to execute action: %w", err))
		}
	}()

	done := false
	finalContent := ""
	for !done {
		select {
		case err = <-doneCh:
			fmt.Printf("doneCh received error: %+v\n", err)
			if err != nil {
				logger.Error(fmt.Errorf("failed to execute action: %w", err))
			}
			done = true
		case stream := <-streamCh:
			finalContent = stream

			// send the final content to the realtime server
			e := realtimetypes.ArtifactUpdatedEvent{
				WorkspaceID: updatedPlan.WorkspaceID,
				Artifact: realtimetypes.Artifact{
					RevisionNumber: w.CurrentRevision,
					Path:           path,
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
		if item.Path == path {
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
	if err := workspace.CreateOrPatchFile(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision, c.ID, path, finalContent); err != nil {
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
			if pap != path {
				countOtherPaths++
			}
		}

		if countOtherPaths == 0 {
			// send the plan status as complete to the realtime server
			e.Plan.Status = workspacetypes.PlanStatusApplied

			if err := workspace.UpdatePlanStatus(ctx, finalUpdatePlan.ID, workspacetypes.PlanStatusApplied); err != nil {
				return fmt.Errorf("failed to set plan status: %w", err)
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send plan update: %w", err)
			}

			// trigger embeddings for the files in this workspace
			if err := workspace.NotifyWorkerToCaptureEmbeddings(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision); err != nil {
				return fmt.Errorf("failed to notify worker to capture embeddings: %w", err)
			}
		}
	}

	return nil
}
