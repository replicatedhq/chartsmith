package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	openai "github.com/sashabaranov/go-openai"
	"github.com/replicatedhq/chartsmith/pkg/recommendations"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ConversationalChatMessage(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, chatMessage *workspacetypes.Chat) error {
	provider := getProvider()
	
	if provider == "openrouter" {
		return ConversationalChatMessageOpenRouter(ctx, streamCh, doneCh, w, chatMessage)
	}
	
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatOnlySystemPrompt)),
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatOnlyInstructions)),
	}

	var c *workspacetypes.Chart
	c = &w.Charts[0]

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

	// we want to limit the number of files to 10
	maxFiles := 10
	if len(relevantFiles) < maxFiles {
		maxFiles = len(relevantFiles)
	}
	relevantFiles = relevantFiles[:maxFiles]

	// add the context of the workspace to the chat
	messages = append(messages,
		anthropic.NewAssistantMessage(
			anthropic.NewTextBlock(fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure)),
		),
	)

	for _, file := range relevantFiles {
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(fmt.Sprintf(`File: %s, Content: %s`, file.File.FilePath, file.File.Content))))
	}

	// we need to get the previous plan, and then all followup chat messages since that plan
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
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chat.Prompt)))
		}

		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(plan.Description)))

	}

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)))

	tools := []anthropic.ToolParam{
		{
			Name:        anthropic.F("latest_subchart_version"),
			Description: anthropic.F("Return the latest version of a subchart from name"),
			InputSchema: anthropic.F(interface{}(map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"chart_name": map[string]interface{}{
						"type":        "string",
						"description": "The subchart name to get the latest version of",
					},
				},
				"required": []string{"chart_name"},
			})),
		},
		{
			Name:        anthropic.F("latest_kubernetes_version"),
			Description: anthropic.F("Return the latest version of Kubernetes"),
			InputSchema: anthropic.F(interface{}(map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"semver_field": map[string]interface{}{
						"type":        "string",
						"description": "One of 'major', 'minor', or 'patch'",
					},
				},
				"required": []string{"semver_description"},
			})),
		},
	}

	toolUnionParams := make([]anthropic.ToolUnionUnionParam, len(tools))
	for i, tool := range tools {
		toolUnionParams[i] = tool
	}

	for {
		stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
			Model:     anthropic.F(GetModel()),
			MaxTokens: anthropic.F(int64(8192)),
			Messages:  anthropic.F(messages),
			Tools:     anthropic.F(toolUnionParams),
		})

		message := anthropic.Message{}
		for stream.Next() {
			event := stream.Current()
			err := message.Accumulate(event)
			if err != nil {
				doneCh <- fmt.Errorf("failed to accumulate message: %w", err)
				return err
			}

			switch event := event.AsUnion().(type) {
			case anthropic.ContentBlockDeltaEvent:
				if event.Delta.Text != "" {
					streamCh <- event.Delta.Text
				}
			}
		}

		if stream.Err() != nil {
			doneCh <- stream.Err()
			return stream.Err()
		}

		messages = append(messages, message.ToParam())

		hasToolCalls := false
		toolResults := []anthropic.ContentBlockParamUnion{}

		for _, block := range message.Content {
			if block.Type == anthropic.ContentBlockTypeToolUse {
				hasToolCalls = true
				var response interface{}
				switch block.Name {
				case "latest_kubernetes_version":
					var input struct {
						SemverField string `json:"semver_field"`
					}
					if err := json.Unmarshal(block.Input, &input); err != nil {
						doneCh <- fmt.Errorf("failed to unmarshal tool input: %w", err)
						return err
					}

					switch input.SemverField {
					case "major":
						response = "1"
					case "minor":
						response = "1.32"
					case "patch":
						response = "1.32.1"
					}
				case "latest_subchart_version":
					var input struct {
						ChartName string `json:"chart_name"`
					}
					if err := json.Unmarshal(block.Input, &input); err != nil {
						doneCh <- fmt.Errorf("failed to unmarshal tool input: %w", err)
						return err
					}

					version, err := recommendations.GetLatestSubchartVersion(input.ChartName)
					if err != nil && err != recommendations.ErrNoArtifactHubPackage {
						doneCh <- fmt.Errorf("failed to get latest subchart version: %w", err)
						return err
					} else if err == recommendations.ErrNoArtifactHubPackage {
						response = "?"
					} else {
						response = version
					}
				}

				b, err := json.Marshal(response)
				if err != nil {
					doneCh <- fmt.Errorf("failed to marshal tool response: %w", err)
					return err
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

	doneCh <- nil
	return nil
}

func getChartStructure(ctx context.Context, c *workspacetypes.Chart) (string, error) {
	structure := ""
	for _, file := range c.Files {
		structure += fmt.Sprintf(`File: %s`, file.FilePath)
	}
	return structure, nil
}

// ConversationalChatMessageOpenRouter handles conversational chat using OpenRouter
func ConversationalChatMessageOpenRouter(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, chatMessage *workspacetypes.Chat) error {
	log.Printf("[OpenRouter] Handling conversational chat message")
	
	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	// Build messages array
	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: chatOnlySystemPrompt + "\n\n" + chatOnlyInstructions,
		},
	}

	var c *workspacetypes.Chart
	c = &w.Charts[0]

	chartStructure, err := getChartStructure(ctx, c)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	expandedPrompt, err := ExpandPromptOpenRouter(ctx, chatMessage.Prompt)
	if err != nil {
		log.Printf("[OpenRouter] Failed to expand prompt, using original: %v", err)
		expandedPrompt = chatMessage.Prompt
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

	// Limit files to 10
	maxFiles := 10
	if len(relevantFiles) < maxFiles {
		maxFiles = len(relevantFiles)
	}
	relevantFiles = relevantFiles[:maxFiles]

	// Add chart context
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleAssistant,
		Content: fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure),
	})

	// Add relevant files
	for _, file := range relevantFiles {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleAssistant,
			Content: fmt.Sprintf(`File: %s, Content: %s`, file.File.FilePath, file.File.Content),
		})
	}

	// Add previous plan if exists
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
			messages = append(messages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleAssistant,
				Content: chat.Prompt,
			})
		}

		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleAssistant,
			Content: plan.Description,
		})
	}

	// Add user message
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: chatMessage.Prompt,
	})

	// Stream the completion
	client.StreamChatCompletion(ctx, messages, streamCh, doneCh)
	return nil
}
