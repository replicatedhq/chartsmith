package listener

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func handleNewPlanNotification(ctx context.Context, planID string) error {
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
        `, errorMsg, "new_plan", planID)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new plan notification: %s\n", planID)

	plan, err := workspace.GetPlan(ctx, planID)
	if err != nil {
		return fmt.Errorf("error getting plan: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, plan.WorkspaceID)
	if err != nil {
		return fmt.Errorf("error getting workspace: %w", err)
	}

	fmt.Printf("Handling new plan notification for workspace: %s, plan: %s\n", w.ID, plan.ID)

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error getting user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	streamCh := make(chan string)
	doneCh := make(chan error)
	go func() {
		doneCh <- llm.CreateInitialPlan(ctx, streamCh, doneCh, plan)
	}()

	for stream := range streamCh {
		plan.Description += stream
		e := realtimetypes.PlanUpdatedEvent{
			WorkspaceID: w.ID,
			Plan:        plan,
			IsComplete:  false,
		}

		if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
			return err
		}

		if err := workspace.AppendPlanDescription(ctx, plan.ID, stream); err != nil {
			return fmt.Errorf("error appending plan description: %w", err)
		}
	}

	err = <-doneCh
	if err != nil {
		return fmt.Errorf("error creating initial plan: %w", err)
	}

	// Advance the status of the plan so that the user can review it
	if err := workspace.UpdatePlanStatus(ctx, plan.ID, workspacetypes.PlanStatusReview); err != nil {
		return fmt.Errorf("error updating plan status: %w", err)
	}

	return nil
}
