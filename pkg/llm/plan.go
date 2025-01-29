package llm

import (
        "context"
        "encoding/json"
        "fmt"

        anthropic "github.com/anthropics/anthropic-sdk-go"
        "github.com/replicatedhq/chartsmith/pkg/workspace"
        workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func CreatePlan(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan) error {
        client, err := newAnthropicClient(ctx)
        if err != nil {
                return fmt.Errorf("failed to create anthropic client: %w", err)
        }

        messages := []anthropic.MessageParam{
                anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanSystemPrompt)),
                anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanInstructions)),
        }

        var c *workspacetypes.Chart
        c = &w.Charts[0]

        currentChartUserMessage, err := summarizeChart(ctx, c)
        if err != nil {
                return fmt.Errorf("failed to summarize chart: %w", err)
        }
        messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(currentChartUserMessage)))

        chatMessages := []workspacetypes.Chat{}
        for _, chatMessageID := range plan.ChatMessageIDs {
                chatMessage, err := workspace.GetChatMessage(ctx, chatMessageID)
                if err != nil {
                        return fmt.Errorf("failed to get chat message %s: %w", chatMessageID, err)
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
