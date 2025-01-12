package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/chat"
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

var initialUserMessage = "Describe the plan only (do not write code) to create a helm chart based on the previous discussion. Do not ask if you should proceed. "

func CreateFirstPlanFromChatMessages(ctx context.Context, w *workspacetypes.Workspace, chatMessages []chattypes.Chat) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(planKnowledge)),
	}

	for _, chatMessage := range chatMessages {
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)))
		if chatMessage.Response != "" {
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatMessage.Response)))
		}
	}

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(initialUserMessage)))

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
	})

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return err
	}

	// minimize database writes by keeping this message in memory while it's streaming back, only writing
	// to the database when complete.  but still send the message as we receive it over the realtime socket
	// to the client

	recipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	// we are going to update the last chat message in the array with the response
	lastChatMessage := &chatMessages[len(chatMessages)-1]

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				lastChatMessage.Response += delta.Text

				e := realtimetypes.ChatMessageUpdatedEvent{
					WorkspaceID: w.ID,
					Message:     lastChatMessage,
					IsComplete:  false,
				}

				if err := realtime.SendEvent(ctx, recipient, e); err != nil {
					return err
				}
			}
		}
	}

	if stream.Err() != nil {
		return stream.Err()
	}

	if err := chat.SetResponse(ctx, nil, lastChatMessage); err != nil {
		fmt.Printf("Error setting response: %v\n", err)
		return err
	}
	if err := chat.MarkComplete(ctx, nil, lastChatMessage); err != nil {
		return err
	}

	e := realtimetypes.ChatMessageUpdatedEvent{
		WorkspaceID: w.ID,
		Message:     lastChatMessage,
		IsComplete:  true,
	}

	if err := realtime.SendEvent(ctx, recipient, e); err != nil {
		return err
	}

	return nil
}
