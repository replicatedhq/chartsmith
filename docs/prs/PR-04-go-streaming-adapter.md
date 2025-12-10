# PR-04: Go AI SDK Streaming Adapter

**Branch:** `feat/go-aisdk-streaming-adapter`
**Dependencies:** PR-02 (Go AI SDK library)
**Parallel With:** PR-03 (after PR-02 merges)
**Estimated Complexity:** Medium
**Success Criteria:** G2 (Migrate to AI SDK Core), G3 (Maintain chat functionality)

---

## Overview

Create an adapter layer in the Go backend that converts Anthropic SDK streaming events into the Vercel AI SDK Data Stream Protocol format. This is the core translation layer that enables the frontend `useChat` hook to consume our Go backend streams.

## Prerequisites

- PR-02 merged (aisdk-go library available)
- Understanding of Anthropic streaming events
- Understanding of AI SDK Data Stream Protocol

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Adapter location | `pkg/llm/aisdk.go` | Keeps LLM logic together |
| Streaming method | HTTP SSE (Server-Sent Events) | AI SDK protocol requirement |
| Error handling | Stream error events | Matches AI SDK spec |

---

## Background: AI SDK Data Stream Protocol

The AI SDK expects Server-Sent Events in this format:

```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"tool-call","toolCallId":"call_123","toolName":"get_weather","args":{}}

data: {"type":"tool-result","toolCallId":"call_123","result":"72°F"}

data: {"type":"finish","finishReason":"stop"}
```

---

## Step-by-Step Instructions

### Step 1: Create the AI SDK Adapter File

Create the main adapter file:

```go
// pkg/llm/aisdk.go
package llm

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/coder/aisdk-go"
)

// AISDKStreamWriter writes events in AI SDK Data Stream Protocol format
type AISDKStreamWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
	mu      sync.Mutex
	closed  bool
}

// NewAISDKStreamWriter creates a new stream writer
// Returns error if ResponseWriter doesn't support flushing
func NewAISDKStreamWriter(w http.ResponseWriter) (*AISDKStreamWriter, error) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf("response writer does not support flushing")
	}

	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

	return &AISDKStreamWriter{
		w:       w,
		flusher: flusher,
	}, nil
}

// writeEvent writes a single SSE event
func (s *AISDKStreamWriter) writeEvent(data interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return fmt.Errorf("stream is closed")
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// SSE format: "data: {json}\n\n"
	_, err = fmt.Fprintf(s.w, "data: %s\n\n", jsonData)
	if err != nil {
		return fmt.Errorf("failed to write event: %w", err)
	}

	s.flusher.Flush()
	return nil
}

// WriteTextDelta writes a text delta event
// Called for each token/chunk of text from the LLM
func (s *AISDKStreamWriter) WriteTextDelta(text string) error {
	return s.writeEvent(map[string]interface{}{
		"type":      "text-delta",
		"textDelta": text,
	})
}

// WriteToolCallStart writes the start of a tool call
// Called when the LLM begins a tool invocation
func (s *AISDKStreamWriter) WriteToolCallStart(toolCallID, toolName string) error {
	return s.writeEvent(map[string]interface{}{
		"type":       "tool-call",
		"toolCallId": toolCallID,
		"toolName":   toolName,
		"args":       map[string]interface{}{}, // Args come separately
	})
}

// WriteToolCallDelta writes tool call argument deltas
// Called as tool arguments are streamed
func (s *AISDKStreamWriter) WriteToolCallDelta(toolCallID string, argsJson string) error {
	return s.writeEvent(map[string]interface{}{
		"type":          "tool-call-delta",
		"toolCallId":    toolCallID,
		"argsTextDelta": argsJson,
	})
}

// WriteToolResult writes a tool result
// Called after tool execution completes
func (s *AISDKStreamWriter) WriteToolResult(toolCallID string, result interface{}) error {
	return s.writeEvent(map[string]interface{}{
		"type":       "tool-result",
		"toolCallId": toolCallID,
		"result":     result,
	})
}

// WriteFinish writes the finish event
// Called when the LLM response is complete
func (s *AISDKStreamWriter) WriteFinish(reason string) error {
	return s.writeEvent(map[string]interface{}{
		"type":         "finish",
		"finishReason": reason,
	})
}

// WriteError writes an error event
// Called when an error occurs during streaming
func (s *AISDKStreamWriter) WriteError(err error) error {
	return s.writeEvent(map[string]interface{}{
		"type":  "error",
		"error": err.Error(),
	})
}

// Close marks the stream as closed
func (s *AISDKStreamWriter) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
}
```

### Step 2: Create Anthropic to AI SDK Event Converter

Create a converter for Anthropic streaming events:

```go
// pkg/llm/aisdk_anthropic.go
package llm

import (
	"context"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
)

// StreamAnthropicToAISDK converts Anthropic streaming to AI SDK format
// This is the main integration point between Anthropic SDK and AI SDK protocol
func StreamAnthropicToAISDK(
	ctx context.Context,
	stream *anthropic.MessageStream,
	writer *AISDKStreamWriter,
) error {
	defer writer.Close()

	var currentToolCallID string
	var accumulatedText string

	for stream.Next() {
		event := stream.Current()

		switch e := event.AsUnion().(type) {
		case anthropic.ContentBlockStartEvent:
			// Handle start of a new content block
			switch block := e.ContentBlock.AsUnion().(type) {
			case anthropic.TextBlock:
				// Text block starting - no action needed
			case anthropic.ToolUseBlock:
				// Tool use starting
				currentToolCallID = block.ID
				if err := writer.WriteToolCallStart(block.ID, block.Name); err != nil {
					return fmt.Errorf("failed to write tool call start: %w", err)
				}
			}

		case anthropic.ContentBlockDeltaEvent:
			// Handle delta updates
			switch delta := e.Delta.AsUnion().(type) {
			case anthropic.TextDelta:
				// Text token received
				if delta.Text != "" {
					accumulatedText += delta.Text
					if err := writer.WriteTextDelta(delta.Text); err != nil {
						return fmt.Errorf("failed to write text delta: %w", err)
					}
				}
			case anthropic.InputJSONDelta:
				// Tool argument delta
				if currentToolCallID != "" && delta.PartialJSON != "" {
					if err := writer.WriteToolCallDelta(currentToolCallID, delta.PartialJSON); err != nil {
						return fmt.Errorf("failed to write tool call delta: %w", err)
					}
				}
			}

		case anthropic.ContentBlockStopEvent:
			// Content block finished
			currentToolCallID = ""

		case anthropic.MessageStopEvent:
			// Message complete
			// Finish reason will be determined from message

		case anthropic.MessageDeltaEvent:
			// Message-level delta (contains stop reason)
			if e.Delta.StopReason != "" {
				reason := mapAnthropicStopReason(string(e.Delta.StopReason))
				if err := writer.WriteFinish(reason); err != nil {
					return fmt.Errorf("failed to write finish: %w", err)
				}
			}
		}
	}

	if err := stream.Err(); err != nil {
		if writeErr := writer.WriteError(err); writeErr != nil {
			return fmt.Errorf("failed to write error: %w (original: %v)", writeErr, err)
		}
		return err
	}

	return nil
}

// mapAnthropicStopReason converts Anthropic stop reasons to AI SDK format
func mapAnthropicStopReason(reason string) string {
	switch reason {
	case "end_turn":
		return "stop"
	case "tool_use":
		return "tool-calls"
	case "max_tokens":
		return "length"
	case "stop_sequence":
		return "stop"
	default:
		return "unknown"
	}
}
```

### Step 3: Create Unit Tests

```go
// pkg/llm/aisdk_test.go
package llm

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAISDKStreamWriter_WriteTextDelta(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(recorder)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteTextDelta("Hello")
	if err != nil {
		t.Fatalf("failed to write text delta: %v", err)
	}

	body := recorder.Body.String()
	if !strings.Contains(body, `"type":"text-delta"`) {
		t.Errorf("expected text-delta type, got: %s", body)
	}
	if !strings.Contains(body, `"textDelta":"Hello"`) {
		t.Errorf("expected textDelta Hello, got: %s", body)
	}
	if !strings.HasPrefix(body, "data: ") {
		t.Errorf("expected SSE format with 'data: ' prefix, got: %s", body)
	}
}

func TestAISDKStreamWriter_WriteToolCall(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(recorder)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteToolCallStart("call_123", "get_weather")
	if err != nil {
		t.Fatalf("failed to write tool call: %v", err)
	}

	body := recorder.Body.String()
	if !strings.Contains(body, `"type":"tool-call"`) {
		t.Errorf("expected tool-call type, got: %s", body)
	}
	if !strings.Contains(body, `"toolCallId":"call_123"`) {
		t.Errorf("expected toolCallId, got: %s", body)
	}
	if !strings.Contains(body, `"toolName":"get_weather"`) {
		t.Errorf("expected toolName, got: %s", body)
	}
}

func TestAISDKStreamWriter_WriteToolResult(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(recorder)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	result := map[string]interface{}{"temperature": 72}
	err = writer.WriteToolResult("call_123", result)
	if err != nil {
		t.Fatalf("failed to write tool result: %v", err)
	}

	body := recorder.Body.String()
	if !strings.Contains(body, `"type":"tool-result"`) {
		t.Errorf("expected tool-result type, got: %s", body)
	}
}

func TestAISDKStreamWriter_WriteFinish(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(recorder)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteFinish("stop")
	if err != nil {
		t.Fatalf("failed to write finish: %v", err)
	}

	body := recorder.Body.String()
	if !strings.Contains(body, `"type":"finish"`) {
		t.Errorf("expected finish type, got: %s", body)
	}
	if !strings.Contains(body, `"finishReason":"stop"`) {
		t.Errorf("expected finishReason stop, got: %s", body)
	}
}

func TestAISDKStreamWriter_SSEFormat(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(recorder)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	writer.WriteTextDelta("Hello")
	writer.WriteTextDelta(" World")

	body := recorder.Body.String()
	lines := strings.Split(body, "\n\n")

	// Should have 2 events (plus empty string from final split)
	if len(lines) < 2 {
		t.Errorf("expected at least 2 events, got %d", len(lines))
	}

	// Each event should be valid JSON after "data: " prefix
	for _, line := range lines {
		if line == "" {
			continue
		}
		jsonStr := strings.TrimPrefix(line, "data: ")
		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
			t.Errorf("invalid JSON in SSE event: %s, error: %v", jsonStr, err)
		}
	}
}

func TestMapAnthropicStopReason(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"end_turn", "stop"},
		{"tool_use", "tool-calls"},
		{"max_tokens", "length"},
		{"stop_sequence", "stop"},
		{"unknown_reason", "unknown"},
	}

	for _, tt := range tests {
		result := mapAnthropicStopReason(tt.input)
		if result != tt.expected {
			t.Errorf("mapAnthropicStopReason(%s) = %s, want %s", tt.input, result, tt.expected)
		}
	}
}

func TestAISDKStreamWriter_Headers(t *testing.T) {
	recorder := httptest.NewRecorder()
	_, err := NewAISDKStreamWriter(recorder)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	contentType := recorder.Header().Get("Content-Type")
	if contentType != "text/event-stream" {
		t.Errorf("expected Content-Type text/event-stream, got %s", contentType)
	}

	cacheControl := recorder.Header().Get("Cache-Control")
	if cacheControl != "no-cache" {
		t.Errorf("expected Cache-Control no-cache, got %s", cacheControl)
	}
}
```

### Step 4: Run Tests

```bash
cd /path/to/chartsmith
go test ./pkg/llm/... -v -run AISDK
```

All tests should pass.

### Step 5: Build Verification

```bash
go build ./...
```

Should compile without errors.

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `pkg/llm/aisdk.go` | Added | AI SDK stream writer |
| `pkg/llm/aisdk_anthropic.go` | Added | Anthropic to AI SDK converter |
| `pkg/llm/aisdk_test.go` | Added | Unit tests |

---

## Acceptance Criteria

- [ ] `AISDKStreamWriter` correctly writes SSE format
- [ ] Text delta events have correct structure
- [ ] Tool call events have correct structure
- [ ] Tool result events have correct structure
- [ ] Finish events have correct structure
- [ ] HTTP headers are set correctly for SSE
- [ ] All unit tests pass
- [ ] Build succeeds

---

## Testing Instructions

1. Run unit tests:
   ```bash
   go test ./pkg/llm/... -v -run AISDK
   ```

2. Verify test coverage:
   ```bash
   go test ./pkg/llm/... -cover -run AISDK
   ```

---

## AI SDK Data Stream Protocol Reference

| Event Type | Fields | Description |
|------------|--------|-------------|
| `text-delta` | `textDelta` | Incremental text token |
| `tool-call` | `toolCallId`, `toolName`, `args` | Tool invocation start |
| `tool-call-delta` | `toolCallId`, `argsTextDelta` | Tool argument chunk |
| `tool-result` | `toolCallId`, `result` | Tool execution result |
| `finish` | `finishReason` | Stream complete |
| `error` | `error` | Error occurred |

Full spec: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol

---

## Rollback Plan

This PR adds new files without modifying existing code. To rollback:

```bash
git rm pkg/llm/aisdk.go pkg/llm/aisdk_anthropic.go pkg/llm/aisdk_test.go
```

---

## PR Checklist

- [ ] Branch created from `main` (after PR-02 merged)
- [ ] `aisdk.go` created with stream writer
- [ ] `aisdk_anthropic.go` created with converter
- [ ] Unit tests created and passing
- [ ] Build passes
- [ ] Code follows project conventions
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- This is a foundational adapter - not yet integrated into chat flow
- Verify SSE format matches AI SDK spec exactly
- Check that Anthropic event types are handled comprehensively
- Consider edge cases (connection drops, partial events)
