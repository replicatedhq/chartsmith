package llm

import (
	"context"
	"encoding/json"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func CreateInitialPlan(ctx context.Context, streamCh chan string, doneCh chan error, plan *workspacetypes.Plan) error {
	logger.Infof("Creating initial plan: %+v\n", plan)

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanSystemPrompt)),
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanInstructions)),
	}

	// summarize the bootstrap chart and include it as a user message
	bootsrapChartUserMessage, err := summarizeBootstrapChart(ctx)
	if err != nil {
		return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
	}
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(bootsrapChartUserMessage)))

	chatMessages := []workspacetypes.Chat{}
	for _, chatMessageID := range plan.ChatMessageIDs {
		chatMessage, err := workspace.GetChatMessage(ctx, chatMessageID)
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

func summarizeBootstrapChart(ctx context.Context) (string, error) {
	bootstrapWorkspace, err := workspace.GetBootstrapWorkspace(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get bootstrap workspace: %w", err)
	}

	filesWithContent := map[string]string{}
	for _, chart := range bootstrapWorkspace.Charts {
		for _, file := range chart.Files {
			filesWithContent[file.FilePath] = file.Content
		}
	}

	encoded, err := json.Marshal(filesWithContent)
	if err != nil {
		return "", fmt.Errorf("failed to marshal files with content: %w", err)
	}

	return fmt.Sprintf("The chart we are basing our work on looks like this: \n %s", string(encoded)), nil
}
