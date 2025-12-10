package llm

import (
	"context"
	"encoding/json"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

// StreamConversationalChatAISDK streams a conversational chat response with tool support
// using the Vercel AI SDK Data Stream Protocol format.
//
// This function handles the full conversation loop including:
//   - Building context from workspace, chart structure, and relevant files
//   - Streaming text deltas as they arrive from Anthropic
//   - Detecting and streaming tool calls (with argument deltas)
//   - Executing tools and streaming results
//   - Continuing conversation until no more tool calls
//   - Outputting finish event when complete
//
// The function writes events to the provided AISDKStreamWriter in real-time,
// allowing the frontend useChat hook to display streaming responses.
//
// Parameters:
//   - ctx: Context for cancellation and timeouts
//   - writer: AISDKStreamWriter that outputs AI SDK protocol events
//   - ws: Workspace containing chart and file context
//   - history: Previous chat messages for conversation context
//   - prompt: Current user prompt
//
// Returns an error if streaming fails or tool execution fails.
//
// See: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
func StreamConversationalChatAISDK(
	ctx context.Context,
	writer *AISDKStreamWriter,
	ws *workspacetypes.Workspace,
	history []workspacetypes.Chat,
	prompt string,
) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	// Build messages for Anthropic
	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatOnlySystemPrompt)),
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatOnlyInstructions)),
	}

	var c *workspacetypes.Chart
	if len(ws.Charts) > 0 {
		c = &ws.Charts[0]
	}

	chartStructure, err := getChartStructure(ctx, c)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	expandedPrompt, err := ExpandPrompt(ctx, prompt)
	if err != nil {
		return fmt.Errorf("failed to expand prompt: %w", err)
	}

	var chartID *string
	if len(ws.Charts) > 0 {
		chartID = &ws.Charts[0].ID
	}

	relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(
		ctx,
		ws,
		workspace.WorkspaceFilter{
			ChartID: chartID,
		},
		ws.CurrentRevision,
		expandedPrompt,
	)
	if err != nil {
		return fmt.Errorf("failed to choose relevant files: %w", err)
	}

	// Limit to 10 files
	maxFiles := 10
	if len(relevantFiles) < maxFiles {
		maxFiles = len(relevantFiles)
	}
	relevantFiles = relevantFiles[:maxFiles]

	// Add chart structure context
	messages = append(messages,
		anthropic.NewAssistantMessage(
			anthropic.NewTextBlock(fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure)),
		),
	)

	// Add relevant files
	for _, file := range relevantFiles {
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(fmt.Sprintf(`File: %s, Content: %s`, file.File.FilePath, file.File.Content))))
	}

	// Add previous plan and chat messages if available
	plan, err := workspace.GetMostRecentPlan(ctx, ws.ID)
	if err != nil && err != workspace.ErrNoPlan {
		return fmt.Errorf("failed to get most recent plan: %w", err)
	}

	if plan != nil {
		previousChatMessages, err := workspace.ListChatMessagesAfterPlan(ctx, plan.ID)
		if err != nil {
			return fmt.Errorf("failed to list chat messages: %w", err)
		}

		for _, chat := range previousChatMessages {
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chat.Prompt)))
		}

		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(plan.Description)))
	}

	// Add chat history
	for _, chat := range history {
		if chat.Prompt != "" {
			messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chat.Prompt)))
		}
		if chat.Response != "" {
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chat.Response)))
		}
	}

	// Add current prompt
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(prompt)))

	// Get tools
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
				"required": []string{"semver_field"},
			})),
		},
	}

	toolUnionParams := make([]anthropic.ToolUnionUnionParam, len(tools))
	for i, tool := range tools {
		toolUnionParams[i] = tool
	}

	// Conversation loop - continue until no more tool calls
	for {
		stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
			Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
			MaxTokens: anthropic.F(int64(8192)),
			Messages:  anthropic.F(messages),
			Tools:     anthropic.F(toolUnionParams),
		})

		// Accumulate message to detect tool calls while streaming
		message := anthropic.Message{}
		var stopReason string
		var currentToolCallID string

		for stream.Next() {
			event := stream.Current()
			if err := message.Accumulate(event); err != nil {
				return fmt.Errorf("failed to accumulate message: %w", err)
			}

			// Stream events to frontend - handle text deltas and tool calls
			switch e := event.AsUnion().(type) {
			case anthropic.ContentBlockStartEvent:
				// Handle tool use block start
				if e.ContentBlock.Type == "tool_use" || e.ContentBlock.Type == "server_tool_use" {
					currentToolCallID = e.ContentBlock.ID
					if err := writer.WriteToolCallStart(e.ContentBlock.ID, e.ContentBlock.Name); err != nil {
						return fmt.Errorf("failed to write tool call start: %w", err)
					}
				}
			case anthropic.ContentBlockDeltaEvent:
				if e.Delta.Type == "text_delta" && e.Delta.Text != "" {
					if err := writer.WriteTextDelta(e.Delta.Text); err != nil {
						return fmt.Errorf("failed to write text delta: %w", err)
					}
				} else if e.Delta.Type == "input_json_delta" && e.Delta.PartialJSON != "" {
					// Stream tool argument deltas as they arrive
					if currentToolCallID != "" {
						if err := writer.WriteToolCallDelta(currentToolCallID, e.Delta.PartialJSON); err != nil {
							return fmt.Errorf("failed to write tool call delta: %w", err)
						}
					}
				}
			case anthropic.ContentBlockStopEvent:
				// Clear current tool call ID when block stops
				currentToolCallID = ""
			case anthropic.MessageDeltaEvent:
				if e.Delta.StopReason != "" {
					stopReason = string(e.Delta.StopReason)
				}
			}
		}

		if stream.Err() != nil {
			return fmt.Errorf("stream error: %w", stream.Err())
		}

		// Add assistant message to conversation
		messages = append(messages, message.ToParam())

		// Check for tool calls
		var toolUseBlocks []anthropic.ToolUseBlock
		for _, block := range message.Content {
			if block.Type == anthropic.ContentBlockTypeToolUse {
				toolUseBlocks = append(toolUseBlocks, block)
			}
		}

		// If no tool calls, we're done
		if len(toolUseBlocks) == 0 {
			// Write finish event
			finishReason := mapAnthropicStopReason(stopReason)
			if finishReason == "" {
				finishReason = "stop"
			}
			if err := writer.WriteFinish(finishReason); err != nil {
				return fmt.Errorf("failed to write finish: %w", err)
			}
			break
		}

		// Execute tools and stream results
		toolResults := []anthropic.ContentBlockParamUnion{}
		for _, toolUse := range toolUseBlocks {
			resultStr, err := ExecuteToolAndStream(ctx, writer, toolUse)
			if err != nil {
				// Stream error as tool result
				errorResult := map[string]string{"error": err.Error()}
				if writeErr := writer.WriteToolResult(toolUse.ID, errorResult); writeErr != nil {
					return fmt.Errorf("failed to stream error result: %w (original: %v)", writeErr, err)
				}
				resultStr = fmt.Sprintf(`{"error":"%s"}`, err.Error())
			}

			// Create tool result block for conversation continuation
			toolResults = append(toolResults, anthropic.NewToolResultBlock(
				toolUse.ID,
				resultStr,
				false,
			))
		}

		// Add tool results to conversation and continue
		messages = append(messages, anthropic.MessageParam{
			Role:    anthropic.F(anthropic.MessageParamRoleUser),
			Content: anthropic.F(toolResults),
		})
	}

	return nil
}
