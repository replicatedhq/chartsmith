package listener

import (
	"context"
	"fmt"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

func handleNewIntentNotification(ctx context.Context, payload string) error {
	logger.Info("New intent notification received", zap.String("payload", payload))

	chatMessage, err := workspace.GetChatMessage(ctx, payload)
	if err != nil {
		return fmt.Errorf("failed to get chat message: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, chatMessage.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	isInitialPrompt := w.CurrentRevision == 0
	plan, err := workspace.GetMostRecentPlan(ctx, w.ID)
	if err != nil && err != workspace.ErrNoPlan {
		return fmt.Errorf("failed to get most recent plan: %w", err)
	}
	if plan != nil {
		isInitialPrompt = false
	}

	intent, err := llm.GetChatMessageIntent(ctx, chatMessage.Prompt, isInitialPrompt)
	if err != nil {
		return fmt.Errorf("failed to get conversational and plan intent: %w", err)
	}

	if err := workspace.UpdateChatMessageIntent(ctx, chatMessage.ID, intent); err != nil {
		return fmt.Errorf("failed to update chat message intent: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error getting user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	updatedChatMessage, err := workspace.GetChatMessage(ctx, chatMessage.ID)
	if err != nil {
		return fmt.Errorf("error getting chat message: %w", err)
	}

	e := realtimetypes.ChatMessageUpdatedEvent{
		WorkspaceID: w.ID,
		ChatMessage: updatedChatMessage,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send chat message update: %w", err)
	}

	logger.Info("intent",
		zap.String("prompt", chatMessage.Prompt),
		zap.Bool("is_conversational", intent.IsConversational),
		zap.Bool("is_off_topic", intent.IsOffTopic),
		zap.Bool("is_plan", intent.IsPlan),
		zap.Bool("is_chart_developer", intent.IsChartDeveloper),
		zap.Bool("is_chart_operator", intent.IsChartOperator),
		zap.Bool("is_proceed", intent.IsProceed),
	)

	// sometimes we see messages that return false to everything
	if !intent.IsConversational && !intent.IsPlan && !intent.IsOffTopic && !intent.IsChartDeveloper && !intent.IsChartOperator && !intent.IsProceed {
		streamCh := make(chan string)
		doneCh := make(chan error)
		go func() {
			if err := llm.FeedbackOnAmbiguousIntent(ctx, streamCh, doneCh, chatMessage); err != nil {
				fmt.Printf("Failed to get feedback on ambiguous intent: %v\n", err)
			}
		}()

		var buffer strings.Builder
		done := false
		for !done {
			select {
			case stream := <-streamCh:
				buffer.WriteString(stream)

				cleanedResponse := removeThinkingContent(buffer.String())

				cleanedResponse = strings.TrimSpace(cleanedResponse)

				updatedChatMessage.Response = cleanedResponse
				e := realtimetypes.ChatMessageUpdatedEvent{
					WorkspaceID: w.ID,
					ChatMessage: updatedChatMessage,
				}
				if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
					return fmt.Errorf("failed to send chat message update: %w", err)
				}

				if err := workspace.SetChatMessageResponse(ctx, chatMessage.ID, cleanedResponse); err != nil {
					return fmt.Errorf("failed to write chat message response to database: %w", err)
				}
			case err := <-doneCh:
				if err != nil {
					fmt.Printf("Failed to get feedback on ambiguous intent: %v\n", err)
				}
				done = true
			}
		}
	}

	// if the intent is proceed, we need to send a message to the planner
	if intent.IsProceed {
		// create a revision
		rev, err := workspace.CreateRevision(ctx, w.ID, plan.ID, userIDs[0])
		if err != nil {
			return fmt.Errorf("failed to create revision: %w", err)
		}

		// send a realtime message about the new revision
		e := realtimetypes.RevisionCreatedEvent{
			WorkspaceID: w.ID,
			Revision:    rev,
			Workspace:   *w,
		}

		logger.Debug("revision created event", zap.Any("revision", rev))
		if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
			return fmt.Errorf("failed to send revision created event: %w", err)
		}
		return nil
	}

	// if the message is off topic, get an llm response to this
	if intent.IsOffTopic {
		if !intent.IsPlan && w.CurrentRevision > 0 {
			streamCh := make(chan string)
			doneCh := make(chan error)
			go func() {
				if err := llm.DeclineOffTopicChatMessage(ctx, streamCh, doneCh, chatMessage); err != nil {
					fmt.Printf("Failed to decline off-topic chat message: %v\n", err)
				}
			}()

			var buffer strings.Builder
			done := false
			for !done {
				select {
				case stream := <-streamCh:
					buffer.WriteString(stream)

					cleanedResponse := removeThinkingContent(buffer.String())

					cleanedResponse = strings.TrimSpace(cleanedResponse)

					updatedChatMessage.Response = cleanedResponse
					e := realtimetypes.ChatMessageUpdatedEvent{
						WorkspaceID: w.ID,
						ChatMessage: updatedChatMessage,
					}
					if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
						return fmt.Errorf("failed to send chat message update: %w", err)
					}

					if err := workspace.SetChatMessageResponse(ctx, chatMessage.ID, cleanedResponse); err != nil {
						return fmt.Errorf("failed to write chat message response to database: %w", err)
					}
				case err := <-doneCh:
					if err != nil {
						fmt.Printf("Failed to decline off-topic chat message: %v\n", err)
					}
					done = true
				}
			}
		}
	}

	// if the message suggests a plan, send a message to the planner
	if intent.IsPlan && !intent.IsConversational {
		if err := workspace.CreatePlan(ctx, chatMessage.ID, w.ID); err != nil {
			return fmt.Errorf("failed to create plan: %w", err)
		}

		return nil
	} else if intent.IsConversational && !intent.IsOffTopic {
		// the message is already in the database, we just need to notify the worker
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()
		conn.Exec(ctx, `SELECT pg_notify('new_converational', $1)`, chatMessage.ID)
		conn.Release()
	}

	// if the message suggests a conversational response, send a message to the conversational llm
	if intent.IsConversational {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()
		conn.Exec(ctx, `SELECT pg_notify('new_converational', $1)`, chatMessage.ID)
		conn.Release()
		return nil
	}

	return nil
}

func removeThinkingContent(input string) string {
	if !strings.Contains(input, "<think>") && !strings.Contains(input, "</think>") {
		return input
	}

	result := input
	for strings.Contains(result, "<think>") && strings.Contains(result, "</think>") {
		beforeThink := strings.Split(result, "<think>")[0]
		afterThinkTag := strings.Split(result, "</think>")[1]
		result = beforeThink + afterThinkTag
	}

	// Handle any remaining single tags
	if strings.Contains(result, "<think>") {
		return "" // Still has an opening tag with no close
	} else if strings.Contains(result, "</think>") {
		return strings.Split(result, "</think>")[1] // Keep only what's after the close tag
	}

	return result
}
