package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, c *workspacetypes.Chart, contentStreamCh chan string, doneCh chan error) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
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
	} else if actionPlanWithPath.Action == "delete" {
		deleteMessage := fmt.Sprintf("Delete the file at %s if it is not a required file.", actionPlanWithPath.Path)
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(deleteMessage)))
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
						if actionPlanWithPath.Action == "delete" {
							if strings.Contains(fullResponseWithTags, fmt.Sprintf(`path="%s" action="delete"`, actionPlanWithPath.Path)) {
								contentStreamCh <- ""
								doneCh <- nil
								return nil
							}
						} else {
							contentStreamCh <- artifact.Content
						}
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
