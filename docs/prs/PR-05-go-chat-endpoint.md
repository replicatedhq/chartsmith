# PR-05: Go Chat HTTP Endpoint

**Branch:** `feat/go-chat-http-endpoint`
**Dependencies:** PR-04 (Go streaming adapter)
**Parallel With:** PR-06 (after this merges)
**Estimated Complexity:** Medium
**Success Criteria:** G2, G3 (Backend streams AI SDK format)

---

## Overview

Create a new HTTP endpoint in the Go worker that accepts chat requests and streams responses using the AI SDK Data Stream Protocol. This endpoint will be called by the Next.js API route proxy.

## Prerequisites

- PR-04 merged (AI SDK streaming adapter available)
- Understanding of existing chat flow in `pkg/listener/conversational.go`
- Understanding of existing LLM calls in `pkg/llm/conversational.go`

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Endpoint path | `POST /api/v1/chat/stream` | RESTful, versioned, clear purpose |
| Auth mechanism | Reuse existing session/JWT | Consistent with app |
| Request format | AI SDK message array | Standard format |
| Feature flag | Check `ENABLE_AI_SDK_CHAT` | Safe rollout |

---

## Step-by-Step Instructions

### Step 1: Define Request/Response Types

Create types file:

```go
// pkg/api/types/chat.go
package types

// AISDKMessage represents a message in AI SDK format
type AISDKMessage struct {
	ID        string                 `json:"id"`
	Role      string                 `json:"role"` // "user", "assistant", "system"
	Content   string                 `json:"content"`
	CreatedAt string                 `json:"createdAt,omitempty"`
	ToolCalls []AISDKToolInvocation  `json:"toolInvocations,omitempty"`
}

// AISDKToolInvocation represents a tool call
type AISDKToolInvocation struct {
	ToolCallID string                 `json:"toolCallId"`
	ToolName   string                 `json:"toolName"`
	Args       map[string]interface{} `json:"args"`
	Result     interface{}            `json:"result,omitempty"`
}

// ChatStreamRequest is the request body for the chat stream endpoint
type ChatStreamRequest struct {
	Messages    []AISDKMessage `json:"messages"`
	WorkspaceID string         `json:"workspaceId"`
	UserID      string         `json:"userId"`
}
```

### Step 2: Create the Chat Stream Handler

Create the handler file:

```go
// pkg/api/handlers/chat_stream.go
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/replicatedhq/chartsmith/pkg/api/types"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

// ChatStreamHandler handles AI SDK chat streaming requests
func ChatStreamHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check feature flag
	if !param.Get().EnableAISDKChat {
		http.Error(w, "AI SDK chat not enabled", http.StatusNotFound)
		return
	}

	// Only accept POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req types.ChatStreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("Failed to parse chat request", zap.Error(err))
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if len(req.Messages) == 0 {
		http.Error(w, "Messages array is required", http.StatusBadRequest)
		return
	}
	if req.WorkspaceID == "" {
		http.Error(w, "workspaceId is required", http.StatusBadRequest)
		return
	}
	if req.UserID == "" {
		http.Error(w, "userId is required", http.StatusBadRequest)
		return
	}

	// Get workspace context
	ws, err := workspace.GetWorkspace(ctx, req.WorkspaceID)
	if err != nil {
		logger.Error("Failed to get workspace", zap.Error(err), zap.String("workspaceId", req.WorkspaceID))
		http.Error(w, "Workspace not found", http.StatusNotFound)
		return
	}

	// Create AI SDK stream writer
	streamWriter, err := llm.NewAISDKStreamWriter(w)
	if err != nil {
		logger.Error("Failed to create stream writer", zap.Error(err))
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	// Convert AI SDK messages to internal format
	chatMessages := convertAISDKMessagesToInternal(req.Messages)

	// Get the latest user message for the prompt
	latestPrompt := ""
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			latestPrompt = req.Messages[i].Content
			break
		}
	}

	// Stream the response
	if err := streamConversationalResponse(ctx, streamWriter, ws, chatMessages, latestPrompt); err != nil {
		logger.Error("Failed to stream response", zap.Error(err))
		// Try to send error event if stream is still open
		streamWriter.WriteError(err)
		return
	}
}

// convertAISDKMessagesToInternal converts AI SDK messages to our internal format
func convertAISDKMessagesToInternal(messages []types.AISDKMessage) []workspacetypes.Chat {
	var result []workspacetypes.Chat

	for _, msg := range messages {
		chat := workspacetypes.Chat{}

		switch msg.Role {
		case "user":
			chat.Prompt = msg.Content
		case "assistant":
			chat.Response = msg.Content
		case "system":
			// System messages are handled separately in prompts
			continue
		}

		result = append(result, chat)
	}

	return result
}

// streamConversationalResponse handles the actual LLM streaming
func streamConversationalResponse(
	ctx context.Context,
	writer *llm.AISDKStreamWriter,
	ws *workspacetypes.Workspace,
	history []workspacetypes.Chat,
	prompt string,
) error {
	// This integrates with existing ConversationalChatMessage logic
	// but outputs to AI SDK format instead of Centrifugo

	client, err := llm.NewAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	// Build messages for Anthropic
	anthropicMessages, err := llm.BuildConversationalMessages(ws, history, prompt)
	if err != nil {
		return fmt.Errorf("failed to build messages: %w", err)
	}

	// Get tools
	tools := llm.GetConversationalTools()

	// Create streaming request
	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
		MaxTokens: anthropic.F(int64(8192)),
		System:    anthropic.F([]anthropic.TextBlockParam{{Text: anthropic.F(llm.GetChatOnlySystemPrompt())}}),
		Messages:  anthropic.F(anthropicMessages),
		Tools:     anthropic.F(tools),
	})

	// Stream using adapter
	if err := llm.StreamAnthropicToAISDK(ctx, stream, writer); err != nil {
		return fmt.Errorf("failed to stream response: %w", err)
	}

	return nil
}
```

### Step 3: Add Feature Flag to Params

Update the params to include the feature flag:

```go
// pkg/param/param.go
// Add to the Params struct:

type Params struct {
	// ... existing fields ...

	// EnableAISDKChat enables the AI SDK chat endpoint
	EnableAISDKChat bool `env:"ENABLE_AI_SDK_CHAT" default:"false"`
}
```

### Step 4: Register the Route

Find where routes are registered (likely in `cmd/` or `pkg/api/`) and add:

```go
// Add to route registration (location depends on your setup)
// Example for standard http.ServeMux:

mux.HandleFunc("/api/v1/chat/stream", handlers.ChatStreamHandler)

// Or for gorilla/mux:
router.HandleFunc("/api/v1/chat/stream", handlers.ChatStreamHandler).Methods("POST")

// Or for chi:
r.Post("/api/v1/chat/stream", handlers.ChatStreamHandler)
```

### Step 5: Add Helper Functions to LLM Package

Export necessary functions from the llm package:

```go
// pkg/llm/conversational_helpers.go
package llm

import (
	"github.com/anthropics/anthropic-sdk-go"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

// NewAnthropicClient creates a new Anthropic client
// Exported for use by chat stream handler
func NewAnthropicClient(ctx context.Context) (*anthropic.Client, error) {
	return newAnthropicClient(ctx)
}

// BuildConversationalMessages builds Anthropic messages from history
// Exported for use by chat stream handler
func BuildConversationalMessages(
	ws *workspacetypes.Workspace,
	history []workspacetypes.Chat,
	prompt string,
) ([]anthropic.MessageParam, error) {
	// Implementation: convert history + prompt to Anthropic format
	// This should reuse existing logic from conversational.go

	var messages []anthropic.MessageParam

	// Add history
	for _, chat := range history {
		if chat.Prompt != "" {
			messages = append(messages, anthropic.NewUserMessage(
				anthropic.NewTextBlock(chat.Prompt),
			))
		}
		if chat.Response != "" {
			messages = append(messages, anthropic.NewAssistantMessage(
				anthropic.NewTextBlock(chat.Response),
			))
		}
	}

	// Add current prompt
	messages = append(messages, anthropic.NewUserMessage(
		anthropic.NewTextBlock(prompt),
	))

	return messages, nil
}

// GetConversationalTools returns tools for conversational chat
// Exported for use by chat stream handler
func GetConversationalTools() []anthropic.ToolParam {
	return []anthropic.ToolParam{
		{
			Name:        anthropic.F("latest_subchart_version"),
			Description: anthropic.F("Return the latest version of a subchart from a Helm repository"),
			InputSchema: anthropic.F[interface{}](map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"chart_name": map[string]interface{}{
						"type":        "string",
						"description": "The name of the subchart",
					},
				},
				"required": []string{"chart_name"},
			}),
		},
		{
			Name:        anthropic.F("latest_kubernetes_version"),
			Description: anthropic.F("Return the latest version of Kubernetes"),
			InputSchema: anthropic.F[interface{}](map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"semver_field": map[string]interface{}{
						"type":        "string",
						"description": "Which semver field to return (major, minor, patch)",
					},
				},
			}),
		},
	}
}

// GetChatOnlySystemPrompt returns the system prompt for chat
// Exported for use by chat stream handler
func GetChatOnlySystemPrompt() string {
	return chatOnlySystemPrompt
}
```

### Step 6: Create Integration Test

```go
// pkg/api/handlers/chat_stream_test.go
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/replicatedhq/chartsmith/pkg/api/types"
)

func TestChatStreamHandler_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/stream", nil)
	w := httptest.NewRecorder()

	ChatStreamHandler(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405, got %d", w.Code)
	}
}

func TestChatStreamHandler_InvalidBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/stream", bytes.NewReader([]byte("invalid json")))
	w := httptest.NewRecorder()

	ChatStreamHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestChatStreamHandler_MissingMessages(t *testing.T) {
	body := types.ChatStreamRequest{
		WorkspaceID: "test",
		UserID:      "test",
		Messages:    []types.AISDKMessage{},
	}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/stream", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	ChatStreamHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestChatStreamHandler_MissingWorkspaceID(t *testing.T) {
	body := types.ChatStreamRequest{
		UserID: "test",
		Messages: []types.AISDKMessage{
			{Role: "user", Content: "Hello"},
		},
	}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/stream", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	ChatStreamHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}
```

### Step 7: Run Tests

```bash
go test ./pkg/api/... -v
```

### Step 8: Manual Testing

1. Start the worker with feature flag enabled:
   ```bash
   ENABLE_AI_SDK_CHAT=true make run-worker
   ```

2. Test with curl:
   ```bash
   curl -X POST http://localhost:8080/api/v1/chat/stream \
     -H "Content-Type: application/json" \
     -d '{
       "messages": [{"role": "user", "content": "Hello"}],
       "workspaceId": "YOUR_WORKSPACE_ID",
       "userId": "YOUR_USER_ID"
     }'
   ```

3. Verify SSE format in response

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `pkg/api/types/chat.go` | Added | Request/response types |
| `pkg/api/handlers/chat_stream.go` | Added | Chat stream handler |
| `pkg/api/handlers/chat_stream_test.go` | Added | Handler tests |
| `pkg/llm/conversational_helpers.go` | Added | Exported helper functions |
| `pkg/param/param.go` | Modified | Added feature flag |
| Route registration file | Modified | Added new route |

---

## Acceptance Criteria

- [ ] `POST /api/v1/chat/stream` endpoint exists
- [ ] Endpoint returns 404 when feature flag is disabled
- [ ] Endpoint validates required fields
- [ ] Endpoint streams SSE responses
- [ ] Response format matches AI SDK protocol
- [ ] System prompts are preserved (G4)
- [ ] Unit tests pass
- [ ] Build succeeds

---

## Testing Instructions

1. Unit tests:
   ```bash
   go test ./pkg/api/... -v
   ```

2. Integration test (with feature flag):
   ```bash
   ENABLE_AI_SDK_CHAT=true go run ./cmd/worker
   # In another terminal:
   curl -X POST http://localhost:8080/api/v1/chat/stream ...
   ```

---

## Rollback Plan

1. Set `ENABLE_AI_SDK_CHAT=false` in environment
2. Endpoint returns 404, no impact on existing flow

---

## PR Checklist

- [ ] Branch created from `main` (after PR-04 merged)
- [ ] Types file created
- [ ] Handler file created
- [ ] Helper functions exported
- [ ] Feature flag added
- [ ] Route registered
- [ ] Unit tests passing
- [ ] Build passes
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Endpoint is gated by feature flag for safety
- Reuses existing LLM logic, just different output format
- System prompts are preserved from `pkg/llm/system.go`
- Tool calling will be handled in PR-10
