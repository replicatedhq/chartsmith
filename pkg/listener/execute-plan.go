package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

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

type executePlanPayload struct {
	PlanID  string `json:"planId"`
	ModelID string `json:"modelId,omitempty"`
}

func handleExecutePlanNotification(ctx context.Context, payload string) error {
	logger.Info("Handling execute plan notification", zap.String("payload", payload))

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	var p executePlanPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	plan, err := workspace.GetPlan(ctx, nil, p.PlanID)
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
		expandedPrompt, err := llm.ExpandPrompt(ctx, plan.Description, p.ModelID)
		if err != nil {
			detailedPlanDoneCh <- fmt.Errorf("failed to expand prompt: %w", err)
			return
		}

		var chartID *string
		if len(w.Charts) > 0 {
			chartID = &w.Charts[0].ID
		}

		relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(
			ctx,
			w,
			workspace.WorkspaceFilter{
				ChartID: chartID,
			},
			w.CurrentRevision,
			expandedPrompt,
		)

		// make sure we only change 10 files max, and nothing lower than a 0.8 similarity score
		maxFiles := 10
		if len(relevantFiles) < maxFiles {
			maxFiles = len(relevantFiles)
		}
		relevantFiles = relevantFiles[:maxFiles]
		finalRelevantFiles := []workspacetypes.File{}
		for _, file := range relevantFiles {
			if file.Similarity >= 0.8 {
				finalRelevantFiles = append(finalRelevantFiles, file.File)
			}
		}
		llm.CreateExecutePlan(ctx, detailedPlanActionCreatedCh, detailedPlanStreamCh, detailedPlanDoneCh, w, plan, &w.Charts[0], finalRelevantFiles, p.ModelID)
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

			// We'll let the apply_plan handler process these actions later
			// No need to enqueue individual execute_action jobs

		case err := <-detailedPlanDoneCh:
			if err != nil {
				return fmt.Errorf("error creating initial plan: %w", err)
			}

			// Enqueue a single apply_plan job after all action files are collected
			// This is what starts the actual processing
			if err := persistence.EnqueueWork(ctx, "apply_plan", map[string]interface{}{
				"planId":  plan.ID,
				"modelId": p.ModelID,
			}); err != nil {
				return fmt.Errorf("failed to enqueue apply plan: %w", err)
			}

			done = true
		}
	}

	return nil
}