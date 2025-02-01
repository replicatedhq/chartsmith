package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

func handleNewPlanNotification(ctx context.Context, planID string) error {
	logger.Info("New plan notification received",
		zap.String("plan_id", planID))

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

	if err := workspace.UpdatePlanStatus(ctx, plan.ID, workspacetypes.PlanStatusPlanning); err != nil {
		return fmt.Errorf("error updating plan status: %w", err)
	}

	plan.Status = workspacetypes.PlanStatusPlanning

	streamCh := make(chan string, 1)
	doneCh := make(chan error, 1)
	go func() {
		if w.CurrentRevision == 0 {
			if err := createInitialPlan(ctx, streamCh, doneCh, w, plan); err != nil {
				fmt.Printf("Failed to create initial plan: %v\n", err)
				processingErr = fmt.Errorf("error creating initial plan: %w", err)
			}
		} else {
			if err := createUpdatePlan(ctx, streamCh, doneCh, w, plan); err != nil {
				fmt.Printf("Failed to create update plan: %v\n", err)
				processingErr = fmt.Errorf("error creating update plan: %w", err)
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

func createInitialPlan(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan) error {
	chatMessages, err := workspace.ListChatMessagesForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error listing chat messages after plan: %w", err)
	}

	opts := llm.CreateInitialPlanOpts{
		ChatMessages: chatMessages,
	}
	if err := llm.CreateInitialPlan(ctx, streamCh, doneCh, opts); err != nil {
		return fmt.Errorf("error creating initial plan: %w", err)
	}

	return nil
}

// createUpdatePlan is our background processing task that creates a plan for any revision that's not the initial
func createUpdatePlan(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan) error {
	chartFiles := []workspacetypes.File{}
	chartFileNamesWithoutPath := map[string]workspacetypes.File{}
	chartFileNamesWithPath := map[string]workspacetypes.File{}
	for _, file := range w.Charts[0].Files {
		chartFiles = append(chartFiles, file)
		chartFileNamesWithoutPath[strings.ToLower(filepath.Base(file.FilePath))] = file
		chartFileNamesWithPath[strings.ToLower(file.FilePath)] = file
	}

	chartFilesMentioned := []workspacetypes.File{}

	chatMessages := []workspacetypes.Chat{}
	for _, chatMessageID := range plan.ChatMessageIDs {
		chatMessage, err := workspace.GetChatMessage(ctx, chatMessageID)
		if err != nil {
			return err
		}

		// split the user message on words and check if any of the words are in the chart file names
		words := strings.Fields(chatMessage.Prompt)

		for _, word := range words {
			if file, ok := chartFileNamesWithoutPath[strings.ToLower(word)]; ok {
				chartFilesMentioned = append(chartFilesMentioned, file)
			}

			if file, ok := chartFileNamesWithPath[word]; ok {
				chartFilesMentioned = append(chartFilesMentioned, file)
			}
		}

		chatMessages = append(chatMessages, *chatMessage)
	}

	chartSummary, err := summarizeChart(ctx, &w.Charts[0])
	if err != nil {
		return fmt.Errorf("failed to summarize chart: %w", err)
	}

	opts := llm.CreatePlanOpts{
		ChatMessages: chatMessages,
		Chart:        &w.Charts[0],
		ChartSummary: chartSummary,
	}

	if err := llm.CreatePlan(ctx, streamCh, doneCh, opts); err != nil {
		return fmt.Errorf("error creating update plan: %w", err)
	}

	return nil
}

func summarizeChart(ctx context.Context, c *workspacetypes.Chart) (string, error) {
	filesWithContent := map[string]string{}

	for _, file := range c.Files {
		filesWithContent[file.FilePath] = file.Content
	}

	encoded, err := json.Marshal(filesWithContent)
	if err != nil {
		return "", fmt.Errorf("failed to marshal files with content: %w", err)
	}

	return fmt.Sprintf("The chart we are basing our work on looks like this: \n %s", string(encoded)), nil
}
