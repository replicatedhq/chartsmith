# PR#8: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (30 minutes)

- [ ] Read main planning document (~45 min)
  - [ ] Read `PR08_TOOL_CALL_PROTOCOL_SUPPORT.md`
  - [ ] Understand tool execution flow
  - [ ] Review existing tool implementations
  - [ ] Note any questions
- [ ] Prerequisites verified
  - [ ] PR#3 complete (AI SDK Streaming Adapter)
  - [ ] PR#4 complete (New Chat Streaming Endpoint)
  - [ ] PR#6 complete (useChat Hook Implementation)
  - [ ] Access to `pkg/llm` directory
  - [ ] Go 1.21+ installed
  - [ ] Understanding of Anthropic SDK tool use blocks
- [ ] Review existing tool code
  - [ ] Read `pkg/llm/conversational.go:99-230` (tool execution)
  - [ ] Read `pkg/llm/execute-action.go:510-660` (text_editor tool)
  - [ ] Understand tool input/output formats
- [ ] Git branch created
  ```bash
  git checkout -b feat/ai-sdk-tool-calls
  ```

---

## Phase 1: Add Tool Streaming Methods (2-3 hours)

### 1.1: Add WriteToolCall Method (30 minutes)

#### Open aisdk.go
- [ ] Open `pkg/llm/aisdk.go`
- [ ] Locate `AISDKStreamWriter` struct
- [ ] Find existing `WriteTextDelta` or `WriteFinish` methods for reference

#### Implement WriteToolCall
- [ ] Add method signature:
  ```go
  func (s *AISDKStreamWriter) WriteToolCall(toolCallID, toolName string, args interface{}) error {
      // Implementation
  }
  ```
- [ ] Create event map:
  ```go
  event := map[string]interface{}{
      "type":       "tool-call",
      "toolCallId": toolCallID,
      "toolName":   toolName,
      "args":       args,
  }
  ```
- [ ] Call `s.writeEvent(event)`
- [ ] Return error if writeEvent fails

#### Add Validation
- [ ] Validate `toolCallID` is non-empty
- [ ] Validate `toolName` is non-empty
- [ ] Return error if validation fails

**Checkpoint:** WriteToolCall method compiles ✓

**Commit:** `feat(pr08): add WriteToolCall method to AISDKStreamWriter`

---

### 1.2: Add WriteToolResult Method (30 minutes)

#### Implement WriteToolResult
- [ ] Add method signature:
  ```go
  func (s *AISDKStreamWriter) WriteToolResult(toolCallID string, result interface{}) error {
      // Implementation
  }
  ```
- [ ] Create event map:
  ```go
  event := map[string]interface{}{
      "type":       "tool-result",
      "toolCallId": toolCallID,
      "result":     result,
  }
  ```
- [ ] Call `s.writeEvent(event)`
- [ ] Return error if writeEvent fails

#### Add Validation
- [ ] Validate `toolCallID` is non-empty
- [ ] Handle nil result (convert to empty string or null)
- [ ] Return error if validation fails

**Checkpoint:** WriteToolResult method compiles ✓

**Commit:** `feat(pr08): add WriteToolResult method to AISDKStreamWriter`

---

### 1.3: Add Unit Tests for Streaming Methods (1 hour)

#### Create Test File
- [ ] Create `pkg/llm/aisdk_tool_test.go`
- [ ] Add package declaration and imports
- [ ] Import testing, httptest, strings packages

#### Test WriteToolCall
- [ ] Test valid tool call:
  ```go
  func TestWriteToolCall_Valid(t *testing.T) {
      recorder := httptest.NewRecorder()
      writer, _ := NewAISDKStreamWriter(recorder)
      
      err := writer.WriteToolCall("call_123", "latest_subchart_version", map[string]string{"chart_name": "nginx"})
      if err != nil {
          t.Fatalf("WriteToolCall failed: %v", err)
      }
      
      body := recorder.Body.String()
      if !strings.Contains(body, `"type":"tool-call"`) {
          t.Error("expected tool-call type")
      }
      if !strings.Contains(body, `"toolCallId":"call_123"`) {
          t.Error("expected toolCallId")
      }
      if !strings.Contains(body, `"toolName":"latest_subchart_version"`) {
          t.Error("expected toolName")
      }
  }
  ```
- [ ] Test empty toolCallID (should error)
- [ ] Test empty toolName (should error)
- [ ] Test nil args (should handle gracefully)

#### Test WriteToolResult
- [ ] Test valid tool result:
  ```go
  func TestWriteToolResult_Valid(t *testing.T) {
      recorder := httptest.NewRecorder()
      writer, _ := NewAISDKStreamWriter(recorder)
      
      err := writer.WriteToolResult("call_123", "1.2.3")
      if err != nil {
          t.Fatalf("WriteToolResult failed: %v", err)
      }
      
      body := recorder.Body.String()
      if !strings.Contains(body, `"type":"tool-result"`) {
          t.Error("expected tool-result type")
      }
      if !strings.Contains(body, `"toolCallId":"call_123"`) {
          t.Error("expected toolCallId")
      }
      if !strings.Contains(body, `"result":"1.2.3"`) {
          t.Error("expected result")
      }
  }
  ```
- [ ] Test object result (map[string]interface{})
- [ ] Test error result (map[string]string{"error": "..."})
- [ ] Test empty toolCallID (should error)
- [ ] Test nil result (should handle gracefully)

#### Run Tests
- [ ] Run tests: `go test ./pkg/llm -v -run TestWriteTool`
- [ ] Verify all tests pass
- [ ] Check test coverage: `go test ./pkg/llm -cover -run TestWriteTool`

**Checkpoint:** All streaming method tests pass ✓

**Commit:** `test(pr08): add unit tests for tool streaming methods`

---

## Phase 2: Create Tool Execution Handler (3-4 hours)

### 2.1: Create Tool Execution File (15 minutes)

#### Create New File
- [ ] Create `pkg/llm/aisdk_tools.go`
- [ ] Add package declaration
- [ ] Add imports:
  ```go
  import (
      "context"
      "encoding/json"
      "fmt"
      
      "github.com/anthropics/anthropic-sdk-go"
      "github.com/replicatedhq/chartsmith/pkg/recommendations"
  )
  ```

**Checkpoint:** File created with imports ✓

---

### 2.2: Implement ExecuteToolAndStream Function (1.5 hours)

#### Function Signature
- [ ] Add function signature:
  ```go
  func ExecuteToolAndStream(
      ctx context.Context,
      writer *AISDKStreamWriter,
      toolUse anthropic.ToolUseBlock,
  ) (string, error) {
      // Implementation
  }
  ```

#### Parse Tool Input
- [ ] Parse tool input:
  ```go
  var input map[string]interface{}
  if err := json.Unmarshal(toolUse.Input, &input); err != nil {
      return "", fmt.Errorf("failed to parse tool input: %w", err)
  }
  ```

#### Stream Tool Call
- [ ] Stream tool call event:
  ```go
  if err := writer.WriteToolCall(toolUse.ID, toolUse.Name, input); err != nil {
      return "", fmt.Errorf("failed to stream tool call: %w", err)
  }
  ```

#### Execute Tool Based on Name
- [ ] Add switch statement:
  ```go
  var result interface{}
  var err error
  
  switch toolUse.Name {
  case "latest_subchart_version":
      // Handle subchart version
  case "latest_kubernetes_version":
      // Handle Kubernetes version
  default:
      err = fmt.Errorf("unknown tool: %s", toolUse.Name)
  }
  ```

#### Implement latest_subchart_version Handler
- [ ] Extract chart_name from input:
  ```go
  chartName, ok := input["chart_name"].(string)
  if !ok {
      return "", fmt.Errorf("chart_name is required and must be string")
  }
  ```
- [ ] Call existing function:
  ```go
  version, err := recommendations.GetLatestSubchartVersion(chartName)
  if err == recommendations.ErrNoArtifactHubPackage {
      result = "?"
  } else if err != nil {
      result = map[string]string{"error": err.Error()}
  } else {
      result = version
  }
  ```

#### Implement latest_kubernetes_version Handler
- [ ] Extract semver_field from input:
  ```go
  semverField, _ := input["semver_field"].(string)
  ```
- [ ] Return version based on field:
  ```go
  switch semverField {
  case "major":
      result = "1"
  case "minor":
      result = "1.32"
  case "patch":
      result = "1.32.1"
  default:
      result = "1.32.1" // Default to patch
  }
  ```

#### Stream Tool Result
- [ ] Stream result:
  ```go
  if err := writer.WriteToolResult(toolUse.ID, result); err != nil {
      return "", fmt.Errorf("failed to stream tool result: %w", err)
  }
  ```

#### Return Result for Conversation
- [ ] Marshal result to string:
  ```go
  resultBytes, err := json.Marshal(result)
  if err != nil {
      return "", fmt.Errorf("failed to marshal result: %w", err)
  }
  return string(resultBytes), nil
  ```

**Checkpoint:** ExecuteToolAndStream function compiles ✓

**Commit:** `feat(pr08): implement ExecuteToolAndStream function`

---

### 2.3: Add Unit Tests for Tool Execution (1.5 hours)

#### Test latest_subchart_version Tool
- [ ] Create test:
  ```go
  func TestExecuteToolAndStream_LatestSubchartVersion(t *testing.T) {
      recorder := httptest.NewRecorder()
      writer, _ := NewAISDKStreamWriter(recorder)
      
      toolUse := anthropic.ToolUseBlock{
          ID:    "tool_123",
          Name:  "latest_subchart_version",
          Input: []byte(`{"chart_name": "nginx"}`),
      }
      
      result, err := ExecuteToolAndStream(context.Background(), writer, toolUse)
      
      // Check streaming output
      body := recorder.Body.String()
      if !strings.Contains(body, `"type":"tool-call"`) {
          t.Error("expected tool-call event")
      }
      if !strings.Contains(body, `"type":"tool-result"`) {
          t.Error("expected tool-result event")
      }
      
      // Result may be version or "?" or error
      t.Logf("Tool result: %s", result)
  }
  ```
- [ ] Test with invalid chart_name (should handle error)
- [ ] Test with missing chart_name (should error)

#### Test latest_kubernetes_version Tool
- [ ] Create test:
  ```go
  func TestExecuteToolAndStream_LatestKubernetesVersion(t *testing.T) {
      recorder := httptest.NewRecorder()
      writer, _ := NewAISDKStreamWriter(recorder)
      
      toolUse := anthropic.ToolUseBlock{
          ID:    "tool_123",
          Name:  "latest_kubernetes_version",
          Input: []byte(`{"semver_field": "minor"}`),
      }
      
      result, err := ExecuteToolAndStream(context.Background(), writer, toolUse)
      if err != nil {
          t.Fatalf("ExecuteToolAndStream failed: %v", err)
      }
      
      // Should return version
      if result == "" {
          t.Error("expected version result")
      }
      
      // Check streaming output
      body := recorder.Body.String()
      if !strings.Contains(body, `"type":"tool-call"`) {
          t.Error("expected tool-call event")
      }
      if !strings.Contains(body, `"type":"tool-result"`) {
          t.Error("expected tool-result event")
      }
  }
  ```
- [ ] Test with "major" field
- [ ] Test with "patch" field
- [ ] Test with invalid field (should default)

#### Test Unknown Tool
- [ ] Create test:
  ```go
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
      
      // Should still stream tool call and error result
      body := recorder.Body.String()
      if !strings.Contains(body, `"type":"tool-call"`) {
          t.Error("expected tool-call event")
      }
      if !strings.Contains(body, `"type":"tool-result"`) {
          t.Error("expected tool-result event")
      }
  }
  ```

#### Test Invalid Input
- [ ] Test with invalid JSON input
- [ ] Test with missing required fields
- [ ] Test with wrong field types

#### Run Tests
- [ ] Run tests: `go test ./pkg/llm -v -run TestExecuteTool`
- [ ] Verify all tests pass
- [ ] Check test coverage: `go test ./pkg/llm -cover -run TestExecuteTool`

**Checkpoint:** All tool execution tests pass ✓

**Commit:** `test(pr08): add unit tests for tool execution`

---

## Phase 3: Integrate Tool Streaming into Chat Flow (2-3 hours)

### 3.1: Review Current Chat Flow (30 minutes)

#### Understand Current Implementation
- [ ] Read `pkg/llm/conversational.go:135-230`
- [ ] Understand tool execution loop
- [ ] Note where tool use blocks are detected
- [ ] Note where tool results are added to conversation

#### Identify Integration Points
- [ ] Find where `AISDKStreamWriter` is created
- [ ] Find where Anthropic stream events are processed
- [ ] Find where tool use blocks are detected
- [ ] Find where tool execution happens

**Checkpoint:** Understand current flow ✓

---

### 3.2: Modify StreamConversationalChat Function (1.5 hours)

#### Locate Function
- [ ] Open `pkg/llm/conversational.go`
- [ ] Find `StreamConversationalChat` function (or equivalent)
- [ ] Note current streaming implementation

#### Add Tool Detection
- [ ] After accumulating message, check for tool use blocks:
  ```go
  var toolUseBlocks []anthropic.ToolUseBlock
  for _, block := range message.Content {
      if block.Type == anthropic.ContentBlockTypeToolUse {
          toolUseBlocks = append(toolUseBlocks, block)
      }
  }
  ```

#### Stream Tool Calls
- [ ] For each tool use block, stream tool call:
  ```go
  for _, toolUse := range toolUseBlocks {
      // Parse input
      var input map[string]interface{}
      json.Unmarshal(toolUse.Input, &input)
      
      // Stream tool call
      writer.WriteToolCall(toolUse.ID, toolUse.Name, input)
  }
  ```

#### Execute Tools and Stream Results
- [ ] Execute each tool and stream result:
  ```go
  toolResults := []anthropic.ContentBlockParamUnion{}
  for _, toolUse := range toolUseBlocks {
      result, err := ExecuteToolAndStream(ctx, writer, toolUse)
      if err != nil {
          // Handle error
          continue
      }
      
      // Create tool result block for conversation
      resultBytes, _ := json.Marshal(result)
      toolResults = append(toolResults, anthropic.NewToolResultBlock(
          toolUse.ID,
          string(resultBytes),
          false,
      ))
  }
  ```

#### Continue Conversation
- [ ] Add tool results to conversation (existing logic):
  ```go
  if len(toolUseBlocks) > 0 {
      messages = append(messages, anthropic.MessageParam{
          Role:    anthropic.F(anthropic.MessageParamRoleUser),
          Content: anthropic.F(toolResults),
      })
      // Continue loop to get next response
  }
  ```

#### Preserve Existing Behavior
- [ ] Ensure tool execution logic unchanged
- [ ] Ensure error handling unchanged
- [ ] Ensure multi-turn conversation handling unchanged

**Checkpoint:** Modified function compiles ✓

**Commit:** `feat(pr08): integrate tool streaming into conversational chat`

---

### 3.3: Test Integration (1 hour)

#### Manual Testing
- [ ] Start Go worker with feature flag enabled
- [ ] Send test message: "What's the latest nginx chart version?"
- [ ] Verify tool-call event in response
- [ ] Verify tool-result event in response
- [ ] Verify final text response includes version

#### Test Multi-Turn Conversation
- [ ] Send message that triggers multiple tool calls
- [ ] Verify all tool calls streamed
- [ ] Verify all tool results streamed
- [ ] Verify conversation continues correctly

#### Test Error Handling
- [ ] Send message with invalid tool input
- [ ] Verify error streamed as tool result
- [ ] Verify conversation continues with error

**Checkpoint:** Integration tests pass ✓

**Commit:** `test(pr08): add integration tests for tool streaming`

---

## Phase 4: Frontend Tool Display (1-2 hours)

### 4.1: Update ChatMessage Component (1 hour)

#### Open Component
- [ ] Open `chartsmith-app/components/ChatMessage.tsx`
- [ ] Review current message rendering
- [ ] Check if `useChat` hook provides `toolInvocations`

#### Add Tool Display
- [ ] Check for tool invocations:
  ```typescript
  {message.toolInvocations && message.toolInvocations.length > 0 && (
      <div className="tool-invocations">
          {message.toolInvocations.map((tool, idx) => (
              <div key={idx} className="tool-call">
                  {/* Tool display */}
              </div>
          ))}
      </div>
  )}
  ```

#### Display Tool Name
- [ ] Show tool name:
  ```typescript
  <div className="tool-name">
      🔧 {tool.toolName}
  </div>
  ```

#### Display Tool Arguments
- [ ] Show tool arguments:
  ```typescript
  {tool.args && (
      <div className="tool-args">
          <pre>{JSON.stringify(tool.args, null, 2)}</pre>
      </div>
  )}
  ```

#### Display Tool Result
- [ ] Show tool result:
  ```typescript
  {tool.result && (
      <div className="tool-result">
          Result: {typeof tool.result === 'string' 
              ? tool.result 
              : JSON.stringify(tool.result, null, 2)}
      </div>
  )}
  ```

#### Style Tool Display
- [ ] Add CSS classes for tool display
- [ ] Style consistently with existing message UI
- [ ] Make tool display visually distinct but not jarring

**Checkpoint:** Tool display renders correctly ✓

**Commit:** `feat(pr08): add tool invocation display to ChatMessage`

---

### 4.2: Test Frontend Display (30 minutes)

#### Visual Testing
- [ ] Send message that triggers tool call
- [ ] Verify tool call visible in UI
- [ ] Verify tool result visible in UI
- [ ] Verify styling looks good

#### Test Different Tools
- [ ] Test with `latest_subchart_version`
- [ ] Test with `latest_kubernetes_version`
- [ ] Verify both display correctly

#### Test Error Cases
- [ ] Test with tool error result
- [ ] Verify error displayed correctly
- [ ] Verify error styling different from success

**Checkpoint:** Frontend display works correctly ✓

**Commit:** `test(pr08): verify tool display in frontend`

---

## Phase 5: Testing & Bug Fixes (2-3 hours)

### 5.1: Unit Tests (30 minutes)

#### Run All Unit Tests
- [ ] Run: `go test ./pkg/llm -v`
- [ ] Verify all tests pass
- [ ] Fix any failing tests

#### Check Test Coverage
- [ ] Run: `go test ./pkg/llm -cover`
- [ ] Verify coverage > 80% for new code
- [ ] Add tests for uncovered code if needed

**Checkpoint:** All unit tests pass ✓

---

### 5.2: Integration Tests (1 hour)

#### Test Tool Call Flow
- [ ] Start worker: `ENABLE_AI_SDK_CHAT=true make run-worker`
- [ ] Send curl request:
  ```bash
  curl -X POST http://localhost:8080/api/v1/chat/stream \
    -H "Content-Type: application/json" \
    -d '{
      "messages": [{"role": "user", "content": "What is the latest nginx chart version?"}],
      "workspaceId": "...",
      "userId": "..."
    }'
  ```
- [ ] Verify response includes:
  - `tool-call` event
  - `tool-result` event
  - Final `text-delta` events
  - `finish` event

#### Test Multiple Tools
- [ ] Send message that triggers multiple tools
- [ ] Verify all tools executed
- [ ] Verify all results streamed

#### Test Error Handling
- [ ] Send message with invalid tool input
- [ ] Verify error handled gracefully
- [ ] Verify error streamed correctly

**Checkpoint:** Integration tests pass ✓

---

### 5.3: E2E Testing (1 hour)

#### Test User Flow
- [ ] Open application in browser
- [ ] Send message: "What's the latest nginx chart version?"
- [ ] Verify tool call visible in chat
- [ ] Verify tool result visible in chat
- [ ] Verify final response includes version

#### Test Kubernetes Version
- [ ] Send message: "What's the latest Kubernetes minor version?"
- [ ] Verify tool called correctly
- [ ] Verify result displayed correctly

#### Test Multi-Turn
- [ ] Send message that requires multiple tool calls
- [ ] Verify conversation flows correctly
- [ ] Verify all tools executed

**Checkpoint:** E2E tests pass ✓

---

### 5.4: Bug Fixes (30 minutes)

#### Fix Any Issues Found
- [ ] Document bugs found during testing
- [ ] Fix bugs
- [ ] Re-test fixes
- [ ] Update tests if needed

**Checkpoint:** All bugs fixed ✓

**Commit:** `fix(pr08): resolve bugs found during testing`

---

## Completion Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] Tool calls stream correctly
- [ ] Tool results stream correctly
- [ ] All three tools work identically to before
- [ ] Tool display works in frontend
- [ ] No regressions in existing functionality
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Ready for merge

---

## Deployment Checklist

### Pre-Deploy
- [ ] All tests passing locally
- [ ] Build succeeds: `go build ./...`
- [ ] No linter errors
- [ ] Feature flag ready (if needed)

### Deploy to Staging
- [ ] Deploy worker with new code
- [ ] Enable feature flag
- [ ] Test tool calling in staging
- [ ] Verify no errors in logs

### Deploy to Production
- [ ] Deploy worker
- [ ] Enable feature flag gradually (if using rollout)
- [ ] Monitor for errors
- [ ] Verify tool calling works

### Post-Deploy
- [ ] Monitor error logs for 24 hours
- [ ] Verify tool execution success rate
- [ ] Check performance metrics
- [ ] Update status in tracking systems

---

**Remember:** Commit frequently, test after each phase, and document any deviations from the plan!

