# PR#2: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (~30 min)
- [ ] Prerequisites verified
  - [ ] Go 1.23+ installed
  - [ ] Access to GitHub (for dependency)
- [ ] Git branch created
  ```bash
  git checkout -b feat/ai-sdk-go-foundation
  ```
- [ ] Review existing `pkg/llm/` structure
  - [ ] Understand existing patterns
  - [ ] Review `pkg/llm/types/types.go` for type organization
  - [ ] Review `pkg/llm/conversational.go` for streaming patterns

---

## Phase 1: Dependency Setup (15 minutes)

### 1.1: Add aisdk-go Dependency (10 minutes)

#### Add to go.mod
- [ ] Open `go.mod`
- [ ] Add dependency:
  ```go
  require (
      github.com/coder/aisdk-go v0.1.0  // Check latest version
  )
  ```

#### Download and Verify
- [ ] Run `go mod tidy`
  ```bash
  cd /Users/isaac/Documents/Replicated/chartsmith
  go mod tidy
  ```
- [ ] Verify no conflicts
  ```bash
  go build ./...
  ```
- [ ] Check `go.sum` was updated correctly

**Checkpoint:** Dependency installed, code compiles ✓

**Commit:** `feat(llm): add aisdk-go dependency`

---

### 1.2: Verify Compatibility (5 minutes)

- [ ] Run existing tests
  ```bash
  go test ./pkg/llm/...
  ```
- [ ] Verify all tests pass
- [ ] Check for any import conflicts

**Checkpoint:** No regressions introduced ✓

---

## Phase 2: Type Definitions (30 minutes)

### 2.1: Create Types File (10 minutes)

#### Create File
- [ ] Create `pkg/llm/types/aisdk.go`

#### Add Package and Imports
- [ ] Add package declaration
  ```go
  package types
  
  import (
      "github.com/coder/aisdk-go"
  )
  ```

#### Add Type Definitions
- [ ] Add AISDKMessage type
  ```go
  // AISDKMessage represents an AI SDK format message
  type AISDKMessage struct {
      Role    string `json:"role"`    // "user", "assistant", "system"
      Content string `json:"content"`
  }
  ```

- [ ] Add helper functions for conversion (stubs)
  ```go
  // ConvertAnthropicMessage converts Anthropic format to AI SDK format
  func ConvertAnthropicMessage(msg interface{}) (*AISDKMessage, error) {
      // Stub - will implement in PR#3
      return nil, fmt.Errorf("not implemented")
  }
  ```

**Checkpoint:** Types file created ✓

**Commit:** `feat(llm): add AI SDK type definitions`

---

### 2.2: Add Stream Event Types (20 minutes)

- [ ] Add stream event wrapper type
  ```go
  // AISDKStreamEvent wraps AI SDK stream events
  type AISDKStreamEvent struct {
      Type string      `json:"type"`
      Data interface{} `json:"-"`
  }
  ```

- [ ] Add constants for event types
  ```go
  const (
      EventTypeTextDelta  = "text-delta"
      EventTypeToolCall   = "tool-call"
      EventTypeToolResult = "tool-result"
      EventTypeFinish     = "finish"
  )
  ```

- [ ] Verify types compile
  ```bash
  go build ./pkg/llm/types/...
  ```

**Checkpoint:** All types defined and compile ✓

---

## Phase 3: Adapter Shell (45 minutes)

### 3.1: Create Adapter File (10 minutes)

#### Create File
- [ ] Create `pkg/llm/aisdk.go`

#### Add Package and Imports
- [ ] Add package declaration
  ```go
  package llm
  
  import (
      "context"
      "encoding/json"
      "fmt"
      "net/http"
      
      "github.com/coder/aisdk-go"
      workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
  )
  ```

**Checkpoint:** File created with imports ✓

---

### 3.2: Implement AISDKStreamWriter Struct (15 minutes)

#### Define Struct
- [ ] Add AISDKStreamWriter struct
  ```go
  // AISDKStreamWriter wraps HTTP response writer to output AI SDK protocol
  type AISDKStreamWriter struct {
      writer  http.ResponseWriter
      flusher http.Flusher
  }
  ```

#### Add Constructor
- [ ] Add NewAISDKStreamWriter function
  ```go
  // NewAISDKStreamWriter creates a new AI SDK stream writer
  func NewAISDKStreamWriter(w http.ResponseWriter) *AISDKStreamWriter {
      flusher, _ := w.(http.Flusher)
      return &AISDKStreamWriter{
          writer:  w,
          flusher: flusher,
      }
  }
  ```

**Checkpoint:** Struct and constructor complete ✓

---

### 3.3: Implement Write Methods (20 minutes)

#### WriteTextDelta
- [ ] Implement WriteTextDelta method
  ```go
  // WriteTextDelta writes a text delta event
  func (w *AISDKStreamWriter) WriteTextDelta(text string) error {
      event := aisdk.TextDeltaEvent{
          Type:      "text-delta",
          TextDelta: text,
      }
      return w.writeEvent(event)
  }
  ```

#### WriteToolCall
- [ ] Implement WriteToolCall method
  ```go
  // WriteToolCall writes a tool call event
  func (w *AISDKStreamWriter) WriteToolCall(id, name string, args interface{}) error {
      event := aisdk.ToolCallEvent{
          Type:       "tool-call",
          ToolCallID: id,
          ToolName:   name,
          Args:       args,
      }
      return w.writeEvent(event)
  }
  ```

#### WriteToolResult
- [ ] Implement WriteToolResult method
  ```go
  // WriteToolResult writes a tool result event
  func (w *AISDKStreamWriter) WriteToolResult(id string, result interface{}) error {
      event := aisdk.ToolResultEvent{
          Type:       "tool-result",
          ToolCallID: id,
          Result:     result,
      }
      return w.writeEvent(event)
  }
  ```

#### WriteFinish
- [ ] Implement WriteFinish method
  ```go
  // WriteFinish writes a finish event
  func (w *AISDKStreamWriter) WriteFinish(reason string) error {
      event := aisdk.FinishEvent{
          Type:         "finish",
          FinishReason: reason,
      }
      return w.writeEvent(event)
  }
  ```

**Checkpoint:** All write methods implemented ✓

---

### 3.4: Implement writeEvent Helper (10 minutes)

- [ ] Implement writeEvent helper method
  ```go
  // writeEvent writes a single SSE event
  func (w *AISDKStreamWriter) writeEvent(event interface{}) error {
      data, err := json.Marshal(event)
      if err != nil {
          return fmt.Errorf("failed to marshal event: %w", err)
      }
      
      _, err = fmt.Fprintf(w.writer, "data: %s\n\n", data)
      if err != nil {
          return fmt.Errorf("failed to write event: %w", err)
      }
      
      if w.flusher != nil {
          w.flusher.Flush()
      }
      
      return nil
  }
  ```

- [ ] Verify code compiles
  ```bash
  go build ./pkg/llm/...
  ```

**Checkpoint:** Helper method complete, code compiles ✓

**Commit:** `feat(llm): implement AI SDK stream writer adapter`

---

## Phase 4: Basic Tests (30 minutes)

### 4.1: Create Test File (5 minutes)

#### Create File
- [ ] Create `pkg/llm/aisdk_test.go`

#### Add Package and Imports
- [ ] Add package declaration and imports
  ```go
  package llm
  
  import (
      "net/http"
      "net/http/httptest"
      "testing"
  )
  ```

**Checkpoint:** Test file created ✓

---

### 4.2: Test Adapter Creation (10 minutes)

- [ ] Test NewAISDKStreamWriter
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

- [ ] Run test
  ```bash
  go test ./pkg/llm -run TestNewAISDKStreamWriter
  ```

**Checkpoint:** Constructor test passes ✓

---

### 4.3: Test Write Methods (15 minutes)

#### Test WriteTextDelta
- [ ] Add test for WriteTextDelta
  ```go
  func TestWriteTextDelta(t *testing.T) {
      w := httptest.NewRecorder()
      writer := NewAISDKStreamWriter(w)
      
      err := writer.WriteTextDelta("Hello")
      if err != nil {
          t.Fatalf("unexpected error: %v", err)
      }
      
      body := w.Body.String()
      if body == "" {
          t.Error("expected non-empty body")
      }
      
      // Verify SSE format
      if !contains(body, "data:") {
          t.Error("expected SSE format with 'data:' prefix")
      }
  }
  ```

- [ ] Add helper function if needed
  ```go
  func contains(s, substr string) bool {
      return len(s) >= len(substr) && (s == substr || len(substr) == 0 || 
          (len(s) > len(substr) && contains(s[1:], substr)))
  }
  ```

- [ ] Run test
  ```bash
  go test ./pkg/llm -run TestWriteTextDelta
  ```

#### Test Other Write Methods (stub tests)
- [ ] Add stub tests for WriteToolCall, WriteToolResult, WriteFinish
  ```go
  func TestWriteToolCall(t *testing.T) {
      w := httptest.NewRecorder()
      writer := NewAISDKStreamWriter(w)
      
      err := writer.WriteToolCall("call_123", "test_tool", map[string]string{})
      if err != nil {
          t.Fatalf("unexpected error: %v", err)
      }
      
      body := w.Body.String()
      if body == "" {
          t.Error("expected non-empty body")
      }
  }
  
  func TestWriteToolResult(t *testing.T) {
      // Similar structure
  }
  
  func TestWriteFinish(t *testing.T) {
      // Similar structure
  }
  ```

- [ ] Run all tests
  ```bash
  go test ./pkg/llm/...
  ```

**Checkpoint:** All tests pass ✓

**Commit:** `test(llm): add tests for AI SDK adapter`

---

## Testing Phase (15 minutes)

### Unit Tests
- [ ] Test suite created ✓
- [ ] All functions have tests ✓
- [ ] Edge cases covered
  - [ ] Nil writer handling
  - [ ] Non-Flusher ResponseWriter
- [ ] All tests passing ✓

### Integration Tests
- [ ] N/A for this PR (adapter not connected yet)

### Manual Testing
- [ ] Code compiles without errors ✓
- [ ] No linter errors
  ```bash
  golangci-lint run ./pkg/llm/...
  ```
- [ ] Existing tests still pass
  ```bash
  go test ./pkg/llm/...
  ```

---

## Documentation Phase (15 minutes)

- [ ] Code comments added
  - [ ] Package-level comment for `aisdk.go`
  - [ ] Function comments for exported functions
  - [ ] Type comments for exported types
- [ ] README updated (if applicable)
- [ ] Inline comments for complex logic

**Commit:** `docs(llm): add comments to AI SDK adapter`

---

## Completion Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] Code compiles without errors
- [ ] No linter errors
- [ ] Documentation complete
- [ ] Code follows existing patterns
- [ ] No existing functionality broken
- [ ] Ready for PR review

---

## Verification Steps

Before marking complete, verify:

1. **Dependency Added**
   ```bash
   grep "coder/aisdk-go" go.mod
   ```

2. **Files Created**
   ```bash
   ls -la pkg/llm/aisdk.go
   ls -la pkg/llm/aisdk_test.go
   ls -la pkg/llm/types/aisdk.go
   ```

3. **Code Compiles**
   ```bash
   go build ./pkg/llm/...
   ```

4. **Tests Pass**
   ```bash
   go test ./pkg/llm/...
   ```

5. **No Regressions**
   ```bash
   go test ./...
   ```

---

## Common Issues & Solutions

### Issue 1: Dependency Not Found
**Symptoms:** `go mod tidy` fails with "module not found"  
**Cause:** Network issue or incorrect module path  
**Solution:**
```bash
# Check module path is correct
# Should be: github.com/coder/aisdk-go

# Try with proxy
GOPROXY=direct go mod tidy
```

### Issue 2: Type Conflicts
**Symptoms:** Compilation errors about conflicting types  
**Cause:** Import conflicts or wrong package  
**Solution:**
- Check imports are correct
- Use aliases if needed: `aisdk "github.com/coder/aisdk-go"`

### Issue 3: Tests Fail
**Symptoms:** Test failures in WriteTextDelta or other methods  
**Cause:** SSE format incorrect or JSON marshaling issue  
**Solution:**
- Verify SSE format: `data: {json}\n\n`
- Check JSON marshaling works for event types
- Add debug logging to see actual output

---

## Time Tracking

**Estimated:** 2-3 hours  
**Actual:** ___ hours

**Breakdown:**
- Phase 1: ___ minutes
- Phase 2: ___ minutes
- Phase 3: ___ minutes
- Phase 4: ___ minutes
- Testing: ___ minutes
- Documentation: ___ minutes

---

**Status:** ⏳ IN PROGRESS / ✅ COMPLETE

