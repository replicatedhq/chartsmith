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
	"go.uber.org/zap"
)

func handleExecuteActionNotification(ctx context.Context, planID string, path string) error {
	logger.Info("Handling execute action notification", zap.String("planID", planID), zap.String("path", path))

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

	streamCh := make(chan string)
	doneCh := make(chan error)

	go func() {
		apwp := llmtypes.ActionPlanWithPath{
			ActionPlan: llmtypes.ActionPlan{
				Action: plan.ActionFiles[0].Action,
				Type:   "file",
				Status: llmtypes.ActionPlanStatusPending,
			},
			Path: plan.ActionFiles[0].Path,
		}
		if err := llm.ExecuteAction(ctx, apwp, plan, streamCh, doneCh); err != nil {
			logger.Error(fmt.Errorf("failed to execute action: %w", err))
		}
	}()

	done := false
	for !done {
		select {
		case err = <-doneCh:
			if err != nil {
				logger.Error(fmt.Errorf("failed to execute action: %w", err))
			}
			done = true
		case stream := <-streamCh:
			fmt.Printf("stream: %s\n", stream)
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

	// send the updated plan to the realtime server
	e.Plan = finalUpdatePlan
	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send plan update: %w", err)
	}

	return nil
}
