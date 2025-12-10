# PR#2: Testing Guide

---

## Test Categories

### 1. Unit Tests

**Function:** `NewAISDKStreamWriter()`
- [ ] Test case 1: Creates writer with valid ResponseWriter
  - Input: `httptest.NewRecorder()`
  - Expected: Non-nil writer, writer field set correctly
  - Actual: [Record result]

- [ ] Test case 2: Handles non-Flusher ResponseWriter
  - Input: ResponseWriter without Flusher interface
  - Expected: Writer created, flusher is nil (no error)
  - Actual: [Record result]

**Function:** `WriteTextDelta(text string)`
- [ ] Test case 1: Writes valid text delta
  - Input: `"Hello"`
  - Expected: SSE format `data: {"type":"text-delta","textDelta":"Hello"}\n\n`
  - Actual: [Record result]

- [ ] Test case 2: Handles empty string
  - Input: `""`
  - Expected: Still writes valid event (empty textDelta)
  - Actual: [Record result]

- [ ] Test case 3: Handles special characters
  - Input: `"Hello\nWorld"`
  - Expected: JSON-escaped in output
  - Actual: [Record result]

**Function:** `WriteToolCall(id, name string, args interface{})`
- [ ] Test case 1: Writes valid tool call
  - Input: `id="call_123", name="test_tool", args=map[string]string{}`
  - Expected: SSE format with tool-call event
  - Actual: [Record result]

- [ ] Test case 2: Handles complex args
  - Input: `args=map[string]interface{}{"key": "value", "num": 42}`
  - Expected: Args marshaled correctly in JSON
  - Actual: [Record result]

**Function:** `WriteToolResult(id string, result interface{})`
- [ ] Test case 1: Writes valid tool result
  - Input: `id="call_123", result=map[string]string{"status": "ok"}`
  - Expected: SSE format with tool-result event
  - Actual: [Record result]

**Function:** `WriteFinish(reason string)`
- [ ] Test case 1: Writes finish event
  - Input: `reason="stop"`
  - Expected: SSE format with finish event
  - Actual: [Record result]

- [ ] Test case 2: Handles different finish reasons
  - Input: `reason="length"` or `reason="content_filter"`
  - Expected: Reason included in event
  - Actual: [Record result]

**Function:** `writeEvent(event interface{})`
- [ ] Test case 1: Marshals event to JSON
  - Input: Valid event struct
  - Expected: JSON string in SSE format
  - Actual: [Record result]

- [ ] Test case 2: Handles marshaling errors
  - Input: Event with invalid JSON (if possible)
  - Expected: Returns error, doesn't panic
  - Actual: [Record result]

- [ ] Test case 3: Writes SSE format correctly
  - Input: Any event
  - Expected: Format `data: {json}\n\n` (note double newline)
  - Actual: [Record result]

- [ ] Test case 4: Flushes if flusher available
  - Input: ResponseWriter with Flusher
  - Expected: Flush() called after write
  - Actual: [Record result]

- [ ] Test case 5: Handles missing flusher gracefully
  - Input: ResponseWriter without Flusher
  - Expected: No error, write succeeds
  - Actual: [Record result]

### 2. Integration Tests

**N/A for this PR** - Adapter not yet connected to actual streaming. Integration tests will be added in PR#3.

### 3. Edge Cases

- [ ] Empty input handling
  - WriteTextDelta with empty string
  - WriteToolCall with empty id/name

- [ ] Nil handling
  - Nil ResponseWriter (should panic or return error - document behavior)
  - Nil args in WriteToolCall

- [ ] Large input handling
  - WriteTextDelta with very long string (10KB+)
  - Verify no memory issues

- [ ] Concurrent writes
  - Multiple goroutines writing to same writer
  - Expected: No data races (if applicable)

- [ ] Write errors
  - Simulate write failure
  - Expected: Error returned, no panic

### 4. Performance Tests

**N/A for this PR** - No performance-critical paths. Performance testing will be added in PR#3 when adapter is connected to actual streaming.

### 5. Protocol Compliance Tests

- [ ] SSE Format Validation
  - Verify format: `data: {json}\n\n`
  - Verify no extra whitespace
  - Verify proper JSON encoding

- [ ] Event Type Validation
  - Verify event types match AI SDK spec:
    - `"text-delta"`
    - `"tool-call"`
    - `"tool-result"`
    - `"finish"`

- [ ] JSON Structure Validation
  - Verify TextDeltaEvent structure matches spec
  - Verify ToolCallEvent structure matches spec
  - Verify ToolResultEvent structure matches spec
  - Verify FinishEvent structure matches spec

---

## Acceptance Criteria

Feature is complete when:
- [ ] All unit tests pass
- [ ] Code compiles without errors
- [ ] No linter errors
- [ ] Existing tests still pass (no regressions)
- [ ] SSE format matches AI SDK spec
- [ ] Event types match AI SDK spec
- [ ] Error handling is appropriate

---

## Test Implementation Examples

### Example 1: Basic Writer Test
```go
func TestNewAISDKStreamWriter(t *testing.T) {
    w := httptest.NewRecorder()
    writer := NewAISDKStreamWriter(w)
    
    if writer == nil {
        t.Fatal("expected non-nil writer")
    }
    
    if writer.writer != w {
        t.Error("writer not set correctly")
    }
}
```

### Example 2: SSE Format Test
```go
func TestWriteTextDelta_SSEFormat(t *testing.T) {
    w := httptest.NewRecorder()
    writer := NewAISDKStreamWriter(w)
    
    err := writer.WriteTextDelta("Hello")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    
    body := w.Body.String()
    
    // Verify SSE format
    if !strings.HasPrefix(body, "data: ") {
        t.Errorf("expected SSE format with 'data: ' prefix, got: %q", body)
    }
    
    // Verify double newline at end
    if !strings.HasSuffix(body, "\n\n") {
        t.Errorf("expected double newline at end, got: %q", body)
    }
    
    // Verify JSON structure
    jsonPart := strings.TrimPrefix(strings.TrimSuffix(body, "\n\n"), "data: ")
    var event map[string]interface{}
    if err := json.Unmarshal([]byte(jsonPart), &event); err != nil {
        t.Errorf("expected valid JSON, got error: %v", err)
    }
    
    // Verify event type
    if event["type"] != "text-delta" {
        t.Errorf("expected type 'text-delta', got: %v", event["type"])
    }
}
```

### Example 3: Error Handling Test
```go
func TestWriteEvent_MarshalError(t *testing.T) {
    // This test may be difficult if we can't create invalid JSON
    // But we should test that writeEvent handles errors gracefully
    
    w := httptest.NewRecorder()
    writer := NewAISDKStreamWriter(w)
    
    // Test with valid event first
    err := writer.WriteTextDelta("test")
    if err != nil {
        t.Errorf("unexpected error with valid input: %v", err)
    }
}
```

---

## Test Coverage Goals

**Target:** 80%+ coverage for new code

**Files to Cover:**
- `pkg/llm/aisdk.go` - All exported functions
- `pkg/llm/types/aisdk.go` - Type definitions (if functions exist)

**Coverage Command:**
```bash
go test -cover ./pkg/llm/...
go test -coverprofile=coverage.out ./pkg/llm/...
go tool cover -html=coverage.out
```

---

## Regression Testing

**Verify No Regressions:**
- [ ] All existing tests in `pkg/llm/` still pass
- [ ] No changes to existing functionality
- [ ] No new dependencies break existing code

**Command:**
```bash
go test ./pkg/llm/...
go test ./...
```

---

## Manual Testing Checklist

**Not Required for This PR** - All validation can be done via automated tests. Manual testing will be added in PR#3 when adapter is connected to actual streaming.

---

## Test Data

**No external test data required** - All tests use programmatically generated data.

---

## Continuous Integration

**CI Should:**
- [ ] Run all tests: `go test ./pkg/llm/...`
- [ ] Run linter: `golangci-lint run ./pkg/llm/...`
- [ ] Verify compilation: `go build ./pkg/llm/...`
- [ ] Check test coverage (if configured)

---

## Test Maintenance

**Future Updates:**
- PR#3 will add integration tests
- PR#3 will add performance tests
- PR#3 will add protocol compliance tests with real streaming

**This PR:** Focus on unit tests for adapter shell only.

---

## Troubleshooting Test Failures

### Issue: Test Fails - SSE Format Wrong
**Symptoms:** Test expects `data: {...}\n\n` but gets different format  
**Solution:** Check `writeEvent` method - ensure format is exactly `data: {json}\n\n`

### Issue: Test Fails - JSON Invalid
**Symptoms:** JSON unmarshaling fails in test  
**Solution:** Check event struct tags match JSON keys. Verify `aisdk-go` types are used correctly.

### Issue: Test Fails - Flusher Not Called
**Symptoms:** Test expects Flush() but it's not called  
**Solution:** Verify ResponseWriter implements Flusher. In tests, httptest.NewRecorder() doesn't implement Flusher (this is expected).

---

**Status:** Ready for test implementation! 🧪

