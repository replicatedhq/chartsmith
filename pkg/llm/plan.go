package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

// CreatePlanOpts contains options for creating a plan
type CreatePlanOpts struct {
	ChatMessages  []workspacetypes.Chat
	Chart         *workspacetypes.Chart
	RelevantFiles []workspacetypes.File
	IsUpdate      bool
}

// CreatePlan generates a plan for creating or updating a Helm chart based on chat messages and relevant files.
// It streams the plan text to streamCh and signals completion (with any error) via doneCh.
// If IsUpdate is true, the plan is for updating an existing chart; otherwise, it's for creating a new one.
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

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	chartStructure, err := getChartStructure(ctx, opts.Chart)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	messages := []anthropic.MessageParam{}

	if !opts.IsUpdate {
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanSystemPrompt)))
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanInstructions)))
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`Chart structure: %s`, chartStructure))))

	} else {
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(updatePlanSystemPrompt)))
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(updatePlanInstructions)))
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`Chart structure: %s`, chartStructure))))
		for _, file := range opts.RelevantFiles {
			messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`File: %s, Content: %s`, file.FilePath, file.Content))))
		}
	}

	for _, chatMessage := range opts.ChatMessages {
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)))
		if chatMessage.Response != "" {
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatMessage.Response)))
		}
	}

	verb := "create"
	if opts.IsUpdate {
		verb = "edit"
	}
	initialUserMessage := fmt.Sprintf("Describe the plan only (do not write code) to %s a helm chart based on the previous discussion. ", verb)

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(initialUserMessage)))

	// tools := []anthropic.ToolParam{
	// 	{
	// 		Name:        anthropic.F("recommended_dependency"),
	// 		Description: anthropic.F("Recommend a specific subchart or version of a subchart given a requirement"),
	// 		InputSchema: anthropic.F(interface{}(map[string]interface{}{
	// 			"type": "object",
	// 			"properties": map[string]interface{}{
	// 				"requirement": map[string]interface{}{
	// 					"type":        "string",
	// 					"description": "The requirement to recommend a dependency for, e.g. Redis, Mysql",
	// 				},
	// 			},
	// 			"required": []string{"requirement"},
	// 		})),
	// 	},
	// }

	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(DefaultModel),
		MaxTokens: anthropic.F(int64(8192)),
		// Tools:     anthropic.F(tools),
		Messages: anthropic.F(messages),
	})

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				streamCh <- delta.Text
			}
		}
	}

	if err := stream.Err(); err != nil {
		logger.Error(err,
			zap.String("context", "stream error while creating plan"),
			zap.Bool("isUpdate", opts.IsUpdate),
		)
		doneCh <- fmt.Errorf("failed to stream plan: %w", err)
		return fmt.Errorf("failed to stream plan: %w", err)
	}

	logger.Debug("Plan created successfully",
		zap.Bool("isUpdate", opts.IsUpdate),
	)
	doneCh <- nil
	return nil
}
