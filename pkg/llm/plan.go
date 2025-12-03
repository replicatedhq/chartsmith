package llm

import (
	"context"
	"fmt"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type CreatePlanOpts struct {
	ChatMessages  []workspacetypes.Chat
	Chart         *workspacetypes.Chart
	RelevantFiles []workspacetypes.File
	IsUpdate      bool
	WorkspaceID   string
}

func CreatePlan(ctx context.Context, streamCh chan string, doneCh chan error, opts CreatePlanOpts) error {
	fileNameArgs := []string{}
	for _, file := range opts.RelevantFiles {
		fileNameArgs = append(fileNameArgs, file.FilePath)
	}
	logger.Debug("Creating plan with relevant files",
		zap.Int("relevantFiles", len(opts.RelevantFiles)),
		zap.String("relevantFiles", strings.Join(fileNameArgs, ", ")),
		zap.Bool("isUpdate", opts.IsUpdate),
	)

	chartStructure, err := getChartStructure(ctx, opts.Chart)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	// Build messages array for Vercel AI SDK
	messages := []MessageParam{}

	if !opts.IsUpdate {
		messages = append(messages, MessageParam{Role: "assistant", Content: initialPlanSystemPrompt})
		messages = append(messages, MessageParam{Role: "assistant", Content: initialPlanInstructions})
		messages = append(messages, MessageParam{Role: "user", Content: fmt.Sprintf(`Chart structure: %s`, chartStructure)})
	} else {
		messages = append(messages, MessageParam{Role: "assistant", Content: updatePlanSystemPrompt})
		messages = append(messages, MessageParam{Role: "assistant", Content: updatePlanInstructions})
		messages = append(messages, MessageParam{Role: "user", Content: fmt.Sprintf(`Chart structure: %s`, chartStructure)})
		for _, file := range opts.RelevantFiles {
			messages = append(messages, MessageParam{Role: "user", Content: fmt.Sprintf(`File: %s, Content: %s`, file.FilePath, file.Content)})
		}
	}

	for _, chatMessage := range opts.ChatMessages {
		messages = append(messages, MessageParam{Role: "user", Content: chatMessage.Prompt})
		if chatMessage.Response != "" {
			messages = append(messages, MessageParam{Role: "assistant", Content: chatMessage.Response})
		}
	}

	verb := "create"
	if opts.IsUpdate {
		verb = "edit"
	}
	initialUserMessage := fmt.Sprintf("Describe the plan only (do not write code) to %s a helm chart based on the previous discussion. ", verb)
	messages = append(messages, MessageParam{Role: "user", Content: initialUserMessage})

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
