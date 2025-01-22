package llm

import (
	"context"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/chat"
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

var initialUserMessage = "Describe the plan only (do not write code) to create a helm chart based on the previous discussion. Do not ask if you should proceed. "

func CreateInitialPlan(ctx context.Context, streamCh chan string, doneCh chan error, plan *workspacetypes.Plan) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(initialPlanInstructions)),
	}

	chatMessages := []chattypes.Chat{}
	for _, chatMessageID := range plan.ChatMessageIDs {
		chatMessage, err := chat.GetChatMessage(ctx, chatMessageID)
		if err != nil {
			return err
		}
		chatMessages = append(chatMessages, *chatMessage)
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

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				streamCh <- delta.Text
			}
		}
	}

	if stream.Err() != nil {
		doneCh <- stream.Err()
	}

	return nil
}
