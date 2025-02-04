package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ConversationalChatMessage(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, chatMessage *workspacetypes.Chat) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatOnlySystemPrompt)),
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatOnlyInstructions)),
	}

	var c *workspacetypes.Chart
	c = &w.Charts[0]

	chartStructure, err := getChartStructure(ctx, c)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	expandedPrompt, err := ExpandPrompt(ctx, chatMessage.Prompt)
	if err != nil {
		return fmt.Errorf("failed to expand prompt: %w", err)
	}

	relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(
		ctx,
		w,
		c.ID,
		w.CurrentRevision,
		expandedPrompt,
	)
	if err != nil {
		return fmt.Errorf("failed to choose relevant files: %w", err)
	}

	// we want to limit the number of files to 10
	relevantFiles = relevantFiles[:10]

	// add the context of the workspace to the chat
	messages = append(messages,
		anthropic.NewAssistantMessage(
			anthropic.NewTextBlock(fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure)),
		),
	)

	for _, file := range relevantFiles {
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(fmt.Sprintf(`File: %s, Content: %s`, file.File.FilePath, file.File.Content))))
	}

	// we need to get the previous plan, and then all followup chat messages since that plan
	plan, err := workspace.GetMostRecentPlan(ctx, w.ID)
	if err != nil && err != workspace.ErrNoPlan {
		return fmt.Errorf("failed to get most recent plan: %w", err)
	}

	if plan != nil {
		previousChatMessages, err := workspace.ListChatMessagesAfterPlan(ctx, plan.ID)
		if err != nil {
			return fmt.Errorf("failed to list chat messages: %w", err)
		}

		for _, chat := range previousChatMessages {
			if chat.ID == chatMessage.ID {
				continue
			}
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chat.Prompt)))
		}

		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(plan.Description)))

	}

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)))
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

func getChartStructure(ctx context.Context, c *workspacetypes.Chart) (string, error) {
	structure := ""
	for _, file := range c.Files {
		structure += fmt.Sprintf(`File: %s`, file.FilePath)
	}
	return structure, nil
}
