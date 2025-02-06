package listener

import (
	"context"
	"fmt"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func sendExecuteActionNotification(ctx context.Context, planID string, path string) error {
	notifyConn := persistence.MustGeUunpooledPostgresSession()
	defer notifyConn.Close(ctx)

	// Insert into queue with just the required fields
	if _, err := notifyConn.Exec(ctx, `
		INSERT INTO action_queue (plan_id, path, created_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (plan_id, path) DO NOTHING
	`, planID, path); err != nil {
		return fmt.Errorf("failed to queue action: %w", err)
	}

	// Notify to wake up any sleeping workers
	if _, err := notifyConn.Exec(ctx, `
		SELECT pg_notify('execute_action', 'new')
	`); err != nil {
		return fmt.Errorf("failed to send execute action notification: %w", err)
	}
	return nil
}

func handleExecutePlanNotification(ctx context.Context, planID string) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var processingErr error
	defer func() {
		var errorMsg *string
		if processingErr != nil {
			errStr := processingErr.Error()
			errorMsg = &errStr
		}

		_, updateErr := conn.Exec(ctx, `
            UPDATE notification_processing
            SET processed_at = NOW(),
                error = $1
            WHERE notification_channel = $2 and notification_id = $3
        `, errorMsg, "execute_plan", planID)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling execute plan notification: %s\n", planID)

	plan, err := workspace.GetPlan(ctx, nil, planID)
	if err != nil {
		return fmt.Errorf("error getting plan: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, plan.WorkspaceID)
	if err != nil {
		return fmt.Errorf("error getting workspace: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error getting user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	if err := workspace.UpdatePlanStatus(ctx, plan.ID, workspacetypes.PlanStatusApplying); err != nil {
		return fmt.Errorf("error updating plan status: %w", err)
	}

	plan.Status = workspacetypes.PlanStatusApplying

	e := realtimetypes.PlanUpdatedEvent{
		WorkspaceID: w.ID,
		Plan:        plan,
	}
	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send plan update: %w", err)
	}

	detailedPlanStreamCh := make(chan string, 1)
	detailedPlanActionCreatedCh := make(chan llmtypes.ActionPlanWithPath, 1)
	detailedPlanDoneCh := make(chan error, 1)
	go func() {
		expandedPrompt, err := llm.ExpandPrompt(ctx, plan.Description)
		if err != nil {
			detailedPlanDoneCh <- fmt.Errorf("failed to expand prompt: %w", err)
			return
		}
		relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(
			ctx,
			w,
			w.Charts[0].ID,
			w.CurrentRevision,
			expandedPrompt,
		)

		// make sure we only change 10 files max, and nothing lower than a 0.8 similarity score
		relevantFiles = relevantFiles[:10]
		finalRelevantFiles := []workspacetypes.File{}
		for _, file := range relevantFiles {
			if file.Similarity >= 0.8 {
				finalRelevantFiles = append(finalRelevantFiles, file.File)
			}
		}
		llm.CreateExecutePlan(ctx, detailedPlanActionCreatedCh, detailedPlanStreamCh, detailedPlanDoneCh, w, plan, &w.Charts[0], finalRelevantFiles)
	}()

	var buffer strings.Builder
	done := false
	for !done {
		select {
		case stream := <-detailedPlanStreamCh:
			// Trust the stream's spacing and just append
			buffer.WriteString(stream)

		case actionPlanWithPath := <-detailedPlanActionCreatedCh:
			// get the plan from the db again, using a tx to lock
			tx, err := conn.Begin(ctx)
			if err != nil {
				return fmt.Errorf("failed to begin transaction: %w", err)
			}
			defer tx.Rollback(ctx)

			currentPlan, err := workspace.GetPlan(ctx, tx, plan.ID)
			if err != nil {
				return fmt.Errorf("failed to get plan: %w", err)
			}
			if currentPlan.ActionFiles == nil {
				currentPlan.ActionFiles = []workspacetypes.ActionFile{}
			}

			actionFile := workspacetypes.ActionFile{
				Action: actionPlanWithPath.Action,
				Path:   actionPlanWithPath.Path,
				Status: string(llmtypes.ActionPlanStatusPending),
			}
			currentPlan.ActionFiles = append(currentPlan.ActionFiles, actionFile)

			if err := workspace.UpdatePlanActionFiles(ctx, tx, currentPlan.ID, currentPlan.ActionFiles); err != nil {
				return fmt.Errorf("error updating plan action files: %w", err)
			}

			if err := tx.Commit(ctx); err != nil {
				return fmt.Errorf("failed to commit transaction: %w", err)
			}

			e := realtimetypes.PlanUpdatedEvent{
				WorkspaceID: w.ID,
				Plan:        currentPlan,
			}
			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send plan update: %w", err)
			}

			// Send notification with a separate connection
			if err := sendExecuteActionNotification(ctx, currentPlan.ID, actionPlanWithPath.Path); err != nil {
				return err
			}

		case err := <-detailedPlanDoneCh:
			if err != nil {
				return fmt.Errorf("error creating initial plan: %w", err)
			}

			done = true
		}
	}

	return nil
}
