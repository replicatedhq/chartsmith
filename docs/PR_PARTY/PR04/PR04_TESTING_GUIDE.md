# PR#4: Testing Guide

**Purpose:** Comprehensive testing strategy for the new chat streaming endpoint  
**Scope:** Unit tests, integration tests, manual testing, performance testing

---

## Test Categories

### 1. Unit Tests

#### 1.1: Authentication Tests

**File:** `pkg/api/auth_test.go`

**Test Cases:**

**TestExtractBearerToken_ValidToken**
```go
func TestExtractBearerToken_ValidToken(t *testing.T) {
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", nil)
    req.Header.Set("Authorization", "Bearer valid_token_123")
    
    token, err := ExtractBearerToken(req)
    
    assert.NoError(t, err)
    assert.Equal(t, "valid_token_123", token)
}
```

**TestExtractBearerToken_MissingHeader**
```go
func TestExtractBearerToken_MissingHeader(t *testing.T) {
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", nil)
    
    token, err := ExtractBearerToken(req)
    
    assert.Error(t, err)
    assert.Empty(t, token)
    assert.Contains(t, err.Error(), "missing authorization header")
}
```

**TestExtractBearerToken_InvalidFormat**
```go
func TestExtractBearerToken_InvalidFormat(t *testing.T) {
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", nil)
    req.Header.Set("Authorization", "InvalidFormat token")
    
    token, err := ExtractBearerToken(req)
    
    assert.Error(t, err)
    assert.Empty(t, token)
    assert.Contains(t, err.Error(), "invalid authorization format")
}
```

**TestValidateSession_ValidToken**
```go
func TestValidateSession_ValidToken(t *testing.T) {
    // Setup: Create valid session in test database
    ctx := context.Background()
    token := "valid_session_token"
    
    userID, err := ValidateSession(ctx, token)
    
    assert.NoError(t, err)
    assert.NotEmpty(t, userID)
}
```

**TestValidateSession_InvalidToken**
```go
func TestValidateSession_InvalidToken(t *testing.T) {
    ctx := context.Background()
    token := "invalid_token"
    
    userID, err := ValidateSession(ctx, token)
    
    assert.Error(t, err)
    assert.Empty(t, userID)
}
```

**TestValidateSession_ExpiredToken**
```go
func TestValidateSession_ExpiredToken(t *testing.T) {
    // Setup: Create expired session in test database
    ctx := context.Background()
    token := "expired_session_token"
    
    userID, err := ValidateSession(ctx, token)
    
    assert.Error(t, err)
    assert.Empty(t, userID)
    assert.Contains(t, err.Error(), "expired")
}
```

**TestVerifyWorkspaceAccess_ValidAccess**
```go
func TestVerifyWorkspaceAccess_ValidAccess(t *testing.T) {
    ctx := context.Background()
    userID := "user_123"
    workspaceID := "ws_abc"
    
    // Setup: Create workspace and grant user access
    
    workspace, err := VerifyWorkspaceAccess(ctx, userID, workspaceID)
    
    assert.NoError(t, err)
    assert.NotNil(t, workspace)
    assert.Equal(t, workspaceID, workspace.ID)
}
```

**TestVerifyWorkspaceAccess_NoAccess**
```go
func TestVerifyWorkspaceAccess_NoAccess(t *testing.T) {
    ctx := context.Background()
    userID := "user_123"
    workspaceID := "ws_xyz" // User doesn't have access
    
    workspace, err := VerifyWorkspaceAccess(ctx, userID, workspaceID)
    
    assert.Error(t, err)
    assert.Nil(t, workspace)
    assert.Contains(t, err.Error(), "does not have access")
}
```

---

#### 1.2: Request Parsing Tests

**File:** `pkg/api/chat_test.go`

**Test Cases:**

**TestParseChatRequest_ValidRequest**
```go
func TestParseChatRequest_ValidRequest(t *testing.T) {
    body := `{
        "messages": [
            {"id": "msg1", "role": "user", "content": "Hello"}
        ],
        "workspaceId": "ws_123",
        "revisionNumber": 1,
        "role": "auto"
    }`
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    
    parsed, err := parseChatRequest(req)
    
    assert.NoError(t, err)
    assert.NotNil(t, parsed)
    assert.Equal(t, "ws_123", parsed.WorkspaceID)
    assert.Len(t, parsed.Messages, 1)
    assert.Equal(t, "user", parsed.Messages[0].Role)
}
```

**TestParseChatRequest_MissingMessages**
```go
func TestParseChatRequest_MissingMessages(t *testing.T) {
    body := `{
        "workspaceId": "ws_123"
    }`
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(body))
    
    parsed, err := parseChatRequest(req)
    
    assert.Error(t, err)
    assert.Nil(t, parsed)
    assert.Contains(t, err.Error(), "messages")
}
```

**TestParseChatRequest_EmptyMessages**
```go
func TestParseChatRequest_EmptyMessages(t *testing.T) {
    body := `{
        "messages": [],
        "workspaceId": "ws_123"
    }`
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(body))
    
    parsed, err := parseChatRequest(req)
    
    assert.Error(t, err)
    assert.Nil(t, parsed)
    assert.Contains(t, err.Error(), "empty")
}
```

**TestParseChatRequest_MissingWorkspaceID**
```go
func TestParseChatRequest_MissingWorkspaceID(t *testing.T) {
    body := `{
        "messages": [{"id": "msg1", "role": "user", "content": "Hello"}]
    }`
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(body))
    
    parsed, err := parseChatRequest(req)
    
    assert.Error(t, err)
    assert.Nil(t, parsed)
    assert.Contains(t, err.Error(), "workspaceId")
}
```

**TestParseChatRequest_InvalidJSON**
```go
func TestParseChatRequest_InvalidJSON(t *testing.T) {
    body := `{ invalid json }`
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(body))
    
    parsed, err := parseChatRequest(req)
    
    assert.Error(t, err)
    assert.Nil(t, parsed)
}
```

**TestParseChatRequest_InvalidMessageFormat**
```go
func TestParseChatRequest_InvalidMessageFormat(t *testing.T) {
    body := `{
        "messages": [
            {"id": "msg1"}  // Missing role and content
        ],
        "workspaceId": "ws_123"
    }`
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(body))
    
    parsed, err := parseChatRequest(req)
    
    assert.Error(t, err)
    assert.Nil(t, parsed)
    assert.Contains(t, err.Error(), "role")
}
```

---

#### 1.3: Message Conversion Tests

**File:** `pkg/api/chat_test.go`

**Test Cases:**

**TestConvertAISDKMessagesToChatHistory_UserMessage**
```go
func TestConvertAISDKMessagesToChatHistory_UserMessage(t *testing.T) {
    messages := []AISDKMessage{
        {
            ID:      "msg_1",
            Role:    "user",
            Content: "Hello, how are you?",
        },
    }
    
    history, err := convertAISDKMessagesToChatHistory(messages)
    
    assert.NoError(t, err)
    assert.Len(t, history, 1)
    assert.Equal(t, "msg_1", history[0].ID)
    assert.Equal(t, "Hello, how are you?", history[0].Prompt)
    assert.Equal(t, "user", history[0].SentBy)
}
```

**TestConvertAISDKMessagesToChatHistory_AssistantMessage**
```go
func TestConvertAISDKMessagesToChatHistory_AssistantMessage(t *testing.T) {
    messages := []AISDKMessage{
        {
            ID:      "msg_2",
            Role:    "assistant",
            Content: "I'm doing well!",
        },
    }
    
    history, err := convertAISDKMessagesToChatHistory(messages)
    
    assert.NoError(t, err)
    assert.Len(t, history, 1)
    assert.Equal(t, "msg_2", history[0].ID)
    assert.Equal(t, "I'm doing well!", history[0].Response)
    assert.Equal(t, "assistant", history[0].SentBy)
}
```

**TestConvertAISDKMessagesToChatHistory_SystemMessage**
```go
func TestConvertAISDKMessagesToChatHistory_SystemMessage(t *testing.T) {
    messages := []AISDKMessage{
        {
            ID:      "msg_3",
            Role:    "system",
            Content: "You are a helpful assistant.",
        },
    }
    
    history, err := convertAISDKMessagesToChatHistory(messages)
    
    assert.NoError(t, err)
    assert.Len(t, history, 0) // System messages should be skipped
}
```

**TestConvertAISDKMessagesToChatHistory_MultipleMessages**
```go
func TestConvertAISDKMessagesToChatHistory_MultipleMessages(t *testing.T) {
    messages := []AISDKMessage{
        {ID: "msg_1", Role: "user", Content: "Hello"},
        {ID: "msg_2", Role: "assistant", Content: "Hi there"},
        {ID: "msg_3", Role: "user", Content: "How are you?"},
    }
    
    history, err := convertAISDKMessagesToChatHistory(messages)
    
    assert.NoError(t, err)
    assert.Len(t, history, 3)
    assert.Equal(t, "msg_1", history[0].ID)
    assert.Equal(t, "msg_2", history[1].ID)
    assert.Equal(t, "msg_3", history[2].ID)
}
```

**TestConvertAISDKMessagesToChatHistory_UnknownRole**
```go
func TestConvertAISDKMessagesToChatHistory_UnknownRole(t *testing.T) {
    messages := []AISDKMessage{
        {ID: "msg_1", Role: "unknown", Content: "Test"},
    }
    
    history, err := convertAISDKMessagesToChatHistory(messages)
    
    assert.Error(t, err)
    assert.Nil(t, history)
    assert.Contains(t, err.Error(), "unknown message role")
}
```

---

#### 1.4: SSE Writer Tests

**File:** `pkg/api/sse_test.go`

**Test Cases:**

**TestSSEWriter_WriteEvent**
```go
func TestSSEWriter_WriteEvent(t *testing.T) {
    w := httptest.NewRecorder()
    sw := NewSSEWriter(w)
    
    eventData := map[string]interface{}{
        "type": "text-delta",
        "textDelta": "Hello",
    }
    
    err := sw.WriteEvent("text-delta", eventData)
    
    assert.NoError(t, err)
    assert.Contains(t, w.Body.String(), `data: {"type":"text-delta","textDelta":"Hello"}`)
    assert.Contains(t, w.Body.String(), "\n\n") // Double newline
}
```

**TestSSEWriter_WriteError**
```go
func TestSSEWriter_WriteError(t *testing.T) {
    w := httptest.NewRecorder()
    sw := NewSSEWriter(w)
    
    err := sw.WriteError(fmt.Errorf("test error"))
    
    assert.NoError(t, err)
    assert.Contains(t, w.Body.String(), "error")
    assert.Contains(t, w.Body.String(), "test error")
}
```

---

### 2. Integration Tests

#### 2.1: End-to-End Streaming Test

**File:** `pkg/api/chat_integration_test.go`

**Test Cases:**

**TestChatStreamHandler_FullFlow**
```go
func TestChatStreamHandler_FullFlow(t *testing.T) {
    // Setup: Start test HTTP server
    // Setup: Create valid session and workspace
    
    reqBody := `{
        "messages": [
            {"id": "msg1", "role": "user", "content": "Hello"}
        ],
        "workspaceId": "test_workspace_id",
        "revisionNumber": 1,
        "role": "auto"
    }`
    
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(reqBody))
    req.Header.Set("Authorization", "Bearer valid_test_token")
    req.Header.Set("Content-Type", "application/json")
    
    w := httptest.NewRecorder()
    
    ChatStreamHandler(w, req)
    
    // Verify response
    assert.Equal(t, http.StatusOK, w.Code)
    assert.Equal(t, "text/event-stream", w.Header().Get("Content-Type"))
    
    // Verify stream contains events
    body := w.Body.String()
    assert.Contains(t, body, "data:")
    assert.Contains(t, body, "text-delta") // Or tool-call, finish, etc.
}
```

**TestChatStreamHandler_Unauthorized**
```go
func TestChatStreamHandler_Unauthorized(t *testing.T) {
    reqBody := `{
        "messages": [{"id": "msg1", "role": "user", "content": "Hello"}],
        "workspaceId": "test_workspace_id"
    }`
    
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(reqBody))
    // No Authorization header
    
    w := httptest.NewRecorder()
    
    ChatStreamHandler(w, req)
    
    assert.Equal(t, http.StatusUnauthorized, w.Code)
}
```

**TestChatStreamHandler_FeatureFlagDisabled**
```go
func TestChatStreamHandler_FeatureFlagDisabled(t *testing.T) {
    // Setup: Set ENABLE_AI_SDK_CHAT=false
    
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", nil)
    req.Header.Set("Authorization", "Bearer valid_token")
    
    w := httptest.NewRecorder()
    
    ChatStreamHandler(w, req)
    
    assert.Equal(t, http.StatusServiceUnavailable, w.Code)
    assert.Contains(t, w.Body.String(), "not enabled")
}
```

**TestChatStreamHandler_InvalidWorkspace**
```go
func TestChatStreamHandler_InvalidWorkspace(t *testing.T) {
    reqBody := `{
        "messages": [{"id": "msg1", "role": "user", "content": "Hello"}],
        "workspaceId": "nonexistent_workspace"
    }`
    
    req := httptest.NewRequest("POST", "/api/v1/chat/stream", strings.NewReader(reqBody))
    req.Header.Set("Authorization", "Bearer valid_token")
    
    w := httptest.NewRecorder()
    
    ChatStreamHandler(w, req)
    
    assert.Equal(t, http.StatusForbidden, w.Code) // Or 404, depending on implementation
}
```

**TestChatStreamHandler_ClientDisconnection**
```go
func TestChatStreamHandler_ClientDisconnection(t *testing.T) {
    // Test that handler handles client disconnection gracefully
    // This might require a more complex test setup with actual HTTP connection
    // Verify no errors are logged, no resources leaked
}
```

---

### 3. Manual Testing

#### 3.1: Setup

**Prerequisites:**
- [ ] Worker running with `ENABLE_AI_SDK_CHAT=true`
- [ ] Database accessible
- [ ] Valid session token available
- [ ] Valid workspace ID available
- [ ] `curl` or Postman available

**Start Worker:**
```bash
ENABLE_AI_SDK_CHAT=true WORKER_HTTP_PORT=8080 make run-worker
```

**Verify Server Running:**
```bash
curl http://localhost:8080/health
# Expected: "OK"
```

---

#### 3.2: Authentication Tests

**Test 1: Missing Authorization Header**
```bash
curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[],"workspaceId":"test"}'

# Expected: 401 Unauthorized
```

**Test 2: Invalid Token**
```bash
curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"messages":[],"workspaceId":"test"}'

# Expected: 401 Unauthorized
```

**Test 3: Valid Token**
```bash
# Get valid token from database or create test session
TOKEN="your_valid_token_here"

curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-request.json

# Expected: 200 OK, SSE stream starts
```

---

#### 3.3: Request Validation Tests

**Test 1: Missing Messages**
```bash
curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"test"}'

# Expected: 400 Bad Request, "messages array cannot be empty"
```

**Test 2: Missing WorkspaceID**
```bash
curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"msg1","role":"user","content":"Hello"}]}'

# Expected: 400 Bad Request, "workspaceId is required"
```

**Test 3: Invalid JSON**
```bash
curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ invalid json }'

# Expected: 400 Bad Request, "invalid JSON"
```

---

#### 3.4: Streaming Tests

**Test 1: Valid Request Streams**
```bash
# Create test-request.json:
cat > test-request.json << EOF
{
  "messages": [
    {"id": "msg1", "role": "user", "content": "Hello, how are you?"}
  ],
  "workspaceId": "your_workspace_id",
  "revisionNumber": 1,
  "role": "auto"
}
EOF

curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-request.json \
  --no-buffer

# Expected: SSE stream with text-delta events, then finish event
```

**Test 2: Verify SSE Format**
```bash
# Stream should contain lines like:
# data: {"type":"text-delta","textDelta":"Hello"}
# data: {"type":"text-delta","textDelta":" there"}
# data: {"type":"finish","finishReason":"stop"}
```

**Test 3: Tool Calls (if applicable)**
```bash
# If tool calls are expected, verify tool-call and tool-result events appear
# data: {"type":"tool-call","toolCallId":"call_123","toolName":"get_weather","args":{}}
# data: {"type":"tool-result","toolCallId":"call_123","result":{...}}
```

---

#### 3.5: Feature Flag Tests

**Test 1: Flag Disabled**
```bash
# Start worker with flag disabled
ENABLE_AI_SDK_CHAT=false make run-worker

curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-request.json

# Expected: 503 Service Unavailable, "not enabled"
```

**Test 2: Flag Enabled**
```bash
# Start worker with flag enabled
ENABLE_AI_SDK_CHAT=true make run-worker

curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-request.json

# Expected: 200 OK, stream works
```

---

### 4. Performance Tests

#### 4.1: Response Time

**Test: Endpoint Response Time**
```go
func TestChatStreamHandler_ResponseTime(t *testing.T) {
    start := time.Now()
    
    // Send request
    // ... (setup request)
    
    // Wait for first event
    // ... (read first SSE event)
    
    elapsed := time.Since(start)
    
    assert.Less(t, elapsed, 100*time.Millisecond, "Endpoint should respond within 100ms")
}
```

#### 4.2: Streaming Latency

**Test: Streaming Latency**
```go
func TestChatStreamHandler_StreamingLatency(t *testing.T) {
    // Measure time from LLM token generation to SSE event
    // Should be < 50ms
}
```

#### 4.3: Concurrent Streams

**Test: Concurrent Streams**
```go
func TestChatStreamHandler_ConcurrentStreams(t *testing.T) {
    var wg sync.WaitGroup
    numStreams := 10
    
    for i := 0; i < numStreams; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            // Send request and verify stream
        }()
    }
    
    wg.Wait()
    // Verify all streams completed successfully
}
```

---

## Acceptance Criteria

**Feature is complete when:**

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing confirms:
  - [ ] Authentication works correctly
  - [ ] Request validation works correctly
  - [ ] Streaming works correctly
  - [ ] Feature flag works correctly
  - [ ] Error handling works correctly
- [ ] Performance targets met:
  - [ ] Endpoint responds within 100ms
  - [ ] Streaming latency < 50ms
  - [ ] Handles 10+ concurrent streams
- [ ] Test coverage > 80%
- [ ] No critical bugs
- [ ] Documentation updated

---

## Test Data

### Sample Request
```json
{
  "messages": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "Hello, how are you?",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "content": "I'm doing well!",
      "createdAt": "2025-01-01T00:01:00Z"
    }
  ],
  "workspaceId": "ws_abc123",
  "revisionNumber": 1,
  "role": "auto"
}
```

### Expected SSE Stream
```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"text-delta","textDelta":" there"}

data: {"type":"text-delta","textDelta":"!"}

data: {"type":"finish","finishReason":"stop"}
```

---

## Running Tests

### Unit Tests
```bash
go test ./pkg/api/... -v
```

### Integration Tests
```bash
go test ./pkg/api/... -tags=integration -v
```

### All Tests
```bash
go test ./pkg/api/... -v -tags=integration
```

---

## Test Coverage

**Target:** > 80% coverage

**Check Coverage:**
```bash
go test ./pkg/api/... -cover
```

**Generate Coverage Report:**
```bash
go test ./pkg/api/... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

---

*Remember: Good tests catch bugs before users do. Test thoroughly, test early, test often!*

