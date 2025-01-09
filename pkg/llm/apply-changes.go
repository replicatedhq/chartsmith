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

func ApplyChangesToWorkspace(ctx context.Context, w *workspacetypes.Workspace, revisionNumber int, c *chattypes.Chat, relevantFiles []workspacetypes.File) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	filenamesSent := []string{}
	relevantFileWithPaths := []string{}
	for _, file := range relevantFiles {
		filenamesSent = append(filenamesSent, file.Path)
		relevantFileWithPaths = append(relevantFileWithPaths, fmt.Sprintf("%s: %s", file.Path, file.Content))
	}

	if err := chat.SetFilesSentForChatMessage(ctx, w.ID, c.ID, filenamesSent); err != nil {
		return err
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
		return err
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
					return err
				}

				fullResponseWithTags += delta.Text
				c.Response = removeHelmsmithTags(ctx, fullResponseWithTags)

				if strings.Contains(fullResponseWithTags, "<helmsmith") || strings.Contains(fullResponseWithTags, "</helmsmith") {
					e := realtimetypes.WorkspaceUpdatedEvent{
						Workspace: w,
					}

					fmt.Printf("sending workspace update event to %s\n", recipient.GetUserIDs())
					if err := realtime.SendEvent(ctx, recipient, e); err != nil {
						return err
					}
				}
			}
		}
	}

	if stream.Err() != nil {
		return stream.Err()
	}

	if err := chat.MarkComplete(ctx, c); err != nil {
		return err
	}

	if err := chat.MarkApplied(ctx, c); err != nil {
		return err
	}

	if len(w.Files) == 0 {
		return nil
	}

	if err := workspace.AddFilesToWorkspace(ctx, w, revisionNumber); err != nil {
		return fmt.Errorf("error adding files to workspace: %w", err)
	}

	updatedWorkspace, err := workspace.SetCurrentRevision(ctx, w, revisionNumber)
	if err != nil {
		return fmt.Errorf("error setting current revision: %w", err)
	}

	e := realtimetypes.WorkspaceRevisionCompletedEvent{
		Workspace: updatedWorkspace,
	}
	r := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	if err := realtime.SendEvent(ctx, r, e); err != nil {
		return err
	}

	return nil
}
