# PR#3: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (`PR03_AI_SDK_STREAMING_ADAPTER.md`) (~30 min)
- [ ] Verify PR#2 is merged (aisdk-go library available)
- [ ] Review AI SDK Data Stream Protocol spec: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
- [ ] Review Anthropic SDK streaming events: https://docs.anthropic.com/claude/reference/messages-streaming
- [ ] Git branch created
  ```bash
  git checkout -b feat/pr03-ai-sdk-streaming-adapter
  ```
- [ ] Open relevant files in editor
  - `pkg/llm/conversational.go` (reference for Anthropic streaming)
  - `pkg/llm/` directory (where new files will go)

---

## Phase 1: Stream Writer Foundation (1-2 hours)

### 1.1: Create aisdk.go File (15 minutes)

#### Create File
- [ ] Create `pkg/llm/aisdk.go`

#### Add Package and Imports
- [ ] Add package declaration
  ```go
  package llm
  ```
- [ ] Add imports
  ```go
  import (
      "encoding/json"
      "fmt"
      "net/http"
      "sync"
  )
  ```

#### Create AISDKStreamWriter Struct
- [ ] Define struct with fields
  ```go
  type AISDKStreamWriter struct {
      w       http.ResponseWriter
      flusher http.Flusher
      mu      sync.Mutex
      closed  bool
  }
  ```

**Checkpoint:** Struct defined ✓

**Commit:** `feat(llm): add AISDKStreamWriter struct`

---

### 1.2: Implement NewAISDKStreamWriter Constructor (20 minutes)

#### Create Constructor Function
- [ ] Implement `NewAISDKStreamWriter()`
  ```go
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
  ```

#### Test Constructor
- [ ] Test with valid ResponseWriter
  - Expected: Returns writer, no error
  - Actual: [Record result]
- [ ] Test with non-Flusher ResponseWriter
  - Expected: Returns error
  - Actual: [Record result]
- [ ] Test headers are set correctly
  - Expected: Content-Type, Cache-Control, Connection headers set
  - Actual: [Record result]

**Checkpoint:** Constructor working ✓

**Commit:** `feat(llm): implement NewAISDKStreamWriter constructor`

---

### 1.3: Implement writeEvent Helper Method (20 minutes)

#### Create writeEvent Method
- [ ] Implement `writeEvent()` helper
  ```go
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
  ```

#### Test writeEvent
- [ ] Test valid event writing
  - Expected: Writes "data: {...}\n\n" format
  - Actual: [Record result]
- [ ] Test closed stream
  - Expected: Returns error
  - Actual: [Record result]
- [ ] Test JSON marshaling error
  - Expected: Returns error
  - Actual: [Record result]

**Checkpoint:** Helper method working ✓

**Commit:** `feat(llm): implement writeEvent helper method`

---

### 1.4: Implement Basic Event Writers (30 minutes)

#### Implement WriteTextDelta
- [ ] Create `WriteTextDelta()` method
  ```go
  func (s *AISDKStreamWriter) WriteTextDelta(text string) error {
      return s.writeEvent(map[string]interface{}{
          "type":      "text-delta",
          "textDelta": text,
      })
  }
  ```

#### Implement WriteFinish
- [ ] Create `WriteFinish()` method
  ```go
  func (s *AISDKStreamWriter) WriteFinish(reason string) error {
      return s.writeEvent(map[string]interface{}{
          "type":         "finish",
          "finishReason": reason,
      })
  }
  ```

#### Implement WriteError
- [ ] Create `WriteError()` method
  ```go
  func (s *AISDKStreamWriter) WriteError(err error) error {
      return s.writeEvent(map[string]interface{}{
          "type":  "error",
          "error": err.Error(),
      })
  }
  ```

#### Implement Close
- [ ] Create `Close()` method
  ```go
  func (s *AISDKStreamWriter) Close() {
      s.mu.Lock()
      defer s.mu.Unlock()
      s.closed = true
  }
  ```

#### Test Basic Events
- [ ] Test WriteTextDelta
  - Expected: Writes text-delta event
  - Actual: [Record result]
- [ ] Test WriteFinish
  - Expected: Writes finish event with reason
  - Actual: [Record result]
- [ ] Test WriteError
  - Expected: Writes error event
  - Actual: [Record result]
- [ ] Test Close prevents further writes
  - Expected: Write after close returns error
  - Actual: [Record result]

**Checkpoint:** Basic events working ✓

**Commit:** `feat(llm): implement basic event writers (text, finish, error)`

---

## Phase 2: Tool Call Support (1-2 hours)

### 2.1: Implement Tool Call Start (20 minutes)

#### Create WriteToolCallStart Method
- [ ] Implement `WriteToolCallStart()`
  ```go
  func (s *AISDKStreamWriter) WriteToolCallStart(toolCallID, toolName string) error {
      return s.writeEvent(map[string]interface{}{
          "type":       "tool-call",
          "toolCallId": toolCallID,
          "toolName":   toolName,
          "args":       map[string]interface{}{}, // Args come separately
      })
  }
  ```

#### Test Tool Call Start
- [ ] Test WriteToolCallStart
  - Expected: Writes tool-call event with ID and name
  - Actual: [Record result]
- [ ] Test with empty tool name
  - Expected: Still writes event (may be invalid, but doesn't crash)
  - Actual: [Record result]

**Checkpoint:** Tool call start working ✓

**Commit:** `feat(llm): implement WriteToolCallStart`

---

### 2.2: Implement Tool Call Delta (20 minutes)

#### Create WriteToolCallDelta Method
- [ ] Implement `WriteToolCallDelta()`
  ```go
  func (s *AISDKStreamWriter) WriteToolCallDelta(toolCallID string, argsJson string) error {
      return s.writeEvent(map[string]interface{}{
          "type":          "tool-call-delta",
          "toolCallId":    toolCallID,
          "argsTextDelta": argsJson,
      })
  }
  ```

#### Test Tool Call Delta
- [ ] Test WriteToolCallDelta
  - Expected: Writes tool-call-delta event
  - Actual: [Record result]
- [ ] Test with partial JSON
  - Expected: Writes delta correctly
  - Actual: [Record result]
- [ ] Test with complete JSON
  - Expected: Writes delta correctly
  - Actual: [Record result]

**Checkpoint:** Tool call delta working ✓

**Commit:** `feat(llm): implement WriteToolCallDelta`

---

### 2.3: Implement Tool Result (20 minutes)

#### Create WriteToolResult Method
- [ ] Implement `WriteToolResult()`
  ```go
  func (s *AISDKStreamWriter) WriteToolResult(toolCallID string, result interface{}) error {
      return s.writeEvent(map[string]interface{}{
          "type":       "tool-result",
          "toolCallId": toolCallID,
          "result":     result,
      })
  }
  ```

#### Test Tool Result
- [ ] Test WriteToolResult with string result
  - Expected: Writes tool-result event
  - Actual: [Record result]
- [ ] Test WriteToolResult with object result
  - Expected: Writes tool-result event with JSON object
  - Actual: [Record result]
- [ ] Test WriteToolResult with nil result
  - Expected: Writes tool-result event with null
  - Actual: [Record result]

**Checkpoint:** Tool result working ✓

**Commit:** `feat(llm): implement WriteToolResult`

---

## Phase 3: Anthropic Event Converter (1.5-2 hours)

### 3.1: Create aisdk_anthropic.go File (10 minutes)

#### Create File
- [ ] Create `pkg/llm/aisdk_anthropic.go`

#### Add Package and Imports
- [ ] Add package declaration
  ```go
  package llm
  ```
- [ ] Add imports
  ```go
  import (
      "context"
      "fmt"

      anthropic "github.com/anthropics/anthropic-sdk-go"
  )
  ```

**Checkpoint:** File created ✓

**Commit:** `feat(llm): create aisdk_anthropic.go file`

---

### 3.2: Implement StreamAnthropicToAISDK Function (1 hour)

#### Create Function Signature
- [ ] Define function signature
  ```go
  func StreamAnthropicToAISDK(
      ctx context.Context,
      stream *anthropic.MessageStream,
      writer *AISDKStreamWriter,
  ) error {
      defer writer.Close()

      var currentToolCallID string

      // Implementation here
  }
  ```

#### Handle ContentBlockStartEvent
- [ ] Handle text block start
  ```go
  case anthropic.ContentBlockStartEvent:
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
  ```

#### Handle ContentBlockDeltaEvent
- [ ] Handle text delta
  ```go
  case anthropic.ContentBlockDeltaEvent:
      switch delta := e.Delta.AsUnion().(type) {
      case anthropic.TextDelta:
          // Text token received
          if delta.Text != "" {
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
  ```

#### Handle ContentBlockStopEvent
- [ ] Handle content block stop
  ```go
  case anthropic.ContentBlockStopEvent:
      // Content block finished
      currentToolCallID = ""
  ```

#### Handle MessageStopEvent and MessageDeltaEvent
- [ ] Handle message stop
  ```go
  case anthropic.MessageStopEvent:
      // Message complete - finish reason will be in MessageDeltaEvent
  case anthropic.MessageDeltaEvent:
      // Message-level delta (contains stop reason)
      if e.Delta.StopReason != "" {
          reason := mapAnthropicStopReason(string(e.Delta.StopReason))
          if err := writer.WriteFinish(reason); err != nil {
              return fmt.Errorf("failed to write finish: %w", err)
          }
      }
  ```

#### Handle Stream Loop and Errors
- [ ] Implement stream loop
  ```go
  for stream.Next() {
      event := stream.Current()
      // Handle events (see above)
  }

  if err := stream.Err(); err != nil {
      if writeErr := writer.WriteError(err); writeErr != nil {
          return fmt.Errorf("failed to write error: %w (original: %v)", writeErr, err)
      }
      return err
  }

  return nil
  ```

**Checkpoint:** Converter function complete ✓

**Commit:** `feat(llm): implement StreamAnthropicToAISDK converter`

---

### 3.3: Implement Stop Reason Mapping (15 minutes)

#### Create mapAnthropicStopReason Function
- [ ] Implement mapping function
  ```go
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

#### Test Stop Reason Mapping
- [ ] Test all known reasons
  - Expected: Correct mappings
  - Actual: [Record result]
- [ ] Test unknown reason
  - Expected: Returns "unknown"
  - Actual: [Record result]

**Checkpoint:** Stop reason mapping working ✓

**Commit:** `feat(llm): implement Anthropic stop reason mapping`

---

## Phase 4: Testing (1-2 hours)

### 4.1: Create Test File (10 minutes)

#### Create Test File
- [ ] Create `pkg/llm/aisdk_test.go`

#### Add Test Imports
- [ ] Add imports
  ```go
  import (
      "encoding/json"
      "net/http/httptest"
      "strings"
      "testing"
  )
  ```

**Checkpoint:** Test file created ✓

---

### 4.2: Test Stream Writer (30 minutes)

#### Test WriteTextDelta
- [ ] Create test
  ```go
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
  ```
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

#### Test WriteToolCallStart
- [ ] Create test
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

#### Test WriteToolCallDelta
- [ ] Create test
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

#### Test WriteToolResult
- [ ] Create test
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

#### Test WriteFinish
- [ ] Create test
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

#### Test WriteError
- [ ] Create test
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

#### Test SSE Format Compliance
- [ ] Create test for multiple events
- [ ] Verify each event is valid JSON
- [ ] Verify SSE format (data: prefix, double newline)
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

#### Test HTTP Headers
- [ ] Create test
  ```go
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
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

#### Test Thread Safety
- [ ] Create concurrent write test
- [ ] Run with race detector: `go test -race`
  - Expected: No race conditions
  - Actual: [Record result]

#### Test Close Behavior
- [ ] Create test for writes after close
- [ ] Run test
  - Expected: Returns error
  - Actual: [Record result]

**Checkpoint:** Stream writer tests complete ✓

**Commit:** `test(llm): add comprehensive AISDKStreamWriter tests`

---

### 4.3: Test Stop Reason Mapping (10 minutes)

#### Test mapAnthropicStopReason
- [ ] Create test with all known reasons
  ```go
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
  ```
- [ ] Run test
  - Expected: All pass
  - Actual: [Record result]

**Checkpoint:** Stop reason tests complete ✓

**Commit:** `test(llm): add stop reason mapping tests`

---

### 4.4: Integration Test with Mock Anthropic Stream (30 minutes)

#### Create Mock Stream Test
- [ ] Create test that mocks Anthropic stream
- [ ] Verify all event types are converted correctly
- [ ] Test error handling
- [ ] Run test
  - Expected: Passes
  - Actual: [Record result]

**Note:** This may require creating a mock Anthropic stream or using a test helper.

**Checkpoint:** Integration tests complete ✓

**Commit:** `test(llm): add integration test for StreamAnthropicToAISDK`

---

### 4.5: Run All Tests and Verify Coverage (15 minutes)

#### Run All Tests
- [ ] Run tests
  ```bash
  go test ./pkg/llm/... -v -run AISDK
  ```
  - Expected: All pass
  - Actual: [Record result]

#### Check Test Coverage
- [ ] Run coverage
  ```bash
  go test ./pkg/llm/... -cover -run AISDK
  ```
  - Expected: 90%+ coverage
  - Actual: [Record result]

#### Fix Any Failing Tests
- [ ] Fix failing tests
- [ ] Re-run tests
  - Expected: All pass
  - Actual: [Record result]

**Checkpoint:** All tests passing ✓

**Commit:** `test(llm): ensure all tests pass with 90%+ coverage`

---

## Build and Verification Phase (30 minutes)

### 5.1: Build Verification

#### Build Project
- [ ] Build Go code
  ```bash
  go build ./...
  ```
  - Expected: Builds successfully
  - Actual: [Record result]

#### Run Linter
- [ ] Run golangci-lint (if configured)
  ```bash
  golangci-lint run ./pkg/llm/...
  ```
  - Expected: No errors
  - Actual: [Record result]

#### Check for Warnings
- [ ] Review compiler warnings
  - Expected: No warnings
  - Actual: [Record result]

**Checkpoint:** Build successful ✓

**Commit:** `chore(llm): verify build and linting`

---

## Documentation Phase (30 minutes)

### 6.1: Add Code Comments

#### Add Function Documentation
- [ ] Add godoc comments to exported functions
  ```go
  // AISDKStreamWriter writes events in AI SDK Data Stream Protocol format.
  // It implements Server-Sent Events (SSE) for streaming AI responses.
  type AISDKStreamWriter struct {
      // ...
  }

  // NewAISDKStreamWriter creates a new stream writer for AI SDK protocol.
  // It sets the necessary HTTP headers for SSE and returns an error if
  // the ResponseWriter doesn't support flushing.
  func NewAISDKStreamWriter(w http.ResponseWriter) (*AISDKStreamWriter, error) {
      // ...
  }
  ```

#### Add Inline Comments
- [ ] Add comments for complex logic
- [ ] Add comments explaining protocol details
- [ ] Add comments for edge cases

**Checkpoint:** Documentation complete ✓

**Commit:** `docs(llm): add code comments and documentation`

---

## Final Checklist

### Code Quality
- [ ] All tests passing
- [ ] 90%+ test coverage
- [ ] No race conditions (tested with `-race`)
- [ ] No compiler warnings
- [ ] Linting passes
- [ ] Code follows project conventions

### Functionality
- [ ] All event types implemented
- [ ] Anthropic events correctly converted
- [ ] Error handling comprehensive
- [ ] Thread-safe implementation
- [ ] SSE format compliant

### Documentation
- [ ] Code comments added
- [ ] Function documentation complete
- [ ] Complex logic explained

### Git
- [ ] All changes committed
- [ ] Commit messages clear and descriptive
- [ ] Branch ready for review

---

## Testing Checkpoints

### After Phase 1
- [ ] Stream writer creates successfully
- [ ] Basic events write correctly
- [ ] SSE format is correct

### After Phase 2
- [ ] Tool call events work
- [ ] Tool result events work
- [ ] All event types tested

### After Phase 3
- [ ] Anthropic events convert correctly
- [ ] All event types handled
- [ ] Stop reasons mapped correctly

### After Phase 4
- [ ] All tests pass
- [ ] Coverage meets target
- [ ] No race conditions

---

## Common Issues & Solutions

### Issue 1: ResponseWriter doesn't support flushing
**Symptoms:** `NewAISDKStreamWriter` returns error  
**Cause:** Using wrong ResponseWriter type  
**Solution:** Ensure using `http.ResponseWriter` that implements `http.Flusher` (most do)

### Issue 2: SSE format incorrect
**Symptoms:** Frontend can't parse events  
**Cause:** Missing double newline or wrong prefix  
**Solution:** Ensure format is exactly `"data: {json}\n\n"`

### Issue 3: JSON marshaling fails
**Symptoms:** `writeEvent` returns error  
**Cause:** Invalid data structure  
**Solution:** Ensure all event data is JSON-serializable

### Issue 4: Race condition detected
**Symptoms:** Race detector finds issues  
**Cause:** Concurrent writes without mutex  
**Solution:** Ensure all writes use mutex lock

---

## Time Tracking

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| Phase 1: Foundation | 1-2 h | | |
| Phase 2: Tool Calls | 1-2 h | | |
| Phase 3: Converter | 1.5-2 h | | |
| Phase 4: Testing | 1-2 h | | |
| Build & Verify | 30 min | | |
| Documentation | 30 min | | |
| **Total** | **4-6 h** | | |

---

**Remember:** Check off items as you complete them. This checklist is your guide to successful implementation!

