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

	updatedFiles := []workspacetypes.File{}

	// copy existing files into the updatedFiles slice

	for _, file := range chart.Files {
		// bump the revision of each file to the new revision number
		file.RevisionNumber = revisionNumber
		updatedFiles = append(updatedFiles, file)
	}

	for _, file := range updatedFiles {
		fmt.Printf("Before file: %s:%s\n", file.ID, file.FilePath)
	}

	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				_, files, err := parseArtifactsInResponse(fullResponseWithTags)
				if err != nil {
					return nil, fmt.Errorf("error parsing artifacts in response: %w", err)
				}

				// update our chart object with the new files, merging them in using the path as the key
				for _, file := range files {
					found := false
					for i := range updatedFiles {
						if updatedFiles[i].FilePath == file.FilePath {
							found = true
							// Update the existing file's content while preserving other properties
							updatedFiles[i].Content = file.Content
							updatedFiles[i].RevisionNumber = revisionNumber
							break
						}
					}
					if !found {
						// For new files, set the revision number
						file.RevisionNumber = revisionNumber
						updatedFiles = append(updatedFiles, file)
					}
				}

				fullResponseWithTags += delta.Text
				c.Response = removeHelmsmithTags(ctx, fullResponseWithTags)

				if strings.Contains(fullResponseWithTags, "<helmsmith") || strings.Contains(fullResponseWithTags, "</helmsmith") {

					// make a copy of the chart to send to the client
					chartCopy := *chart
					chartCopy.Files = updatedFiles

					// make a copy of the workspace to send to the client
					workspaceCopy := *w

					// replace the chart in the workspace copy based on the id
					for i := range workspaceCopy.Charts {
						if workspaceCopy.Charts[i].ID == chart.ID {
							workspaceCopy.Charts[i] = chartCopy
						}
					}

					e := realtimetypes.WorkspaceUpdatedEvent{
						Workspace: &workspaceCopy,
					}

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

	for _, file := range updatedFiles {
		fmt.Printf("Updated file: %s:%s\n", file.ID, file.FilePath)
	}

	return updatedFiles, nil
}
