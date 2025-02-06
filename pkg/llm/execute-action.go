package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, currentContent string, contentStreamCh chan string, doneCh chan error) error {
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

		updateMessage := fmt.Sprintf(`The file at %s needs to be updated according to the plan.
Here is the current content between XML tags:

<current_content>
%s
</current_content>

Generate a git .patch file to apply this update. Use correct line numbers based on the current_content provided.
The patch should be formatted with unified diff format.
Follow the instructions to provide the patch in proper <chartsmithArtifact> tags.`,
			actionPlanWithPath.Path, strings.TrimSpace(currentContent))

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

	logger.Debugf("Full response with tags: %s", fullResponseWithTags)
	doneCh <- nil
	return nil
}
