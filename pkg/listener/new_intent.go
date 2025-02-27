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
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

type newIntentPayload struct {
	ChatMessageID string `json:"chatMessageId"`
	WorkspaceID   string `json:"workspaceId"`
}

func handleNewIntentNotification(ctx context.Context, payload string) error {
	logger.Info("New intent notification received", zap.String("payload", payload))

	var p newIntentPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	chatMessage, err := workspace.GetChatMessage(ctx, p.ChatMessageID)
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
		zap.Bool("is_render", intent.IsRender),
	)

	// sometimes we see messages that return false to everything
	if !intent.IsConversational && !intent.IsPlan && !intent.IsOffTopic && !intent.IsChartDeveloper && !intent.IsChartOperator && !intent.IsProceed && !intent.IsRender {
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

				cleanedResponse := buffer.String()

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
	if intent.IsProceed && plan != nil {
		// create a revision
		rev, err := workspace.CreateRevision(ctx, w.ID, &plan.ID, userIDs[0])
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

					cleanedResponse := buffer.String()

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

	if intent.IsRender {
		if err := workspace.EnqueueRenderWorkspace(ctx, w.ID, p.ChatMessageID); err != nil {
			return fmt.Errorf("failed to enqueue render workspace: %w", err)
		}

		chatMesageWithRenderID, err := workspace.GetChatMessage(ctx, chatMessage.ID)
		if err != nil {
			return fmt.Errorf("failed to get chat message: %w", err)
		}

		e := realtimetypes.ChatMessageUpdatedEvent{
			WorkspaceID: w.ID,
			ChatMessage: chatMesageWithRenderID,
		}
		if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
			return fmt.Errorf("failed to send chat message update: %w", err)
		}

		return nil
	}

	// if the message suggests a plan, send a message to the planner
	if intent.IsPlan && !intent.IsConversational {
		if err := workspace.CreatePlan(ctx, chatMessage.ID, w.ID); err != nil {
			return fmt.Errorf("failed to create plan: %w", err)
		}

		chatMessageWithPlanID, err := workspace.GetChatMessage(ctx, chatMessage.ID)
		if err != nil {
			return fmt.Errorf("failed to get chat message: %w", err)
		}

		e := realtimetypes.ChatMessageUpdatedEvent{
			WorkspaceID: w.ID,
			ChatMessage: chatMessageWithPlanID,
		}
		if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
			return fmt.Errorf("failed to send chat message update: %w", err)
		}
		return nil
	} else if intent.IsConversational && !intent.IsOffTopic {
		if err := persistence.EnqueueWork(ctx, "new_converational", map[string]interface{}{
			"chatMessageId": chatMessage.ID,
		}); err != nil {
			return fmt.Errorf("failed to enqueue new conversational chat message: %w", err)
		}
	} else if intent.IsConversational {
		if err := persistence.EnqueueWork(ctx, "new_converational", map[string]interface{}{
			"chatMessageId": chatMessage.ID,
		}); err != nil {
			return fmt.Errorf("failed to enqueue new conversational chat message: %w", err)
		}
	}

	return nil
}
