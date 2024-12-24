package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/chat/types"
)

func SendChatMessage(ctx context.Context, chat *types.Chat) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	userMessage := chat.Prompt
	if chat.IsInitialMessage {
		userMessage = "generate a helm chart based on the following prompt: " + chat.Prompt
	}

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(1024)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage)),
		}),
	})
	if err != nil {
		return err
	}

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				fmt.Printf("update: %s\n", delta.Text)
			}
		}
	}

	if stream.Err() != nil {
		return stream.Err()
	}

	return nil
}
