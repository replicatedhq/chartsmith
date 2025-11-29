package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type CreateInitialPlanOpts struct {
	ChatMessages    []workspacetypes.Chat
	PreviousPlans   []workspacetypes.Plan
	AdditionalFiles []workspacetypes.File
	WorkspaceID     string
}

func CreateInitialPlan(ctx context.Context, streamCh chan string, doneCh chan error, opts CreateInitialPlanOpts) error {
	chatMessageFields := []zap.Field{}
	for _, chatMessage := range opts.ChatMessages {
		chatMessageFields = append(chatMessageFields, zap.String("prompt", chatMessage.Prompt))
	}
	logger.Info("Creating initial plan", chatMessageFields...)

	// Build messages array for Vercel AI SDK
	messages := []MessageParam{
		{Role: "assistant", Content: initialPlanSystemPrompt},
		{Role: "assistant", Content: initialPlanInstructions},
	}

	// summarize the bootstrap chart and include it as a user message
	bootstrapChartUserMessage, err := summarizeBootstrapChart(ctx)
	if err != nil {
		return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
	}
	messages = append(messages, MessageParam{Role: "user", Content: bootstrapChartUserMessage})

	for _, chatMessage := range opts.ChatMessages {
		messages = append(messages, MessageParam{Role: "user", Content: chatMessage.Prompt})
		if chatMessage.Response != "" {
			messages = append(messages, MessageParam{Role: "assistant", Content: chatMessage.Response})
		}
	}

	for _, additionalFile := range opts.AdditionalFiles {
		messages = append(messages, MessageParam{Role: "user", Content: additionalFile.Content})
	}

	initialUserMessage := "Describe the plan only (do not write code) to create a helm chart based on the previous discussion. "
	messages = append(messages, MessageParam{Role: "user", Content: initialUserMessage})

	// Use Next.js client (which uses Vercel AI SDK)
	client := NewNextJSClient()
	textCh, errCh := client.StreamPlan(ctx, PlanRequest{
		Messages:    messages,
		WorkspaceID: opts.WorkspaceID,
	})

	// Forward streamed text to the provided channel
	go func() {
		for {
			select {
			case text, ok := <-textCh:
				if !ok {
					// Channel closed, wait for error
					err := <-errCh
					doneCh <- err
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

func summarizeBootstrapChart(ctx context.Context) (string, error) {
	bootstrapWorkspace, err := workspace.GetBootstrapWorkspace(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get bootstrap workspace: %w", err)
	}

	filesWithContent := map[string]string{}
	for _, chart := range bootstrapWorkspace.Charts {
		for _, file := range chart.Files {
			filesWithContent[file.FilePath] = file.Content
		}
	}

	encoded, err := json.Marshal(filesWithContent)
	if err != nil {
		return "", fmt.Errorf("failed to marshal files with content: %w", err)
	}

	return fmt.Sprintf("The chart we are basing our work on looks like this: \n %s", string(encoded)), nil
}
