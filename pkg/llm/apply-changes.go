package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/chat"
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

// ApplyPlanToChart will interface with the LLM generate the file changes to the chart
// It returns an updated list of files for the chart, but does not update the database
func ApplyPlanToChart(ctx context.Context, w *workspacetypes.Workspace, chart *workspacetypes.Chart, revisionNumber int, c *chattypes.Chat, relevantFiles []workspacetypes.File) ([]workspacetypes.File, error) {
	fmt.Printf("Applying changes to chart %s with revision number %d\n", chart.ID, revisionNumber)
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("error creating anthropic client: %w", err)
	}

	filenamesSent := []string{}
	relevantFileWithPaths := []string{}
	for _, file := range relevantFiles {
		filenamesSent = append(filenamesSent, file.FilePath)
		relevantFileWithPaths = append(relevantFileWithPaths, fmt.Sprintf("%s: %s", file.FilePath, file.Content))
	}

	if err := chat.SetFilesSentForChatMessage(ctx, w.ID, c.ID, filenamesSent); err != nil {
		return nil, fmt.Errorf("error setting files sent for chat message: %w", err)
	}

	newPrompt := fmt.Sprintf("Proceed with the implementation of the changes to this Helm chart. Here are some relevant files:\n\n%s\n\n%s\n", strings.Join(relevantFileWithPaths, "\n\n"), c.Response)
	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(createKnowledge)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(newPrompt)),
		}),
	})

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return nil, fmt.Errorf("error listing user IDs for workspace: %w", err)
	}

	// minimize database writes by keeping this message in memory while it's streaming back, only writing
	// to the database when complete.  but still send the message as we receive it over the realtime socket
	// to the client

	recipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	fullResponseWithTags := ""
	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				if err := parseArtifactsInResponse(w, fullResponseWithTags); err != nil {
					return nil, fmt.Errorf("error parsing artifacts in response: %w", err)
				}

				fullResponseWithTags += delta.Text
				c.Response = removeHelmsmithTags(ctx, fullResponseWithTags)

				if strings.Contains(fullResponseWithTags, "<helmsmith") || strings.Contains(fullResponseWithTags, "</helmsmith") {
					e := realtimetypes.WorkspaceUpdatedEvent{
						Workspace: w,
					}

					fmt.Printf("sending workspace update event to %s\n", recipient.GetUserIDs())
					if err := realtime.SendEvent(ctx, recipient, e); err != nil {
						return nil, fmt.Errorf("error sending workspace update event: %w", err)
					}
				}
			}
		}
	}

	if stream.Err() != nil {
		return nil, stream.Err()
	}

	if len(w.Files) == 0 {
		return nil, nil
	}

	// e := realtimetypes.WorkspaceRevisionCompletedEvent{
	// 	Workspace: updatedWorkspace,
	// }
	// r := realtimetypes.Recipient{
	// 	UserIDs: userIDs,
	// }

	// if err := realtime.SendEvent(ctx, r, e); err != nil {
	// 	return nil, fmt.Errorf("error sending workspace revision completed event: %w", err)
	// }

	return nil, nil
}
