package llm

import (
        "context"
        "fmt"

        anthropic "github.com/anthropics/anthropic-sdk-go"
        llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
        workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, c *workspacetypes.Chart, contentStreamCh chan string, doneCh chan error) error {
        client, err := newAnthropicClient(ctx)
        if err != nil {
                return fmt.Errorf("failed to create Anthropic client: %w", err)
        }

        messages := []anthropic.MessageParam{
                anthropic.NewAssistantMessage(anthropic.NewTextBlock(executePlanSystemPrompt)),
                anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
        }

        detailedPlanMessage := fmt.Sprintf("The Helm chart plan is: %s", plan.Description)
        messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanMessage)))

        if actionPlanWithPath.Action == "create" {
                createMessage := fmt.Sprintf("Create the file at %s", actionPlanWithPath.Path)
                messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(createMessage)))
        } else if actionPlanWithPath.Action == "update" {
                content := ""
                for _, file := range c.Files {
                        if file.FilePath == actionPlanWithPath.Path {
                                content = file.Content
                        }
                }
                updateMessage := fmt.Sprintf("Update the file at %s. The current content is: %s", actionPlanWithPath.Path, content)
                messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(updateMessage)))
        }

        stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
                Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
                MaxTokens: anthropic.F(int64(8192)),
                Messages:  anthropic.F(messages),
        })

        fullResponseWithTags := ""

        message := anthropic.Message{}
        for stream.Next() {
                event := stream.Current()
                message.Accumulate(event)

                switch delta := event.Delta.(type) {
                case anthropic.ContentBlockDeltaEventDelta:
                        if delta.Text != "" {
                                fullResponseWithTags += delta.Text
                                artifacts, err := parseArtifactsInResponse(fullResponseWithTags)
                                if err != nil {
                                        return fmt.Errorf("error parsing artifacts in response: %w", err)
                                }

                                for _, artifact := range artifacts {
                                        if artifact.Path == actionPlanWithPath.Path {
                                                contentStreamCh <- artifact.Content
                                        }
                                }
                        }
                }
        }

        if stream.Err() != nil {
                doneCh <- stream.Err()
        }

        doneCh <- nil
        return nil
}
