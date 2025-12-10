package llm

import (
	"context"
	"encoding/json"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/recommendations"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

// ConversationalChatMessage handles conversational chat interactions with the LLM.
// It processes a chat message within the context of a workspace, including relevant files,
// chart structure, and previous conversation history. The function supports tool use for
// querying Kubernetes versions and subchart versions.
//
// The response is streamed via streamCh, and errors or completion are signaled via doneCh.
//
// Note: This implementation uses anthropic-sdk-go directly. During the AI SDK migration,
// this pattern is maintained for backward compatibility while adding cleaner configuration
// through the Config struct and model constants.
func ConversationalChatMessage(ctx context.Context, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, chatMessage *workspacetypes.Chat) error {
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
		// Create a streaming request using the configured model and max tokens.
		// The model constant (DefaultModel) allows for easy model upgrades across the codebase.
		stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
			Model:     anthropic.F(DefaultModel),
			MaxTokens: anthropic.F(int64(DefaultMaxTokens)),
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

		// Process tool calls from the LLM response.
		// Supported tools:
		//   - latest_kubernetes_version: Returns the latest K8s version for a given semver field
		//   - latest_subchart_version: Queries ArtifactHub for the latest version of a subchart
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
						err = fmt.Errorf("failed to unmarshal tool input for %s: %w", block.Name, err)
						doneCh <- err
						return err
					}

					// Return the latest Kubernetes version based on the semver field requested
					switch input.SemverField {
					case "major":
						response = "1"
					case "minor":
						response = "1.32"
					case "patch":
						response = "1.32.1"
					default:
						// Default to patch version if an invalid field is specified
						response = "1.32.1"
					}
				case "latest_subchart_version":
					var input struct {
						ChartName string `json:"chart_name"`
					}
					if err := json.Unmarshal(block.Input, &input); err != nil {
						err = fmt.Errorf("failed to unmarshal tool input for %s: %w", block.Name, err)
						doneCh <- err
						return err
					}

					// Query ArtifactHub for the latest version of the requested subchart
					version, err := recommendations.GetLatestSubchartVersion(input.ChartName)
					if err != nil && err != recommendations.ErrNoArtifactHubPackage {
						err = fmt.Errorf("failed to get latest subchart version for %s: %w", input.ChartName, err)
						doneCh <- err
						return err
					} else if err == recommendations.ErrNoArtifactHubPackage {
						// Return "?" if the package is not found on ArtifactHub
						response = "?"
					} else {
						response = version
					}
				default:
					// Log unexpected tool names but continue processing
					err := fmt.Errorf("unknown tool called: %s", block.Name)
					doneCh <- err
					return err
				}

				b, err := json.Marshal(response)
				if err != nil {
					err = fmt.Errorf("failed to marshal tool response for %s: %w", block.Name, err)
					doneCh <- err
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

// getChartStructure builds a string representation of the chart's file structure.
// This is used to provide context to the LLM about the workspace organization.
// Returns a formatted string listing all files in the chart.
func getChartStructure(ctx context.Context, c *workspacetypes.Chart) (string, error) {
	structure := ""
	for _, file := range c.Files {
		structure += fmt.Sprintf(`File: %s`, file.FilePath)
	}
	return structure, nil
}
