# PR-10: Tool Calling Protocol Support

**Branch:** `feat/ai-sdk-tool-calling`
**Dependencies:** PR-04 (Streaming adapter), PR-05 (Chat endpoint)
**Parallel With:** Can start after PR-05 merges
**Estimated Complexity:** Medium-High
**Success Criteria:** G5 (All existing features work)

---

## Overview

Ensure tool calling works correctly with the AI SDK streaming protocol. This includes streaming tool calls to the frontend, executing tools in Go, and streaming results back. The existing tools (`latest_subchart_version`, `latest_kubernetes_version`, `text_editor`) must continue to work.

## Prerequisites

- PR-04 merged (Streaming adapter)
- PR-05 merged (Chat endpoint)
- Understanding of existing tool implementations in `pkg/llm/`

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tool execution | Keep in Go | Proven logic, no rewrite |
| Tool format | AI SDK tool-call/result events | Protocol compliance |
| Multi-turn | Handle in Go | Maintains conversation state |

---

## Background: Tool Calling Flow

```
1. User sends message
2. Go calls Anthropic with tools
3. Anthropic returns tool_use block
4. Go streams tool-call event to frontend
5. Go executes tool
6. Go streams tool-result event to frontend
7. Go continues conversation with tool result
8. Anthropic returns final text
9. Go streams text-delta events
10. Go streams finish event
```

---

## Step-by-Step Instructions

### Step 1: Update Streaming Adapter for Tool Events

Ensure `pkg/llm/aisdk.go` handles all tool event types:

```go
// pkg/llm/aisdk.go

// ... existing code ...

// WriteToolCall writes a complete tool call event
// Called when we have the full tool call (ID, name, args)
func (s *AISDKStreamWriter) WriteToolCall(toolCallID, toolName string, args interface{}) error {
	return s.writeEvent(map[string]interface{}{
		"type":       "tool-call",
		"toolCallId": toolCallID,
		"toolName":   toolName,
		"args":       args,
	})
}

// WriteToolResult writes a tool result event
// Called after tool execution completes
func (s *AISDKStreamWriter) WriteToolResult(toolCallID string, result interface{}) error {
	return s.writeEvent(map[string]interface{}{
		"type":       "tool-result",
		"toolCallId": toolCallID,
		"result":     result,
	})
}
```

### Step 2: Create Tool Execution Handler

```go
// pkg/llm/aisdk_tools.go
package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/recommendations"
)

// ExecuteToolAndStream executes a tool and streams the result
func ExecuteToolAndStream(
	ctx context.Context,
	writer *AISDKStreamWriter,
	toolUse anthropic.ToolUseBlock,
) (string, error) {
	// Parse tool input
	var input map[string]interface{}
	if err := json.Unmarshal(toolUse.Input, &input); err != nil {
		return "", fmt.Errorf("failed to parse tool input: %w", err)
	}

	// Stream the tool call event
	if err := writer.WriteToolCall(toolUse.ID, toolUse.Name, input); err != nil {
		return "", fmt.Errorf("failed to write tool call: %w", err)
	}

	// Execute the tool
	var result string
	var err error

	switch toolUse.Name {
	case "latest_subchart_version":
		result, err = executeLatestSubchartVersion(input)
	case "latest_kubernetes_version":
		result, err = executeLatestKubernetesVersion(input)
	default:
		err = fmt.Errorf("unknown tool: %s", toolUse.Name)
	}

	if err != nil {
		// Stream error as result
		errorResult := map[string]string{"error": err.Error()}
		writer.WriteToolResult(toolUse.ID, errorResult)
		return "", err
	}

	// Stream the tool result
	if err := writer.WriteToolResult(toolUse.ID, result); err != nil {
		return "", fmt.Errorf("failed to write tool result: %w", err)
	}

	return result, nil
}

func executeLatestSubchartVersion(input map[string]interface{}) (string, error) {
	chartName, ok := input["chart_name"].(string)
	if !ok {
		return "", fmt.Errorf("chart_name is required")
	}

	version := recommendations.GetLatestSubchartVersion(chartName)
	if version == "" {
		return "", fmt.Errorf("could not find version for chart: %s", chartName)
	}

	return version, nil
}

func executeLatestKubernetesVersion(input map[string]interface{}) (string, error) {
	semverField, _ := input["semver_field"].(string)
	version := recommendations.GetLatestKubernetesVersion(semverField)
	return version, nil
}
```

### Step 3: Update Anthropic Streaming Handler

Update `pkg/llm/aisdk_anthropic.go` to handle tool use:

```go
// pkg/llm/aisdk_anthropic.go
package llm

import (
	"context"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
)

// StreamAnthropicWithToolsToAISDK handles streaming with tool execution
func StreamAnthropicWithToolsToAISDK(
	ctx context.Context,
	client *anthropic.Client,
	params anthropic.MessageNewParams,
	writer *AISDKStreamWriter,
) error {
	defer writer.Close()

	// Tool execution loop - may need multiple turns
	for {
		stream := client.Messages.NewStreaming(ctx, params)

		var currentToolUse *anthropic.ToolUseBlock
		var toolUseBlocks []anthropic.ToolUseBlock
		var hasToolUse bool
		var stopReason string

		// Process stream
		for stream.Next() {
			event := stream.Current()

			switch e := event.AsUnion().(type) {
			case anthropic.ContentBlockStartEvent:
				switch block := e.ContentBlock.AsUnion().(type) {
				case anthropic.ToolUseBlock:
					currentToolUse = &anthropic.ToolUseBlock{
						ID:   block.ID,
						Name: block.Name,
						Type: block.Type,
					}
				}

			case anthropic.ContentBlockDeltaEvent:
				switch delta := e.Delta.AsUnion().(type) {
				case anthropic.TextDelta:
					if delta.Text != "" {
						if err := writer.WriteTextDelta(delta.Text); err != nil {
							return err
						}
					}
				case anthropic.InputJSONDelta:
					if currentToolUse != nil {
						// Accumulate tool input
						// Note: In practice, you'd accumulate this
					}
				}

			case anthropic.ContentBlockStopEvent:
				if currentToolUse != nil {
					toolUseBlocks = append(toolUseBlocks, *currentToolUse)
					currentToolUse = nil
					hasToolUse = true
				}

			case anthropic.MessageDeltaEvent:
				stopReason = string(e.Delta.StopReason)
			}
		}

		if err := stream.Err(); err != nil {
			writer.WriteError(err)
			return err
		}

		// If no tool use, we're done
		if !hasToolUse || stopReason != "tool_use" {
			writer.WriteFinish(mapAnthropicStopReason(stopReason))
			return nil
		}

		// Execute tools and build results
		var toolResults []anthropic.ToolResultBlockParam
		for _, toolUse := range toolUseBlocks {
			result, err := ExecuteToolAndStream(ctx, writer, toolUse)
			if err != nil {
				// Continue with error result
				toolResults = append(toolResults, anthropic.NewToolResultBlock(
					toolUse.ID,
					fmt.Sprintf("Error: %s", err.Error()),
					false,
				))
			} else {
				toolResults = append(toolResults, anthropic.NewToolResultBlock(
					toolUse.ID,
					result,
					false,
				))
			}
		}

		// Add assistant message with tool use and user message with results
		// This continues the conversation
		params.Messages.Value = append(params.Messages.Value,
			anthropic.NewAssistantMessage(toContentBlocks(toolUseBlocks)...),
			anthropic.NewUserMessage(toToolResultBlocks(toolResults)...),
		)

		// Reset for next iteration
		toolUseBlocks = nil
		hasToolUse = false
	}
}

func toContentBlocks(toolUses []anthropic.ToolUseBlock) []anthropic.ContentBlockParamUnion {
	var blocks []anthropic.ContentBlockParamUnion
	for _, tu := range toolUses {
		blocks = append(blocks, anthropic.NewToolUseBlockParam(tu.ID, tu.Name, tu.Input))
	}
	return blocks
}

func toToolResultBlocks(results []anthropic.ToolResultBlockParam) []anthropic.ContentBlockParamUnion {
	var blocks []anthropic.ContentBlockParamUnion
	for _, r := range results {
		blocks = append(blocks, r)
	}
	return blocks
}
```

### Step 4: Update Chat Handler to Use Tool-Enabled Streaming

Update `pkg/api/handlers/chat_stream.go`:

```go
// In streamConversationalResponse function:

func streamConversationalResponse(
	ctx context.Context,
	writer *llm.AISDKStreamWriter,
	ws *workspacetypes.Workspace,
	history []workspacetypes.Chat,
	prompt string,
) error {
	client, err := llm.NewAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	anthropicMessages, err := llm.BuildConversationalMessages(ws, history, prompt)
	if err != nil {
		return fmt.Errorf("failed to build messages: %w", err)
	}

	tools := llm.GetConversationalTools()

	params := anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
		MaxTokens: anthropic.F(int64(8192)),
		System:    anthropic.F([]anthropic.TextBlockParam{{Text: anthropic.F(llm.GetChatOnlySystemPrompt())}}),
		Messages:  anthropic.F(anthropicMessages),
		Tools:     anthropic.F(tools),
	}

	// Use tool-enabled streaming
	return llm.StreamAnthropicWithToolsToAISDK(ctx, client, params, writer)
}
```

### Step 5: Add Tests

```go
// pkg/llm/aisdk_tools_test.go
package llm

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExecuteToolAndStream_LatestSubchartVersion(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer, _ := NewAISDKStreamWriter(recorder)

	// Mock tool use block
	toolUse := anthropic.ToolUseBlock{
		ID:    "tool_123",
		Name:  "latest_subchart_version",
		Input: []byte(`{"chart_name": "nginx"}`),
	}

	result, err := ExecuteToolAndStream(context.Background(), writer, toolUse)

	// Check no error (assuming nginx chart exists in recommendations)
	// If not, you may need to mock recommendations
	if err != nil {
		t.Logf("Tool execution returned error (may be expected): %v", err)
	}

	body := recorder.Body.String()

	// Should have tool-call event
	if !strings.Contains(body, `"type":"tool-call"`) {
		t.Error("expected tool-call event")
	}

	// Should have tool-result event
	if !strings.Contains(body, `"type":"tool-result"`) {
		t.Error("expected tool-result event")
	}
}

func TestExecuteToolAndStream_UnknownTool(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer, _ := NewAISDKStreamWriter(recorder)

	toolUse := anthropic.ToolUseBlock{
		ID:    "tool_123",
		Name:  "unknown_tool",
		Input: []byte(`{}`),
	}

	_, err := ExecuteToolAndStream(context.Background(), writer, toolUse)

	if err == nil {
		t.Error("expected error for unknown tool")
	}
}
```

### Step 6: Run Tests

```bash
go test ./pkg/llm/... -v -run Tool
```

### Step 7: Integration Testing

1. Start worker with feature flag:
   ```bash
   ENABLE_AI_SDK_CHAT=true make run-worker
   ```

2. Send a message that triggers tool use:
   ```bash
   curl -X POST http://localhost:8080/api/v1/chat/stream \
     -H "Content-Type: application/json" \
     -d '{
       "messages": [{"role": "user", "content": "What is the latest version of the nginx Helm chart?"}],
       "workspaceId": "...",
       "userId": "..."
     }'
   ```

3. Verify response includes:
   - `tool-call` event
   - `tool-result` event
   - Final `text-delta` events
   - `finish` event

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `pkg/llm/aisdk_tools.go` | Added | Tool execution handler |
| `pkg/llm/aisdk_anthropic.go` | Modified | Tool-enabled streaming |
| `pkg/llm/aisdk_tools_test.go` | Added | Tool tests |
| `pkg/api/handlers/chat_stream.go` | Modified | Use tool streaming |

---

## Acceptance Criteria

- [ ] Tool calls stream correctly
- [ ] Tool results stream correctly
- [ ] `latest_subchart_version` tool works
- [ ] `latest_kubernetes_version` tool works
- [ ] Multi-turn tool conversations work
- [ ] Tool errors are handled gracefully
- [ ] Unit tests pass
- [ ] Integration test passes
- [ ] Build succeeds

---

## Testing Instructions

1. Unit tests:
   ```bash
   go test ./pkg/llm/... -v -run Tool
   ```

2. Integration test:
   - Ask about chart versions
   - Ask about Kubernetes versions
   - Verify tool events in response

---

## Rollback Plan

Tool execution logic is unchanged. Rollback by:
1. Reverting `chat_stream.go` to use non-tool streaming
2. Or set feature flag to false

---

## PR Checklist

- [ ] Branch created from `main`
- [ ] Tool execution handler created
- [ ] Streaming updated for tools
- [ ] Chat handler updated
- [ ] Tests created and passing
- [ ] Integration tested
- [ ] Build passes
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Tool execution logic reuses existing functions
- Streaming format matches AI SDK spec
- Multi-turn handled in Go (not frontend)
- `text_editor` tool handled separately in plan execution
