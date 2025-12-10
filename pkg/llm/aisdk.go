// Package llm provides adapters for converting Anthropic SDK streaming
// events to the Vercel AI SDK Data Stream Protocol format.
//
// This package enables the Go backend to output streams compatible with
// the frontend useChat hook, allowing us to leverage AI SDK patterns
// while keeping our proven Go LLM orchestration logic.
//
// The main component is AISDKStreamWriter, which wraps an HTTP ResponseWriter
// to output Server-Sent Events (SSE) in the AI SDK Data Stream Protocol format.
//
// See: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
package llm

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/coder/aisdk-go"
)

// AISDKStreamWriter writes events in AI SDK Data Stream Protocol format.
// It implements Server-Sent Events (SSE) for streaming AI responses.
//
// The writer is thread-safe and ensures proper SSE formatting with
// automatic flushing after each event.
type AISDKStreamWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
	mu      sync.Mutex
	closed  bool
}

// NewAISDKStreamWriter creates a new stream writer for AI SDK protocol.
//
// It sets the necessary HTTP headers for SSE (Content-Type, Cache-Control, etc.)
// and returns an error if the ResponseWriter doesn't support flushing.
//
// The writer is ready to use immediately after creation and will automatically
// format events according to the AI SDK Data Stream Protocol specification.
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

// WriteTextDelta writes a text delta event in AI SDK format.
//
// Called for each token/chunk of text from the LLM. The text is formatted
// as a "text-delta" event according to the AI SDK Data Stream Protocol.
func (s *AISDKStreamWriter) WriteTextDelta(text string) error {
	part := aisdk.TextStreamPart{
		Content: text,
	}
	formatted, err := part.Format()
	if err != nil {
		return fmt.Errorf("failed to format text stream part: %w", err)
	}
	return s.writeFormattedEvent(formatted)
}

// WriteToolCallStart writes the start of a tool call event.
//
// Called when the LLM begins a tool invocation. The event includes the
// tool call ID and tool name, formatted as a "tool-call" event.
func (s *AISDKStreamWriter) WriteToolCallStart(toolCallID, toolName string) error {
	part := aisdk.ToolCallStartStreamPart{
		ToolCallID: toolCallID,
		ToolName:   toolName,
	}
	formatted, err := part.Format()
	if err != nil {
		return fmt.Errorf("failed to format tool call start stream part: %w", err)
	}
	return s.writeFormattedEvent(formatted)
}

// WriteToolCallDelta writes tool call argument deltas.
//
// Called as tool arguments are streamed (partial JSON). The argsJson
// parameter contains incremental JSON updates for the tool arguments.
func (s *AISDKStreamWriter) WriteToolCallDelta(toolCallID string, argsJson string) error {
	part := aisdk.ToolCallDeltaStreamPart{
		ToolCallID:    toolCallID,
		ArgsTextDelta: argsJson,
	}
	formatted, err := part.Format()
	if err != nil {
		return fmt.Errorf("failed to format tool call delta stream part: %w", err)
	}
	return s.writeFormattedEvent(formatted)
}

// WriteToolCall writes a tool call event (legacy method, kept for compatibility).
// Deprecated: Use WriteToolCallStart instead.
func (s *AISDKStreamWriter) WriteToolCall(id, name string, args interface{}) error {
	return s.WriteToolCallStart(id, name)
}

// WriteToolResult writes a tool result event.
//
// Called after tool execution completes. The result is formatted as a
// "tool-result" event with the tool call ID and execution result.
func (s *AISDKStreamWriter) WriteToolResult(toolCallID string, result interface{}) error {
	part := aisdk.ToolResultStreamPart{
		ToolCallID: toolCallID,
		Result:     result,
	}
	formatted, err := part.Format()
	if err != nil {
		return fmt.Errorf("failed to format tool result stream part: %w", err)
	}
	return s.writeFormattedEvent(formatted)
}

// WriteFinish writes the finish event.
//
// Called when the LLM response is complete. The reason parameter indicates
// why the response finished (e.g., "stop", "length", "tool_calls").
func (s *AISDKStreamWriter) WriteFinish(reason string) error {
	part := aisdk.FinishMessageStreamPart{
		FinishReason: aisdk.FinishReason(reason),
	}
	formatted, err := part.Format()
	if err != nil {
		return fmt.Errorf("failed to format finish stream part: %w", err)
	}
	return s.writeFormattedEvent(formatted)
}

// WriteError writes an error event.
//
// Called when an error occurs during streaming. The error is formatted
// as an "error" event according to the AI SDK protocol.
func (s *AISDKStreamWriter) WriteError(err error) error {
	part := aisdk.ErrorStreamPart{
		Content: err.Error(),
	}
	formatted, formatErr := part.Format()
	if formatErr != nil {
		return fmt.Errorf("failed to format error stream part: %w (original: %v)", formatErr, err)
	}
	return s.writeFormattedEvent(formatted)
}

// Close marks the stream as closed.
func (s *AISDKStreamWriter) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
}

// writeEvent writes a single SSE event (for manual JSON events).
// This is a helper method that ensures thread safety and proper SSE format.
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

// writeFormattedEvent writes a pre-formatted SSE event (from DataStreamPart.Format()).
// This is a helper method that ensures thread safety.
func (s *AISDKStreamWriter) writeFormattedEvent(formatted string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return fmt.Errorf("stream is closed")
	}

	_, err := fmt.Fprintf(s.w, "%s\n", formatted)
	if err != nil {
		return fmt.Errorf("failed to write formatted event: %w", err)
	}

	s.flusher.Flush()
	return nil
}

