# PR#4: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (~45 min)
- [ ] Verify PR#3 is complete (AI SDK Streaming Adapter)
- [ ] Prerequisites verified:
  - [ ] Go worker codebase accessible
  - [ ] Database connection works
  - [ ] LLM API keys configured
- [ ] Git branch created
  ```bash
  git checkout -b feat/ai-sdk-chat-endpoint
  ```
- [ ] Review existing code:
  - [ ] `pkg/listener/conversational.go` (understand current flow)
  - [ ] `pkg/llm/conversational.go` (understand LLM integration)
  - [ ] `cmd/run.go` (understand worker startup)
  - [ ] `pkg/param/param.go` (understand config structure)

---

## Phase 1: HTTP Server Setup (1-2 hours)

### 1.1: Add HTTP Server to Worker (30 minutes)

#### Create HTTP Server Function
- [ ] Create `pkg/api/server.go` (new file)
- [ ] Add HTTP server setup function
  ```go
  // pkg/api/server.go
  package api

  import (
      "context"
      "fmt"
      "net/http"
      "time"

      "github.com/replicatedhq/chartsmith/pkg/logger"
      "go.uber.org/zap"
  )

  func StartHTTPServer(ctx context.Context, port int) error {
      mux := http.NewServeMux()
      
      // Register routes
      registerRoutes(mux)
      
      server := &http.Server{
          Addr:         fmt.Sprintf(":%d", port),
          Handler:      mux,
          ReadTimeout:  15 * time.Second,
          WriteTimeout: 60 * time.Second, // Long timeout for streaming
          IdleTimeout:  120 * time.Second,
      }

      // Start server in goroutine
      go func() {
          logger.Info("Starting HTTP server", zap.Int("port", port))
          if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
              logger.Error("HTTP server error", zap.Error(err))
          }
      }()

      // Graceful shutdown
      <-ctx.Done()
      logger.Info("Shutting down HTTP server")
      shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
      defer cancel()
      return server.Shutdown(shutdownCtx)
  }
  ```

#### Update Worker Startup
- [ ] Modify `cmd/run.go` to start HTTP server
  ```go
  // In runWorker function, after listener.StartListeners:
  
  // Start HTTP server if AI SDK chat is enabled
  if param.Get().EnableAISDKChat {
      go func() {
          port := 8080 // Default, or from env var
          if err := api.StartHTTPServer(ctx, port); err != nil {
              logger.Error("Failed to start HTTP server", zap.Error(err))
          }
      }()
  }
  ```

**Checkpoint:** HTTP server starts alongside LISTEN/NOTIFY ✓

**Commit:** `feat(api): add HTTP server to worker`

---

### 1.2: Route Registration (20 minutes)

#### Create Route Registry
- [ ] Create `pkg/api/routes.go` (new file)
- [ ] Add route registration function
  ```go
  // pkg/api/routes.go
  package api

  import "net/http"

  func registerRoutes(mux *http.ServeMux) {
      // Chat streaming endpoint
      mux.HandleFunc("/api/v1/chat/stream", ChatStreamHandler)
      
      // Health check endpoint (optional but useful)
      mux.HandleFunc("/health", HealthHandler)
  }

  func HealthHandler(w http.ResponseWriter, r *http.Request) {
      w.WriteHeader(http.StatusOK)
      w.Write([]byte("OK"))
  }
  ```

**Checkpoint:** Routes registered ✓

**Commit:** `feat(api): register chat streaming route`

---

### 1.3: Feature Flag (10 minutes)

#### Add Feature Flag to Params
- [ ] Update `pkg/param/param.go`
  ```go
  // Add to Params struct:
  type Params struct {
      // ... existing fields ...
      
      // EnableAISDKChat enables the AI SDK chat HTTP endpoint
      EnableAISDKChat bool `env:"ENABLE_AI_SDK_CHAT" default:"false"`
      
      // WorkerHTTPPort is the port for the HTTP server
      WorkerHTTPPort int `env:"WORKER_HTTP_PORT" default:"8080"`
  }
  ```

**Checkpoint:** Feature flag available ✓

**Commit:** `feat(config): add ENABLE_AI_SDK_CHAT feature flag`

---

## Phase 2: Authentication (1 hour)

### 2.1: JWT Validation (40 minutes)

#### Create Authentication Module
- [ ] Create `pkg/api/auth.go` (new file)
- [ ] Add token extraction function
  ```go
  // pkg/api/auth.go
  package api

  import (
      "context"
      "fmt"
      "net/http"
      "strings"
      
      "github.com/replicatedhq/chartsmith/pkg/persistence"
      "github.com/replicatedhq/chartsmith/pkg/workspace"
  )

  // ExtractBearerToken extracts the Bearer token from Authorization header
  func ExtractBearerToken(r *http.Request) (string, error) {
      authHeader := r.Header.Get("Authorization")
      if authHeader == "" {
          return "", fmt.Errorf("missing authorization header")
      }

      if !strings.HasPrefix(authHeader, "Bearer ") {
          return "", fmt.Errorf("invalid authorization format")
      }

      return strings.TrimPrefix(authHeader, "Bearer "), nil
  }
  ```

#### Add Session Validation
- [ ] Add session lookup function
  ```go
  // Query database for session
  func ValidateSession(ctx context.Context, token string) (string, error) {
      conn := persistence.MustGetPooledPostgresSession()
      defer conn.Release()

      // Query session table
      // SELECT user_id FROM session WHERE id = $1 AND expires_at > NOW()
      // Return user_id if found, error if not
      
      // Implementation depends on your session schema
      // Example:
      var userID string
      err := conn.QueryRow(ctx, 
          "SELECT user_id FROM session WHERE id = $1 AND expires_at > NOW()",
          token,
      ).Scan(&userID)
      
      if err != nil {
          return "", fmt.Errorf("invalid or expired session: %w", err)
      }
      
      return userID, nil
  }
  ```

#### Add Authentication Middleware
- [ ] Create middleware function
  ```go
  // AuthenticateRequest validates the request and returns user ID
  func AuthenticateRequest(r *http.Request) (string, error) {
      token, err := ExtractBearerToken(r)
      if err != nil {
          return "", err
      }

      userID, err := ValidateSession(r.Context(), token)
      if err != nil {
          return "", err
      }

      return userID, nil
  }
  ```

**Checkpoint:** Authentication functions implemented ✓

**Commit:** `feat(api): add JWT authentication`

---

### 2.2: Authorization (20 minutes)

#### Add Workspace Access Check
- [ ] Add workspace authorization function
  ```go
  // VerifyWorkspaceAccess checks if user has access to workspace
  func VerifyWorkspaceAccess(ctx context.Context, userID, workspaceID string) (*workspacetypes.Workspace, error) {
      // Get workspace
      w, err := workspace.GetWorkspace(ctx, workspaceID)
      if err != nil {
          return nil, fmt.Errorf("workspace not found: %w", err)
      }

      // Check if user has access (query workspace_user table or similar)
      hasAccess, err := workspace.UserHasAccessToWorkspace(ctx, userID, workspaceID)
      if err != nil {
          return nil, fmt.Errorf("failed to check access: %w", err)
      }

      if !hasAccess {
          return nil, fmt.Errorf("user does not have access to workspace")
      }

      return w, nil
  }
  ```

**Checkpoint:** Authorization implemented ✓

**Commit:** `feat(api): add workspace access verification`

---

## Phase 3: Request Handling (1-2 hours)

### 3.1: Request Types (20 minutes)

#### Define Request/Response Types
- [ ] Create `pkg/api/types.go` (new file)
- [ ] Add AI SDK message types
  ```go
  // pkg/api/types.go
  package api

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

  // ChatStreamRequest is the request body
  type ChatStreamRequest struct {
      Messages       []AISDKMessage `json:"messages"`
      WorkspaceID    string         `json:"workspaceId"`
      RevisionNumber int            `json:"revisionNumber"`
      Role           string         `json:"role"` // "auto", "developer", "operator"
  }
  ```

**Checkpoint:** Types defined ✓

**Commit:** `feat(api): add request/response types`

---

### 3.2: Request Parsing (20 minutes)

#### Add Request Validation
- [ ] Create request parsing function in `pkg/api/chat.go`
  ```go
  // pkg/api/chat.go
  package api

  import (
      "encoding/json"
      "fmt"
      "net/http"
  )

  func parseChatRequest(r *http.Request) (*ChatStreamRequest, error) {
      var req ChatStreamRequest
      if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
          return nil, fmt.Errorf("invalid JSON: %w", err)
      }

      // Validate required fields
      if req.WorkspaceID == "" {
          return nil, fmt.Errorf("workspaceId is required")
      }

      if len(req.Messages) == 0 {
          return nil, fmt.Errorf("messages array cannot be empty")
      }

      // Validate message format
      for i, msg := range req.Messages {
          if msg.Role == "" {
              return nil, fmt.Errorf("message %d missing role", i)
          }
          if msg.Content == "" && len(msg.ToolCalls) == 0 {
              return nil, fmt.Errorf("message %d missing content or tool calls", i)
          }
      }

      return &req, nil
  }
  ```

**Checkpoint:** Request parsing implemented ✓

**Commit:** `feat(api): add request parsing and validation`

---

### 3.3: Message Format Conversion (30 minutes)

#### Create Conversion Functions
- [ ] Add conversion function in `pkg/api/chat.go`
  ```go
  import workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"

  // convertAISDKMessagesToChatHistory converts AI SDK messages to internal format
  func convertAISDKMessagesToChatHistory(messages []AISDKMessage) ([]workspacetypes.Chat, error) {
      var history []workspacetypes.Chat

      for _, msg := range messages {
          chat := workspacetypes.Chat{
              ID: msg.ID,
          }

          switch msg.Role {
          case "user":
              chat.Prompt = msg.Content
              chat.SentBy = "user"
          case "assistant":
              chat.Response = msg.Content
              chat.SentBy = "assistant"
          case "system":
              // System messages are typically not stored in chat history
              continue
          default:
              return nil, fmt.Errorf("unknown message role: %s", msg.Role)
          }

          // Parse createdAt if provided
          if msg.CreatedAt != "" {
              // Parse timestamp and set chat.CreatedAt
          }

          history = append(history, chat)
      }

      return history, nil
  }
  ```

**Checkpoint:** Message conversion implemented ✓

**Commit:** `feat(api): add AI SDK to internal message conversion`

---

### 3.4: Integration with Conversational Chat (30 minutes)

#### Create Streaming Function
- [ ] Add streaming integration function
  ```go
  // streamConversationalChat streams chat using AI SDK adapter
  func streamConversationalChat(
      ctx context.Context,
      streamWriter *SSEWriter,
      w *workspacetypes.Workspace,
      history []workspacetypes.Chat,
      prompt string,
      role string,
  ) error {
      // Create temporary chat message
      chatMessage := &workspacetypes.Chat{
          WorkspaceID: w.ID,
          Prompt:      prompt,
          // Set role-based system prompt
      }

      // Call LLM with AI SDK adapter (from PR#3)
      // This function should be in pkg/llm/ and use the adapter
      if err := llm.StreamConversationalChatToAISDK(
          ctx,
          streamWriter,
          w,
          history,
          chatMessage,
          role,
      ); err != nil {
          return fmt.Errorf("failed to stream chat: %w", err)
      }

      return nil
  }
  ```

**Checkpoint:** Integration with conversational chat complete ✓

**Commit:** `feat(api): integrate with conversational chat streaming`

---

## Phase 4: Streaming Response (1 hour)

### 4.1: SSE Writer (30 minutes)

#### Create SSE Writer
- [ ] Create `pkg/api/sse.go` (new file)
- [ ] Implement SSE writer
  ```go
  // pkg/api/sse.go
  package api

  import (
      "encoding/json"
      "fmt"
      "io"
      "net/http"
  )

  type SSEWriter struct {
      w http.ResponseWriter
      flusher http.Flusher
  }

  func NewSSEWriter(w http.ResponseWriter) *SSEWriter {
      flusher, ok := w.(http.Flusher)
      if !ok {
          // If flusher not available, create a no-op flusher
          flusher = &noOpFlusher{}
      }

      return &SSEWriter{
          w:       w,
          flusher: flusher,
      }
  }

  func (sw *SSEWriter) WriteEvent(eventType string, data interface{}) error {
      // Marshal data to JSON
      jsonData, err := json.Marshal(data)
      if err != nil {
          return fmt.Errorf("failed to marshal event: %w", err)
      }

      // Write SSE format: "data: {json}\n\n"
      _, err = fmt.Fprintf(sw.w, "data: %s\n\n", jsonData)
      if err != nil {
          return fmt.Errorf("failed to write event: %w", err)
      }

      // Flush to send immediately
      sw.flusher.Flush()
      return nil
  }

  func (sw *SSEWriter) WriteError(err error) error {
      errorData := map[string]interface{}{
          "type":    "error",
          "message": err.Error(),
      }
      return sw.WriteEvent("error", errorData)
  }

  type noOpFlusher struct{}

  func (n *noOpFlusher) Flush() {}
  ```

**Checkpoint:** SSE writer implemented ✓

**Commit:** `feat(api): add SSE writer for streaming`

---

### 4.2: Main Handler (30 minutes)

#### Implement Chat Stream Handler
- [ ] Complete `ChatStreamHandler` in `pkg/api/chat.go`
  ```go
  func ChatStreamHandler(w http.ResponseWriter, r *http.Request) {
      ctx := r.Context()

      // Check feature flag
      if !param.Get().EnableAISDKChat {
          http.Error(w, "AI SDK chat endpoint not enabled", http.StatusServiceUnavailable)
          return
      }

      // Only allow POST
      if r.Method != http.MethodPost {
          http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
          return
      }

      // Authenticate
      userID, err := AuthenticateRequest(r)
      if err != nil {
          http.Error(w, "Unauthorized", http.StatusUnauthorized)
          return
      }

      // Parse request
      req, err := parseChatRequest(r)
      if err != nil {
          http.Error(w, fmt.Sprintf("Bad request: %v", err), http.StatusBadRequest)
          return
      }

      // Verify workspace access
      workspace, err := VerifyWorkspaceAccess(ctx, userID, req.WorkspaceID)
      if err != nil {
          http.Error(w, "Forbidden", http.StatusForbidden)
          return
      }

      // Convert messages
      history, err := convertAISDKMessagesToChatHistory(req.Messages)
      if err != nil {
          http.Error(w, fmt.Sprintf("Invalid messages: %v", err), http.StatusBadRequest)
          return
      }

      // Extract prompt from last user message
      var prompt string
      for i := len(req.Messages) - 1; i >= 0; i-- {
          if req.Messages[i].Role == "user" {
              prompt = req.Messages[i].Content
              break
          }
      }

      // Set up SSE streaming
      w.Header().Set("Content-Type", "text/event-stream")
      w.Header().Set("Cache-Control", "no-cache")
      w.Header().Set("Connection", "keep-alive")
      w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

      streamWriter := NewSSEWriter(w)

      // Stream chat response
      if err := streamConversationalChat(
          ctx,
          streamWriter,
          workspace,
          history,
          prompt,
          req.Role,
      ); err != nil {
          streamWriter.WriteError(err)
          return
      }
  }
  ```

**Checkpoint:** Main handler complete ✓

**Commit:** `feat(api): implement chat stream handler`

---

## Phase 5: Testing (1 hour)

### 5.1: Unit Tests (30 minutes)

#### Authentication Tests
- [ ] Create `pkg/api/auth_test.go`
- [ ] Test `ExtractBearerToken`:
  - [ ] Valid Bearer token → extracts correctly
  - [ ] Missing header → returns error
  - [ ] Invalid format → returns error
- [ ] Test `ValidateSession`:
  - [ ] Valid token → returns user ID
  - [ ] Invalid token → returns error
  - [ ] Expired token → returns error

#### Request Parsing Tests
- [ ] Create `pkg/api/chat_test.go`
- [ ] Test `parseChatRequest`:
  - [ ] Valid request → parses correctly
  - [ ] Missing messages → returns error
  - [ ] Missing workspaceId → returns error
  - [ ] Invalid JSON → returns error

#### Message Conversion Tests
- [ ] Test `convertAISDKMessagesToChatHistory`:
  - [ ] User message → converts correctly
  - [ ] Assistant message → converts correctly
  - [ ] Multiple messages → converts in order
  - [ ] System message → skipped

**Checkpoint:** Unit tests passing ✓

**Commit:** `test(api): add unit tests for chat endpoint`

---

### 5.2: Integration Tests (30 minutes)

#### End-to-End Test
- [ ] Create integration test file
- [ ] Test full flow:
  - [ ] Start HTTP server
  - [ ] Send POST request with valid token
  - [ ] Verify SSE stream starts
  - [ ] Verify events received
  - [ ] Verify stream completes

#### Error Scenario Tests
- [ ] Test unauthorized request → 401
- [ ] Test invalid workspace → 403
- [ ] Test feature flag disabled → 503
- [ ] Test client disconnection → graceful shutdown

**Checkpoint:** Integration tests passing ✓

**Commit:** `test(api): add integration tests for chat streaming`

---

## Manual Testing Checklist

### Setup
- [ ] Start worker with `ENABLE_AI_SDK_CHAT=true`
- [ ] Verify HTTP server starts on port 8080
- [ ] Verify health endpoint works: `curl http://localhost:8080/health`

### Authentication
- [ ] Request without token → 401
  ```bash
  curl -X POST http://localhost:8080/api/v1/chat/stream
  ```
- [ ] Request with invalid token → 401
  ```bash
  curl -X POST http://localhost:8080/api/v1/chat/stream \
    -H "Authorization: Bearer invalid_token"
  ```
- [ ] Request with valid token → 200 (stream starts)
  ```bash
  curl -X POST http://localhost:8080/api/v1/chat/stream \
    -H "Authorization: Bearer <valid_token>" \
    -H "Content-Type: application/json" \
    -d '{"messages":[...],"workspaceId":"..."}'
  ```

### Streaming
- [ ] Send valid request → stream starts
- [ ] Verify text-delta events received
- [ ] Verify tool-call events received (if applicable)
- [ ] Verify finish event received
- [ ] Verify stream closes correctly

### Feature Flag
- [ ] Start worker with flag disabled → endpoint returns 503
- [ ] Start worker with flag enabled → endpoint works

**Checkpoint:** Manual testing complete ✓

---

## Documentation Phase (30 minutes)

- [ ] Add code comments to exported functions
- [ ] Document authentication flow
- [ ] Document request/response format
- [ ] Update ARCHITECTURE.md if needed
- [ ] Add example curl commands to README

**Commit:** `docs(api): add documentation for chat endpoint`

---

## Completion Checklist

- [ ] All phases complete
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing complete
- [ ] Feature flag works correctly
- [ ] Error handling works correctly
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Ready for PR#5 (Next.js API Route Proxy)

---

## Notes & Deviations

**Record any deviations from the plan here:**

- [ ] Deviation 1: [Description and reason]
- [ ] Deviation 2: [Description and reason]

---

**Status:** Ready to start implementation! 🚀

