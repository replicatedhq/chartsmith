package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type CreatePlanOpts struct {
	ChatMessages []workspacetypes.Chat
	Chart        *workspacetypes.Chart
	ChartSummary string
}

func CreatePlan(ctx context.Context, streamCh chan string, doneCh chan error, opts CreatePlanOpts) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanSystemPrompt)),
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanInstructions)),
	}

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(opts.ChartSummary)))

	for _, chatMessage := range opts.ChatMessages {
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)))
		if chatMessage.Response != "" {
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatMessage.Response)))
		}
	}

	initialUserMessage := "Describe the plan only (do not write code) to create a helm chart based on the previous discussion. "

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

	doneCh <- nil
	return nil
}
