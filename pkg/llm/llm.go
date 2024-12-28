package llm

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func SendChatMessage(ctx context.Context, w *workspacetypes.Workspace, c *types.Chat) error {
	fmt.Printf("Sending chat message: %+v\n", c)
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	userMessage := "generate a helm chart based on the following prompt: " + c.Prompt

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(1024)),
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

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				c.Response += delta.Text

				if strings.Contains(c.Response, "<helmsmith") {
					// parse all files and chart in the repsonse
					if err := parseArtifactsInResponse(w, c.Response); err != nil {
						return err
					}

					e := realtimetypes.WorkspaceUpdatedEvent{
						Workspace: w,
					}
					r := realtimetypes.Recipient{
						UserIDs: userIDs,
					}

					if err := realtime.SendEvent(ctx, r, e); err != nil {
						return err
					}
				} else {
					e := realtimetypes.ChatMessageUpdatedEvent{
						WorkspaceID: c.WorkspaceID,
						Message:     c,
						IsComplete:  false,
					}
					r := realtimetypes.Recipient{
						UserIDs: userIDs,
					}

					if err := realtime.SendEvent(ctx, r, e); err != nil {
						return err
					}
				}
			}
		}
	}

	if stream.Err() != nil {
		return stream.Err()
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
		workspace.Files = append(workspace.Files, workspacetypes.File{
			Path:    file.Path,
			Name:    filepath.Base(file.Path),
			Content: file.Content,
		})
	}

	return nil
}
