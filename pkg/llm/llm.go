package llm

import (
	"context"
	"path/filepath"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/chat"
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func CreateNewChartFromMessage(ctx context.Context, w *workspacetypes.Workspace, c *chattypes.Chat) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	userMessage := "generate a helm chart based on the following prompt: " + c.Prompt

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage)),
		}),
	})

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, c.WorkspaceID)
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

					if err := realtime.SendEvent(ctx, recipient, e); err != nil {
						return err
					}
				} else {
					e := realtimetypes.ChatMessageUpdatedEvent{
						WorkspaceID: c.WorkspaceID,
						Message:     c,
						IsComplete:  false,
					}

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

	if len(w.Files) == 0 {
		return nil
	}

	// write the final workspace and files to the database
	if err := workspace.CreateWorkspaceRevision(ctx, w); err != nil {
		return err
	}

	e := realtimetypes.WorkspaceRevisionCreatedEvent{
		Workspace: w,
	}
	r := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	if err := realtime.SendEvent(ctx, r, e); err != nil {
		return err
	}

	return nil
}

func parseArtifactsInResponse(workspace *workspacetypes.Workspace, response string) error {
	parser := NewParser()

	parser.Parse(response)

	result := parser.GetResult()

	workspace.Name = result.Title

	workspace.Files = []workspacetypes.File{}
	for _, file := range result.Files {
		f := workspacetypes.File{
			Path: file.Path,
			Name: filepath.Base(file.Path),
		}

		if file.Content != "" {
			f.Content = file.Content
		} else {
			f.Content = file.PartialContent
		}

		workspace.Files = append(workspace.Files, f)
	}

	return nil
}

func removeHelmsmithTags(ctx context.Context, input string) string {
	artifactStart := strings.Index(input, "<helmsmithArtifact")
	if artifactStart == -1 {
		return input
	}

	// Get everything before first helmsmith tag
	result := input[:artifactStart]

	// Find last helmsmith tag
	lastArtifactEnd := strings.LastIndex(input, "</helmsmithArtifact>")
	if lastArtifactEnd != -1 {
		// Add everything after the last closing tag
		result += input[lastArtifactEnd+len("</helmsmithArtifact>"):]
	}

	return result
}
