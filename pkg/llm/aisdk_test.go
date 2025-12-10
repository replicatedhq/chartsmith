package llm

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestNewAISDKStreamWriter(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if writer == nil {
		t.Fatal("expected non-nil writer")
	}

	if writer.w != w {
		t.Error("writer not set correctly")
	}

	// Verify headers are set
	contentType := w.Header().Get("Content-Type")
	if contentType != "text/event-stream" {
		t.Errorf("expected Content-Type text/event-stream, got %s", contentType)
	}

	cacheControl := w.Header().Get("Cache-Control")
	if cacheControl != "no-cache" {
		t.Errorf("expected Cache-Control no-cache, got %s", cacheControl)
	}

	connection := w.Header().Get("Connection")
	if connection != "keep-alive" {
		t.Errorf("expected Connection keep-alive, got %s", connection)
	}
}

func TestNewAISDKStreamWriter_WithoutFlusher(t *testing.T) {
	// Create a custom ResponseWriter that doesn't implement Flusher
	w := &nonFlusherResponseWriter{
		ResponseWriter: httptest.NewRecorder(),
	}

	writer, err := NewAISDKStreamWriter(w)
	if err == nil {
		t.Fatal("expected error for non-Flusher ResponseWriter")
	}
	if writer != nil {
		t.Error("expected nil writer when error occurs")
	}
}

func TestAISDKStreamWriter_WriteTextDelta(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteTextDelta("Hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if body == "" {
		t.Error("expected non-empty body")
	}

	// Verify SSE format
	if !strings.Contains(body, "data:") {
		t.Error("expected SSE format with 'data:' prefix")
	}

	if !strings.Contains(body, "text-delta") {
		t.Error("expected 'text-delta' in body")
	}

	if !strings.Contains(body, "Hello") {
		t.Error("expected 'Hello' text in body")
	}

	// Verify JSON is valid
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "data: ") {
			jsonStr := strings.TrimPrefix(line, "data: ")
			var data map[string]interface{}
			if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
				t.Errorf("invalid JSON in SSE: %v", err)
			}
		}
	}
}

func TestAISDKStreamWriter_WriteTextDelta_Multiple(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	texts := []string{"Hello", " ", "world", "!"}
	for _, text := range texts {
		if err := writer.WriteTextDelta(text); err != nil {
			t.Fatalf("failed to write text delta: %v", err)
		}
	}

	body := w.Body.String()
	for _, text := range texts {
		if !strings.Contains(body, text) {
			t.Errorf("expected text '%s' in body", text)
		}
	}
}

func TestAISDKStreamWriter_WriteToolCallStart(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteToolCallStart("call_123", "test_tool")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if body == "" {
		t.Error("expected non-empty body")
	}

	if !strings.Contains(body, "tool-call") {
		t.Error("expected 'tool-call' in body")
	}

	if !strings.Contains(body, "call_123") {
		t.Error("expected tool call ID in body")
	}

	if !strings.Contains(body, "test_tool") {
		t.Error("expected tool name in body")
	}
}

func TestAISDKStreamWriter_WriteToolCallDelta(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	// Write tool call start first
	if err := writer.WriteToolCallStart("call_123", "test_tool"); err != nil {
		t.Fatalf("failed to write tool call start: %v", err)
	}

	// Write tool call deltas
	deltas := []string{`{"key":`, `"value"`, `}`}
	for _, delta := range deltas {
		if err := writer.WriteToolCallDelta("call_123", delta); err != nil {
			t.Fatalf("failed to write tool call delta: %v", err)
		}
	}

	body := w.Body.String()
	if !strings.Contains(body, "tool-call-delta") {
		t.Error("expected 'tool-call-delta' in body")
	}

	for _, delta := range deltas {
		if !strings.Contains(body, delta) {
			t.Errorf("expected delta '%s' in body", delta)
		}
	}
}

func TestAISDKStreamWriter_WriteToolCall(t *testing.T) {
	// Test legacy WriteToolCall method
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteToolCall("call_123", "test_tool", map[string]string{"key": "value"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if !strings.Contains(body, "tool-call") {
		t.Error("expected 'tool-call' in body")
	}
}

func TestAISDKStreamWriter_WriteToolResult(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	result := map[string]interface{}{
		"status": "success",
		"data":   "result data",
	}

	err = writer.WriteToolResult("call_123", result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if body == "" {
		t.Error("expected non-empty body")
	}

	if !strings.Contains(body, "tool-result") {
		t.Error("expected 'tool-result' in body")
	}

	if !strings.Contains(body, "call_123") {
		t.Error("expected tool call ID in body")
	}
}

func TestAISDKStreamWriter_WriteToolResult_String(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteToolResult("call_123", "result string")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if !strings.Contains(body, "tool-result") {
		t.Error("expected 'tool-result' in body")
	}
}

func TestAISDKStreamWriter_WriteToolResult_Nil(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteToolResult("call_123", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if !strings.Contains(body, "tool-result") {
		t.Error("expected 'tool-result' in body")
	}
}

func TestAISDKStreamWriter_WriteFinish(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	err = writer.WriteFinish("stop")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if body == "" {
		t.Error("expected non-empty body")
	}

	if !strings.Contains(body, "finish") {
		t.Error("expected 'finish' in body")
	}

	if !strings.Contains(body, "stop") {
		t.Error("expected finish reason in body")
	}
}

func TestAISDKStreamWriter_WriteFinish_DifferentReasons(t *testing.T) {
	reasons := []string{"stop", "length", "tool-calls", "content-filter", "error"}
	for _, reason := range reasons {
		w := httptest.NewRecorder()
		writer, err := NewAISDKStreamWriter(w)
		if err != nil {
			t.Fatalf("failed to create writer: %v", err)
		}

		if err := writer.WriteFinish(reason); err != nil {
			t.Fatalf("failed to write finish with reason %s: %v", reason, err)
		}

		body := w.Body.String()
		if !strings.Contains(body, reason) {
			t.Errorf("expected finish reason '%s' in body", reason)
		}
	}
}

func TestAISDKStreamWriter_WriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	testErr := &testError{message: "test error message"}
	err = writer.WriteError(testErr)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if !strings.Contains(body, "error") {
		t.Error("expected 'error' in body")
	}

	if !strings.Contains(body, "test error message") {
		t.Error("expected error message in body")
	}
}

func TestAISDKStreamWriter_Close(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	// Write should succeed before close
	if err := writer.WriteTextDelta("test"); err != nil {
		t.Fatalf("unexpected error before close: %v", err)
	}

	// Close the writer
	writer.Close()

	// Write should fail after close
	if err := writer.WriteTextDelta("test"); err == nil {
		t.Error("expected error after close")
	}
}

func TestAISDKStreamWriter_ThreadSafety(t *testing.T) {
	w := httptest.NewRecorder()
	writer, err := NewAISDKStreamWriter(w)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	// Write concurrently from multiple goroutines
	var wg sync.WaitGroup
	numGoroutines := 10
	textsPerGoroutine := 10

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < textsPerGoroutine; j++ {
				text := strings.Repeat("a", id*textsPerGoroutine+j)
				if err := writer.WriteTextDelta(text); err != nil {
					t.Errorf("goroutine %d: failed to write: %v", id, err)
				}
			}
		}(i)
	}

	wg.Wait()

	// Verify all writes succeeded
	body := w.Body.String()
	expectedEvents := numGoroutines * textsPerGoroutine
	eventCount := strings.Count(body, "text-delta")
	if eventCount < expectedEvents {
		t.Errorf("expected at least %d events, got %d", expectedEvents, eventCount)
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
		{"", "unknown"},
	}

	for _, tt := range tests {
		result := mapAnthropicStopReason(tt.input)
		if result != tt.expected {
			t.Errorf("mapAnthropicStopReason(%s) = %s, want %s", tt.input, result, tt.expected)
		}
	}
}

// testError is a simple error type for testing
type testError struct {
	message string
}

func (e *testError) Error() string {
	return e.message
}

// nonFlusherResponseWriter wraps ResponseWriter but doesn't implement Flusher
type nonFlusherResponseWriter struct {
	http.ResponseWriter
}

