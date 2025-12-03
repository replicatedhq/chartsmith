package llm

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ConversationalChatMessage(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, chatMessage *workspacetypes.Chat) error {
	messages := []MessageParam{
		{Role: "assistant", Content: chatOnlySystemPrompt},
		{Role: "assistant", Content: chatOnlyInstructions},
	}

	c := &w.Charts[0]

	chartStructure, err := getChartStructure(ctx, c)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	expandedPrompt, err := ExpandPrompt(ctx, chatMessage.Prompt)
	if err != nil {
		return fmt.Errorf("failed to expand prompt: %w", err)
	}

	var chartID *string
	if len(w.Charts) > 0 {
		chartID = &w.Charts[0].ID
	}

	relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(
		ctx,
		w,
		workspace.WorkspaceFilter{
			ChartID: chartID,
		},
		w.CurrentRevision,
		expandedPrompt,
	)
	if err != nil {
		return fmt.Errorf("failed to choose relevant files: %w", err)
	}

	maxFiles := 10
	if len(relevantFiles) < maxFiles {
		maxFiles = len(relevantFiles)
	}
	relevantFiles = relevantFiles[:maxFiles]

	messages = append(messages, MessageParam{
		Role:    "assistant",
		Content: fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure),
	})

	for _, file := range relevantFiles {
		messages = append(messages, MessageParam{Role: "assistant", Content: fmt.Sprintf(`File: %s, Content: %s`, file.File.FilePath, file.File.Content)})
	}

	plan, err := workspace.GetMostRecentPlan(ctx, w.ID)
	if err != nil && err != workspace.ErrNoPlan {
		return fmt.Errorf("failed to get most recent plan: %w", err)
	}

	if plan != nil {
		previousChatMessages, err := workspace.ListChatMessagesAfterPlan(ctx, plan.ID)
		if err != nil {
			return fmt.Errorf("failed to list chat messages: %w", err)
		}

		for _, chat := range previousChatMessages {
			if chat.ID == chatMessage.ID {
				continue
			}
			messages = append(messages, MessageParam{Role: "assistant", Content: chat.Prompt})
		}

		messages = append(messages, MessageParam{Role: "assistant", Content: plan.Description})
	}

	messages = append(messages, MessageParam{Role: "user", Content: chatMessage.Prompt})

	client := NewNextJSClient()
	textCh, errCh := client.StreamConversational(ctx, ConversationalRequest{
		Messages: messages,
	})

	// Forward streamed text to the provided channel
	go func() {
		for {
			select {
			case text, ok := <-textCh:
				if !ok {
					// Channel closed, check for error or signal success
					select {
					case err := <-errCh:
						doneCh <- err
					default:
						// No error, stream completed successfully
						doneCh <- nil
					}
					return
				}
				streamCh <- text
			case err := <-errCh:
				doneCh <- err
				return
			case <-ctx.Done():
				doneCh <- ctx.Err()
				return
			}
		}
	}()

	return nil
}

func getChartStructure(ctx context.Context, c *workspacetypes.Chart) (string, error) {
	structure := ""
	for _, file := range c.Files {
		structure += fmt.Sprintf(`File: %s`, file.FilePath)
	}
	return structure, nil
}
