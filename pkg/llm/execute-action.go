package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/diff"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type CreateWorkspaceFromArchiveAction struct {
	ArchivePath string `json:"archivePath"`
	ArchiveType string `json:"archiveType"` // New field: "helm" or "k8s"
}

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, currentContent string, patchStreamCh chan string) (string, error) {
	originalContent := currentContent
	updatedContent := currentContent

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(executePlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
	}

	detailedPlanMessage := fmt.Sprintf("The Helm chart plan is: %s", plan.Description)
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanMessage)))

	if actionPlanWithPath.Action == "create" {
		createMessage := fmt.Sprintf("Create the file at %s", actionPlanWithPath.Path)
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(createMessage)))
	} else if actionPlanWithPath.Action == "update" {
		updateMessage := fmt.Sprintf(`The file at %s needs to be updated according to the plan.`,
			actionPlanWithPath.Path)

		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(updateMessage)))
	}

	tools := []anthropic.ToolParam{
		{
			Name: anthropic.F("text_editor_20250124"),
			InputSchema: anthropic.F(interface{}(map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"command": map[string]interface{}{
						"type": "string",
						"enum": []string{"view", "str_replace"},
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

	for {
		stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
			Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
			MaxTokens: anthropic.F(int64(8192)),
			Messages:  anthropic.F(messages),
			Tools:     anthropic.F(toolUnionParams),
		})

		message := anthropic.Message{}
		for stream.Next() {
			event := stream.Current()
			err := message.Accumulate(event)
			if err != nil {
				return "", err
			}
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

				if input.Command == "view" {
					response = updatedContent
				} else if input.Command == "str_replace" {
					patchedContent := strings.ReplaceAll(updatedContent, input.OldStr, input.NewStr)
					patch, err := diff.GeneratePatch(updatedContent, patchedContent, actionPlanWithPath.Path)
					if err != nil {
						return "", err
					}

					updatedContent = patchedContent
					patchStreamCh <- patch
					response = "Updated"
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

	// Generate a unified diff patch
	patch, err := diff.GeneratePatch(currentContent, originalContent, actionPlanWithPath.Path)
	if err != nil {
		return "", fmt.Errorf("failed to generate patch: %w", err)
	}

	// Send the patch to the channel if it's provided
	if patchStreamCh != nil {
		patchStreamCh <- patch
	}

	return updatedContent, nil
}
