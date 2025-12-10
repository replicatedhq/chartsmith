# PR#8: Testing Guide

**Purpose:** Comprehensive testing strategy for tool call protocol support  
**Scope:** Unit tests, integration tests, E2E tests, performance tests  
**Target Coverage:** > 80% for new code

---

## Test Categories

### 1. Unit Tests

**Purpose:** Test individual functions in isolation  
**Location:** `pkg/llm/aisdk_tool_test.go`, `pkg/llm/aisdk_tools_test.go`  
**Target:** 100% coverage for new functions

#### 1.1: WriteToolCall Tests

**Function:** `AISDKStreamWriter.WriteToolCall()`

**Test Cases:**

##### Test 1: Valid Tool Call
```go
func TestWriteToolCall_Valid(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    args := map[string]string{"chart_name": "nginx"}
    err := writer.WriteToolCall("call_123", "latest_subchart_version", args)
    
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    assert.Contains(t, body, `"type":"tool-call"`)
    assert.Contains(t, body, `"toolCallId":"call_123"`)
    assert.Contains(t, body, `"toolName":"latest_subchart_version"`)
    assert.Contains(t, body, `"chart_name":"nginx"`)
}
```

**Expected:** Tool call event streamed correctly

##### Test 2: Empty ToolCallID
```go
func TestWriteToolCall_EmptyToolCallID(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    err := writer.WriteToolCall("", "latest_subchart_version", map[string]string{})
    
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "toolCallID")
}
```

**Expected:** Error returned for empty toolCallID

##### Test 3: Empty ToolName
```go
func TestWriteToolCall_EmptyToolName(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    err := writer.WriteToolCall("call_123", "", map[string]string{})
    
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "toolName")
}
```

**Expected:** Error returned for empty toolName

##### Test 4: Nil Args
```go
func TestWriteToolCall_NilArgs(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    err := writer.WriteToolCall("call_123", "latest_subchart_version", nil)
    
    // Should handle nil gracefully
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    assert.Contains(t, body, `"args":null`)
}
```

**Expected:** Nil args handled gracefully, streamed as null

##### Test 5: Complex Args
```go
func TestWriteToolCall_ComplexArgs(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    args := map[string]interface{}{
        "chart_name": "nginx",
        "version": 1.2,
        "enabled": true,
    }
    err := writer.WriteToolCall("call_123", "latest_subchart_version", args)
    
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    assert.Contains(t, body, `"chart_name":"nginx"`)
    assert.Contains(t, body, `"version":1.2`)
    assert.Contains(t, body, `"enabled":true`)
}
```

**Expected:** Complex args serialized correctly

---

#### 1.2: WriteToolResult Tests

**Function:** `AISDKStreamWriter.WriteToolResult()`

**Test Cases:**

##### Test 1: Valid String Result
```go
func TestWriteToolResult_StringResult(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    err := writer.WriteToolResult("call_123", "1.2.3")
    
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    assert.Contains(t, body, `"type":"tool-result"`)
    assert.Contains(t, body, `"toolCallId":"call_123"`)
    assert.Contains(t, body, `"result":"1.2.3"`)
}
```

**Expected:** Tool result event streamed correctly

##### Test 2: Object Result
```go
func TestWriteToolResult_ObjectResult(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    result := map[string]interface{}{
        "version": "1.2.3",
        "chart": "nginx",
    }
    err := writer.WriteToolResult("call_123", result)
    
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    assert.Contains(t, body, `"type":"tool-result"`)
    assert.Contains(t, body, `"version":"1.2.3"`)
}
```

**Expected:** Object result serialized correctly

##### Test 3: Error Result
```go
func TestWriteToolResult_ErrorResult(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    result := map[string]string{"error": "Chart not found"}
    err := writer.WriteToolResult("call_123", result)
    
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    assert.Contains(t, body, `"type":"tool-result"`)
    assert.Contains(t, body, `"error":"Chart not found"`)
}
```

**Expected:** Error result streamed correctly

##### Test 4: Empty ToolCallID
```go
func TestWriteToolResult_EmptyToolCallID(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    err := writer.WriteToolResult("", "result")
    
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "toolCallID")
}
```

**Expected:** Error returned for empty toolCallID

##### Test 5: Nil Result
```go
func TestWriteToolResult_NilResult(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    err := writer.WriteToolResult("call_123", nil)
    
    // Should handle nil gracefully
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    assert.Contains(t, body, `"result":null`)
}
```

**Expected:** Nil result handled gracefully

---

#### 1.3: ExecuteToolAndStream Tests

**Function:** `ExecuteToolAndStream()`

**Test Cases:**

##### Test 1: latest_subchart_version Success
```go
func TestExecuteToolAndStream_LatestSubchartVersion_Success(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    toolUse := anthropic.ToolUseBlock{
        ID:    "tool_123",
        Name:  "latest_subchart_version",
        Input: []byte(`{"chart_name": "nginx"}`),
    }
    
    result, err := ExecuteToolAndStream(context.Background(), writer, toolUse)
    
    // May succeed or fail depending on test environment
    // But should always stream events
    body := recorder.Body.String()
    assert.Contains(t, body, `"type":"tool-call"`)
    assert.Contains(t, body, `"type":"tool-result"`)
    
    t.Logf("Tool result: %s", result)
}
```

**Expected:** Tool call and result streamed, result returned

##### Test 2: latest_subchart_version Missing Chart Name
```go
func TestExecuteToolAndStream_LatestSubchartVersion_MissingChartName(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    toolUse := anthropic.ToolUseBlock{
        ID:    "tool_123",
        Name:  "latest_subchart_version",
        Input: []byte(`{}`),
    }
    
    _, err := ExecuteToolAndStream(context.Background(), writer, toolUse)
    
    // Should handle error gracefully
    body := recorder.Body.String()
    assert.Contains(t, body, `"type":"tool-call"`)
    assert.Contains(t, body, `"type":"tool-result"`)
    // Error should be in result
}
```

**Expected:** Error handled, streamed as tool result

##### Test 3: latest_kubernetes_version Major
```go
func TestExecuteToolAndStream_LatestKubernetesVersion_Major(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    toolUse := anthropic.ToolUseBlock{
        ID:    "tool_123",
        Name:  "latest_kubernetes_version",
        Input: []byte(`{"semver_field": "major"}`),
    }
    
    result, err := ExecuteToolAndStream(context.Background(), writer, toolUse)
    
    assert.NoError(t, err)
    assert.Contains(t, result, `"1"`)
    
    body := recorder.Body.String()
    assert.Contains(t, body, `"type":"tool-call"`)
    assert.Contains(t, body, `"type":"tool-result"`)
}
```

**Expected:** Returns "1" for major version

##### Test 4: latest_kubernetes_version Minor
```go
func TestExecuteToolAndStream_LatestKubernetesVersion_Minor(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    toolUse := anthropic.ToolUseBlock{
        ID:    "tool_123",
        Name:  "latest_kubernetes_version",
        Input: []byte(`{"semver_field": "minor"}`),
    }
    
    result, err := ExecuteToolAndStream(context.Background(), writer, toolUse)
    
    assert.NoError(t, err)
    assert.Contains(t, result, `"1.32"`)
}
```

**Expected:** Returns "1.32" for minor version

##### Test 5: latest_kubernetes_version Patch
```go
func TestExecuteToolAndStream_LatestKubernetesVersion_Patch(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    toolUse := anthropic.ToolUseBlock{
        ID:    "tool_123",
        Name:  "latest_kubernetes_version",
        Input: []byte(`{"semver_field": "patch"}`),
    }
    
    result, err := ExecuteToolAndStream(context.Background(), writer, toolUse)
    
    assert.NoError(t, err)
    assert.Contains(t, result, `"1.32.1"`)
}
```

**Expected:** Returns "1.32.1" for patch version

##### Test 6: Unknown Tool
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
    
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "unknown tool")
    
    // Should still stream tool call and error result
    body := recorder.Body.String()
    assert.Contains(t, body, `"type":"tool-call"`)
    assert.Contains(t, body, `"type":"tool-result"`)
}
```

**Expected:** Error returned, but events still streamed

##### Test 7: Invalid JSON Input
```go
func TestExecuteToolAndStream_InvalidJSONInput(t *testing.T) {
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    toolUse := anthropic.ToolUseBlock{
        ID:    "tool_123",
        Name:  "latest_subchart_version",
        Input: []byte(`{invalid json}`),
    }
    
    _, err := ExecuteToolAndStream(context.Background(), writer, toolUse)
    
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "parse tool input")
}
```

**Expected:** Error returned for invalid JSON

---

### 2. Integration Tests

**Purpose:** Test tool streaming in full chat flow  
**Location:** `pkg/llm/conversational_test.go` (or new integration test file)  
**Target:** All tool types, multi-turn conversations

#### 2.1: Tool Call Flow Test

**Scenario:** User asks about chart version, tool is called

```go
func TestConversationalChat_WithToolCall(t *testing.T) {
    // Setup
    ctx := context.Background()
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    ws := &workspacetypes.Workspace{...} // Mock workspace
    history := []workspacetypes.Chat{}
    prompt := "What is the latest nginx chart version?"
    
    // Execute
    err := StreamConversationalChat(ctx, writer, ws, history, prompt)
    
    // Verify
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    
    // Should have tool-call event
    assert.Contains(t, body, `"type":"tool-call"`)
    assert.Contains(t, body, `"toolName":"latest_subchart_version"`)
    
    // Should have tool-result event
    assert.Contains(t, body, `"type":"tool-result"`)
    
    // Should have final text response
    assert.Contains(t, body, `"type":"text-delta"`)
    
    // Should have finish event
    assert.Contains(t, body, `"type":"finish"`)
}
```

**Expected:** Complete flow works - tool called, result streamed, final response includes version

---

#### 2.2: Multi-Turn Tool Conversation Test

**Scenario:** Multiple tool calls in one conversation

```go
func TestConversationalChat_MultiTurnTools(t *testing.T) {
    // Setup
    ctx := context.Background()
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    ws := &workspacetypes.Workspace{...}
    history := []workspacetypes.Chat{}
    prompt := "What are the latest versions of nginx and redis charts?"
    
    // Execute
    err := StreamConversationalChat(ctx, writer, ws, history, prompt)
    
    // Verify
    assert.NoError(t, err)
    
    body := recorder.Body.String()
    
    // Should have multiple tool-call events
    toolCallCount := strings.Count(body, `"type":"tool-call"`)
    assert.GreaterOrEqual(t, toolCallCount, 2)
    
    // Should have corresponding tool-result events
    toolResultCount := strings.Count(body, `"type":"tool-result"`)
    assert.Equal(t, toolCallCount, toolResultCount)
}
```

**Expected:** Multiple tools executed, all results streamed, conversation continues

---

#### 2.3: Tool Error Handling Test

**Scenario:** Tool execution fails, error handled gracefully

```go
func TestConversationalChat_ToolError(t *testing.T) {
    // Setup
    ctx := context.Background()
    recorder := httptest.NewRecorder()
    writer, _ := NewAISDKStreamWriter(recorder)
    
    ws := &workspacetypes.Workspace{...}
    history := []workspacetypes.Chat{}
    prompt := "What is the latest version of nonexistent-chart-12345?"
    
    // Execute
    err := StreamConversationalChat(ctx, writer, ws, history, prompt)
    
    // Should not fail completely, error should be in tool result
    body := recorder.Body.String()
    
    // Should have tool-call event
    assert.Contains(t, body, `"type":"tool-call"`)
    
    // Should have tool-result event (may contain error)
    assert.Contains(t, body, `"type":"tool-result"`)
    
    // Conversation should continue
    assert.Contains(t, body, `"type":"text-delta"`)
}
```

**Expected:** Tool error streamed as result, conversation continues

---

### 3. E2E Tests

**Purpose:** Test full user flow from frontend to backend  
**Location:** Manual testing or E2E test suite  
**Target:** Real user scenarios

#### 3.1: Chart Version Lookup

**Steps:**
1. Open application in browser
2. Navigate to workspace chat
3. Send message: "What is the latest nginx chart version?"
4. Observe chat UI

**Expected Results:**
- [ ] Tool call visible in chat (if UI implemented)
- [ ] Tool result visible in chat
- [ ] Final response includes version: "The latest nginx chart version is X.Y.Z"
- [ ] No console errors
- [ ] Response time < 5 seconds

---

#### 3.2: Kubernetes Version Lookup

**Steps:**
1. Open application in browser
2. Navigate to workspace chat
3. Send message: "What is the latest Kubernetes minor version?"
4. Observe chat UI

**Expected Results:**
- [ ] Tool call visible in chat
- [ ] Tool result visible: "1.32"
- [ ] Final response includes version
- [ ] No console errors

---

#### 3.3: Multiple Tool Calls

**Steps:**
1. Open application in browser
2. Navigate to workspace chat
3. Send message: "What are the latest versions of nginx and redis charts?"
4. Observe chat UI

**Expected Results:**
- [ ] Multiple tool calls visible
- [ ] Multiple tool results visible
- [ ] Final response includes both versions
- [ ] Conversation flows naturally

---

### 4. Edge Cases

#### 4.1: Empty Tool Result
**Test:** Tool returns empty string  
**Expected:** Empty string streamed correctly, handled gracefully

#### 4.2: Large Tool Result
**Test:** Tool returns large object (> 1MB)  
**Expected:** Large result streamed correctly, no memory issues

#### 4.3: Concurrent Tool Calls
**Test:** Multiple tools called simultaneously  
**Expected:** All tools execute, all results streamed

#### 4.4: Tool Timeout
**Test:** Tool execution takes > 30 seconds  
**Expected:** Timeout handled, error streamed

#### 4.5: Invalid Tool Input
**Test:** Tool receives invalid input format  
**Expected:** Error streamed as tool result, conversation continues

---

### 5. Performance Tests

#### 5.1: Tool Execution Time
**Metric:** Time from tool call to tool result  
**Target:** < 100ms for simple tools (same as before)  
**Test:**
```go
func BenchmarkToolExecution(b *testing.B) {
    for i := 0; i < b.N; i++ {
        toolUse := anthropic.ToolUseBlock{
            ID:    "tool_123",
            Name:  "latest_kubernetes_version",
            Input: []byte(`{"semver_field": "minor"}`),
        }
        ExecuteToolAndStream(context.Background(), nil, toolUse)
    }
}
```

#### 5.2: Tool Streaming Latency
**Metric:** Time from tool execution to frontend receiving result  
**Target:** < 50ms  
**Test:** Measure time between `WriteToolResult` call and event appearing in HTTP response

#### 5.3: Multi-Turn Conversation Time
**Metric:** Total time for conversation with multiple tool calls  
**Target:** < 5 seconds total  
**Test:** E2E test with timing measurements

---

## Acceptance Criteria

**Feature is complete when:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests pass
- [ ] Tool calls stream correctly in AI SDK format
- [ ] Tool results stream correctly in AI SDK format
- [ ] `latest_subchart_version` tool works identically to before
- [ ] `latest_kubernetes_version` tool works identically to before
- [ ] Multi-turn tool conversations work correctly
- [ ] Tool errors handled gracefully
- [ ] Tool invocations visible in chat UI (if Phase 4 complete)
- [ ] Performance targets met
- [ ] No regressions in existing functionality

---

## Test Execution

### Running Unit Tests
```bash
# Run all tool-related tests
go test ./pkg/llm -v -run Tool

# Run specific test
go test ./pkg/llm -v -run TestWriteToolCall_Valid

# Run with coverage
go test ./pkg/llm -cover -run Tool
```

### Running Integration Tests
```bash
# Start worker with feature flag
ENABLE_AI_SDK_CHAT=true make run-worker

# Run integration tests
go test ./pkg/llm -v -run Integration

# Or test manually with curl
curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is the latest nginx chart version?"}],
    "workspaceId": "...",
    "userId": "..."
  }'
```

### Running E2E Tests
```bash
# Manual testing in browser
# Or use Playwright/Cypress if E2E suite exists
npm run test:e2e
```

---

## Test Data

### Mock Workspace
```go
ws := &workspacetypes.Workspace{
    ID: "test-workspace-123",
    // ... other fields
}
```

### Mock Tool Use Blocks
```go
toolUse := anthropic.ToolUseBlock{
    ID:    "tool_123",
    Name:  "latest_subchart_version",
    Input: []byte(`{"chart_name": "nginx"}`),
}
```

### Expected Tool Results
- `latest_subchart_version`: Version string (e.g., "1.2.3") or "?"
- `latest_kubernetes_version`: "1", "1.32", or "1.32.1" based on semver_field

---

## Regression Testing

### Existing Functionality to Verify
- [ ] Tool execution logic unchanged
- [ ] Tool results same as before
- [ ] Multi-turn conversations work
- [ ] Error handling same as before
- [ ] Performance same or better

### Comparison Testing
- [ ] Compare tool results before/after migration
- [ ] Compare response times before/after
- [ ] Compare error messages before/after

---

## Test Coverage Goals

- **WriteToolCall:** 100% coverage
- **WriteToolResult:** 100% coverage
- **ExecuteToolAndStream:** > 90% coverage
- **Tool execution handlers:** > 80% coverage
- **Integration flow:** > 70% coverage

---

## Continuous Testing

### Pre-Commit
- [ ] Run unit tests: `go test ./pkg/llm -v -run Tool`
- [ ] Run linter: `golangci-lint run ./pkg/llm`
- [ ] Check coverage: `go test ./pkg/llm -cover -run Tool`

### Pre-Merge
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Coverage > 80% for new code
- [ ] No linter errors
- [ ] Manual E2E testing complete

### Post-Deploy
- [ ] Monitor error logs for 24 hours
- [ ] Verify tool execution success rate
- [ ] Check performance metrics
- [ ] User acceptance testing

---

**Remember:** Test early, test often, test thoroughly! 🧪

