package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

const (
	TextEditor_Sonnet37 = "text_editor_20250124"
	TextEditor_Sonnet35 = "text_editor_20241022"

	Model_Sonnet37 = "claude-3-7-sonnet-20250219"
	Model_Sonnet35 = "claude-3-5-sonnet-20241022"
)

type CreateWorkspaceFromArchiveAction struct {
	ArchivePath string `json:"archivePath"`
	ArchiveType string `json:"archiveType"` // New field: "helm" or "k8s"
}

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, currentContent string, interimContentCh chan string) (string, error) {
	updatedContent := currentContent

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(executePlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
	}

	// Add more explicit instructions about the file workflow
	workflowInstructions := `
		Important workflow instructions:
		1. For ANY file operation, ALWAYS use "view" command first to check if a file exists and view its contents.
		2. Only after viewing, decide whether to use "create" (if file doesn't exist) or "str_replace" (if file exists).
		3. Never use "create" on an existing file.
		`

	messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(plan.Description)))

	if actionPlanWithPath.Action == "create" {
		logger.Debug("create file", zap.String("path", actionPlanWithPath.Path))
		createMessage := fmt.Sprintf("Create the file at %s", actionPlanWithPath.Path)
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(workflowInstructions+createMessage)))
	} else if actionPlanWithPath.Action == "update" {
		logger.Debug("update file", zap.String("path", actionPlanWithPath.Path))
		updateMessage := fmt.Sprintf(`The file at %s needs to be updated according to the plan.`,
			actionPlanWithPath.Path)

		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(workflowInstructions+updateMessage)))
	}

	tools := []anthropic.ToolParam{
		{
			Name: anthropic.F(TextEditor_Sonnet35),
			InputSchema: anthropic.F(interface{}(map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"command": map[string]interface{}{
						"type": "string",
						"enum": []string{"view", "str_replace", "create"},
					},
					"path": map[string]interface{}{
						"type": "string",
					},
					"old_str": map[string]interface{}{
						"type": "string",
					},
					"new_str": map[string]interface{}{
						"type": "string",
					},
				},
			})),
		},
	}

	toolUnionParams := make([]anthropic.ToolUnionUnionParam, len(tools))
	for i, tool := range tools {
		toolUnionParams[i] = tool
	}

	var disabled anthropic.ThinkingConfigEnabledType
	disabled = "disabled"

	for {
		stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
			Model:     anthropic.F(Model_Sonnet35),
			MaxTokens: anthropic.F(int64(8192)),
			Messages:  anthropic.F(messages),
			Tools:     anthropic.F(toolUnionParams),
			Thinking: anthropic.F[anthropic.ThinkingConfigParamUnion](anthropic.ThinkingConfigEnabledParam{
				Type: anthropic.F(disabled),
			}),
		})

		message := anthropic.Message{}
		for stream.Next() {
			event := stream.Current()
			err := message.Accumulate(event)
			if err != nil {
				return "", err
			}

			// switch event := event.AsUnion().(type) {
			// case anthropic.ContentBlockDeltaEvent:
			// 	if event.Delta.Text != "" {
			// 		fmt.Printf("%s", event.Delta.Text)
			// 	}
			// }
		}

		if stream.Err() != nil {
			return "", stream.Err()
		}

		messages = append(messages, message.ToParam())

		hasToolCalls := false
		toolResults := []anthropic.ContentBlockParamUnion{}

		for _, block := range message.Content {
			if block.Type == anthropic.ContentBlockTypeToolUse {
				hasToolCalls = true
				var response interface{}

				var input struct {
					Command string `json:"command"`
					Path    string `json:"path"`
					OldStr  string `json:"old_str"`
					NewStr  string `json:"new_str"`
				}

				if err := json.Unmarshal(block.Input, &input); err != nil {
					return "", err
				}

				logger.Info("LLM text_editor tool use",
					zap.String("command", input.Command),
					zap.String("path", input.Path),
					zap.Int("old_str_len", len(input.OldStr)),
					zap.Int("new_str_len", len(input.NewStr)))

				if input.Command == "view" {
					if updatedContent == "" {
						// File doesn't exist yet
						response = "Error: File does not exist. Use create instead."
					} else {
						response = updatedContent
					}
				} else if input.Command == "str_replace" {
					if !strings.Contains(updatedContent, input.OldStr) {
						response = "Error: String to replace not found in file"
					} else {
						updatedContent = strings.ReplaceAll(updatedContent, input.OldStr, input.NewStr)

						// Send updated content through the channel
						interimContentCh <- updatedContent
						response = "Content replaced successfully"
					}
				} else if input.Command == "create" {
					if updatedContent != "" {
						response = "Error: File already exists. Use view and str_replace instead."
					} else {
						updatedContent = input.NewStr

						interimContentCh <- updatedContent
						response = "Created"
					}
				}

				b, err := json.Marshal(response)
				if err != nil {
					return "", err
				}

				toolResults = append(toolResults, anthropic.NewToolResultBlock(block.ID, string(b), false))
			}
		}

		if !hasToolCalls {
			break
		}

		messages = append(messages, anthropic.MessageParam{
			Role:    anthropic.F(anthropic.MessageParamRoleUser),
			Content: anthropic.F(toolResults),
		})
	}

	return updatedContent, nil
}
