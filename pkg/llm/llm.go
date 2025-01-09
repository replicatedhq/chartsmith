package llm

import (
	"context"
	"fmt"
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

func IterationChat(ctx context.Context, w *workspacetypes.Workspace, previousChatMessages []chattypes.Chat, c *chattypes.Chat, relevantFiles []workspacetypes.File) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(planKnowledge)),
	}

	for _, chat := range previousChatMessages {
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chat.Prompt)))
		if chat.Response != "" {
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chat.Response)))
		}
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

	newPrompt := fmt.Sprintf("Describe the plan only (do not write code) to create a helm chart based on the following prompt. Here are some relevant files:\n\n%s\n\n%s\n", strings.Join(relevantFileWithPaths, "\n\n"), c.Prompt)
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(newPrompt)))

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
	})

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, c.WorkspaceID)
	if err != nil {
		return err
	}
	recipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				c.Response += delta.Text

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

	if stream.Err() != nil {
		return stream.Err()
	}

	if err := chat.MarkComplete(ctx, c); err != nil {
		return err
	}

	e := realtimetypes.ChatMessageUpdatedEvent{
		WorkspaceID: c.WorkspaceID,
		Message:     c,
		IsComplete:  true,
	}

	if err := realtime.SendEvent(ctx, recipient, e); err != nil {
		return err
	}

	return nil
}

func ClarificationChat(ctx context.Context, w *workspacetypes.Workspace, previousChatMessages []chattypes.Chat, c *chattypes.Chat) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(planKnowledge)),
	}

	for _, chat := range previousChatMessages {
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chat.Prompt)))
		if chat.Response != "" {
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chat.Response)))
		}
	}

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(initialUserMessage(c.Prompt))))

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
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

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				c.Response += delta.Text

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

	if stream.Err() != nil {
		return stream.Err()
	}

	if err := chat.MarkComplete(ctx, c); err != nil {
		return err
	}

	e := realtimetypes.ChatMessageUpdatedEvent{
		WorkspaceID: c.WorkspaceID,
		Message:     c,
		IsComplete:  true,
	}

	if err := realtime.SendEvent(ctx, recipient, e); err != nil {
		return err
	}

	return nil
}

func initialUserMessage(prompt string) string {
	userMessage := "Describe the plan only (do not write code) to create a helm chart based on the following prompt. Do not ask if you should proceed. " + prompt
	return userMessage
}

func CreateNewChartFromMessage(ctx context.Context, w *workspacetypes.Workspace, c *chattypes.Chat) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(planKnowledge)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(initialUserMessage(c.Prompt))),
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

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				c.Response += delta.Text

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

	if stream.Err() != nil {
		return stream.Err()
	}

	if err := chat.MarkComplete(ctx, c); err != nil {
		return err
	}

	e := realtimetypes.ChatMessageUpdatedEvent{
		WorkspaceID: c.WorkspaceID,
		Message:     c,
		IsComplete:  true,
	}

	if err := realtime.SendEvent(ctx, recipient, e); err != nil {
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
