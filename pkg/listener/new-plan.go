package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/backend"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type newPlanPayload struct {
	PlanID              string                `json:"planId"`
	AdditionalFiles     []workspacetypes.File `json:"additionalFiles,omitempty"`
	UseSecureBuildImages bool                  `json:"useSecureBuildImages,omitempty"`
}

func handleNewPlanNotification(ctx context.Context, payload string) error {
	logger.Info("New plan notification received", zap.String("payload", payload))

	var p newPlanPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	logger.Info("Parsed new_plan payload",
		zap.String("planID", p.PlanID),
		zap.Bool("useSecureBuildImages", p.UseSecureBuildImages),
		zap.Int("additionalFilesCount", len(p.AdditionalFiles)))

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

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

	if err := workspace.UpdatePlanStatus(ctx, plan.ID, workspacetypes.PlanStatusPlanning); err != nil {
		return fmt.Errorf("error updating plan status: %w", err)
	}

	plan.Status = workspacetypes.PlanStatusPlanning

	streamCh := make(chan string, 1)
	doneCh := make(chan error, 1)
	go func() {
		if w.CurrentRevision == 0 {
			if err := createInitialPlan(ctx, streamCh, doneCh, w, plan, p.AdditionalFiles, p.UseSecureBuildImages); err != nil {
				fmt.Printf("Failed to create initial plan: %v\n", err)
				doneCh <- fmt.Errorf("error creating initial plan: %w", err)
			}
		} else {
			if err := createUpdatePlan(ctx, streamCh, doneCh, w, plan, p.AdditionalFiles); err != nil {
				fmt.Printf("Failed to create update plan: %v\n", err)
				doneCh <- fmt.Errorf("error creating update plan: %w", err)
			}
		}
	}()

	var buffer strings.Builder
	done := false
	for !done {
		select {
		case stream := <-streamCh:
			// Trust the stream's spacing and just append
			buffer.WriteString(stream)

			// Send realtime update with current state
			plan.Description = buffer.String()
			e := realtimetypes.PlanUpdatedEvent{
				WorkspaceID: w.ID,
				Plan:        plan,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send plan update: %w", err)
			}

			// Write to database
			if err := workspace.AppendPlanDescription(ctx, plan.ID, stream); err != nil {
				return fmt.Errorf("error appending plan description: %w", err)
			}
		case err := <-doneCh:
			if err != nil {
				return fmt.Errorf("error creating initial plan: %w", err)
			}

			plan.Status = workspacetypes.PlanStatusReview

			e := realtimetypes.PlanUpdatedEvent{
				WorkspaceID: w.ID,
				Plan:        plan,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				fmt.Printf("Failed to send final plan update: %v\n", err)
				return fmt.Errorf("failed to send final plan update: %w", err)
			}
			done = true
		}
	}

	// Advance the status of the plan so that the user can review it
	if err := workspace.UpdatePlanStatus(ctx, plan.ID, workspacetypes.PlanStatusReview); err != nil {
		return fmt.Errorf("error updating plan status: %w", err)
	}

	return nil
}

func createInitialPlan(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan, additionalFiles []workspacetypes.File, useSecureBuildImages bool) error {
	chatMessages, err := workspace.ListChatMessagesForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error listing chat messages after plan: %w", err)
	}

	opts := llm.CreateInitialPlanOpts{
		ChatMessages:    chatMessages,
		AdditionalFiles: additionalFiles,
		Options: backend.Options{
			UseSecureBuildImages: useSecureBuildImages,
		},
	}
	if err := llm.CreateInitialPlan(ctx, streamCh, doneCh, opts); err != nil {
		return fmt.Errorf("error creating initial plan: %w", err)
	}

	return nil
}

// createUpdatePlan is our background processing task that creates a plan for any revision that's not the initial
func createUpdatePlan(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan, additionalFiles []workspacetypes.File) error {
	chatMessages := []workspacetypes.Chat{}
	mostRecentPrompt := ""
	for _, chatMessageID := range plan.ChatMessageIDs {
		chatMessage, err := workspace.GetChatMessage(ctx, chatMessageID)
		if err != nil {
			return err
		}

		chatMessages = append(chatMessages, *chatMessage)

		mostRecentPrompt = chatMessage.Prompt
	}

	expandedPrompt, err := llm.ExpandPrompt(ctx, mostRecentPrompt)
	if err != nil {
		return fmt.Errorf("failed to expand prompt: %w", err)
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

	for _, file := range relevantFiles {
		fmt.Printf("Relevant file: %s, similarity: %f\n", file.File.FilePath, file.Similarity)
	}

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

	opts := llm.CreatePlanOpts{
		ChatMessages:  chatMessages,
		Chart:         &w.Charts[0],
		RelevantFiles: finalRelevantFiles,
		IsUpdate:      true,
	}

	if err := llm.CreatePlan(ctx, streamCh, doneCh, opts); err != nil {
		return fmt.Errorf("error creating update plan: %w", err)
	}

	return nil
}
