# PR#4: New Chat Streaming Endpoint

**Estimated Time:** 4-6 hours  
**Complexity:** MEDIUM  
**Dependencies:** PR#3 (AI SDK Streaming Adapter must be complete)  
**Success Criteria:** G2, G3 (Backend streams AI SDK format, maintains chat functionality)

---

## Overview

### What We're Building

This PR creates a new HTTP endpoint in the Go worker that accepts chat requests and streams responses using the Vercel AI SDK Data Stream Protocol. This endpoint will:

1. **Accept HTTP POST requests** with AI SDK message format
2. **Authenticate requests** using existing session/JWT mechanisms
3. **Stream responses** in AI SDK Data Stream Protocol format
4. **Integrate with existing conversational chat logic** without modifying core LLM functionality
5. **Respect feature flags** to enable safe rollout

### Why It Matters

This endpoint is the bridge between the frontend `useChat` hook (PR#6) and the Go backend LLM orchestration. It enables:

- **Standard protocol** - Frontend can use industry-standard `useChat` hook
- **Direct streaming** - HTTP SSE streaming replaces WebSocket for chat (simpler, more standard)
- **Backward compatibility** - Existing Centrifugo-based chat continues to work via feature flag
- **Foundation for future** - Enables easy provider switching and better error handling

### Success in One Sentence

"This PR is successful when a new HTTP endpoint streams AI SDK formatted responses, authenticates correctly, integrates with existing chat logic, and all tests pass."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Endpoint Path
**Options Considered:**
1. `/api/v1/chat/stream` - RESTful, versioned, clear purpose
2. `/api/chat` - Simpler, but no versioning
3. `/chat/stream` - Too generic, conflicts with frontend routes

**Chosen:** `/api/v1/chat/stream`

**Rationale:**
- RESTful convention (`/api/v1/` prefix)
- Versioned for future API changes
- Clear purpose (`/chat/stream` indicates streaming chat)
- Consistent with common API patterns

**Trade-offs:**
- Gain: Clear, versioned, professional API structure
- Lose: Slightly longer path (minimal impact)

#### Decision 2: HTTP Server Setup
**Options Considered:**
1. Add HTTP server to existing worker - Single process, simpler deployment
2. Separate HTTP service - More scalable, but adds complexity
3. Use existing Next.js API routes only - Can't access Go worker directly

**Chosen:** Add HTTP server to existing worker

**Rationale:**
- Current worker is single-process, adding HTTP server is straightforward
- No need for separate service (simpler deployment)
- Worker already has all dependencies (database, LLM, etc.)
- Can reuse existing connection pools and context

**Trade-offs:**
- Gain: Simplicity, no new services, reuses existing infrastructure
- Lose: Worker must handle both LISTEN/NOTIFY and HTTP (acceptable)

#### Decision 3: Authentication Strategy
**Options Considered:**
1. JWT token in Authorization header - Standard, stateless
2. Session cookie - Requires cookie parsing in Go
3. API key - Too simple, doesn't identify users

**Chosen:** JWT token in Authorization header (`Bearer <token>`)

**Rationale:**
- Frontend already uses JWT tokens
- Standard HTTP authentication pattern
- Stateless (no session storage needed)
- Can reuse existing JWT validation logic if available, or validate via database

**Trade-offs:**
- Gain: Standard pattern, stateless, easy to implement
- Lose: Must validate JWT in Go (may need to query database for session)

#### Decision 4: Request/Response Format
**Options Considered:**
1. AI SDK message array - Standard format, matches frontend
2. Custom format - More control, but non-standard
3. Existing chat message format - Familiar, but doesn't match AI SDK

**Chosen:** AI SDK message array

**Rationale:**
- Matches what `useChat` hook expects
- Standard format (AI SDK spec)
- Easy to convert to/from existing database format
- Future-proof for provider switching

**Trade-offs:**
- Gain: Standard format, matches frontend, future-proof
- Lose: Must convert from AI SDK format to internal format (adapter layer)

#### Decision 5: Feature Flag Integration
**Options Considered:**
1. Environment variable check - Simple, requires restart
2. Database flag - Can toggle without restart, but adds complexity
3. Request header - Flexible, but requires frontend changes

**Chosen:** Environment variable (`ENABLE_AI_SDK_CHAT`)

**Rationale:**
- Simple and standard
- Consistent with other feature flags
- No need for runtime toggling (we'll remove flag after migration)
- Easy to test both paths

**Trade-offs:**
- Gain: Simplicity, no runtime overhead
- Lose: Requires restart to toggle (acceptable for this use case)

### Data Model

**No database schema changes** - This PR only adds an HTTP endpoint. The existing `workspace_chat` table continues to be used.

**Message Format Conversion:**
- **Input:** AI SDK message array (from frontend)
- **Internal:** Existing `workspacetypes.Chat` format (for database)
- **Output:** AI SDK Data Stream Protocol (to frontend)

### API Design

#### Endpoint: `POST /api/v1/chat/stream`

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "messages": [
    {
      "id": "msg_123",
      "role": "user",
      "content": "Hello, how are you?",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "msg_124",
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

**Response:**
- **Status:** `200 OK`
- **Content-Type:** `text/event-stream`
- **Body:** AI SDK Data Stream Protocol (SSE format)

**Example Stream:**
```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"text-delta","textDelta":" there"}

data: {"type":"tool-call","toolCallId":"call_123","toolName":"get_weather","args":{}}

data: {"type":"tool-result","toolCallId":"call_123","result":{"temp":72}}

data: {"type":"finish","finishReason":"stop"}
```

**Error Responses:**

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

**400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Invalid request format: missing messages array"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to process chat request"
}
```

### Component Hierarchy

```
HTTP Request
    │
    ▼
POST /api/v1/chat/stream
    │
    ├─► Authentication Middleware
    │       │
    │       └─► Validate JWT Token
    │
    ├─► Request Validation
    │       │
    │       └─► Parse & Validate Message Array
    │
    ├─► Feature Flag Check
    │       │
    │       └─► ENABLE_AI_SDK_CHAT env var
    │
    ├─► Message Format Conversion
    │       │
    │       └─► AI SDK → Internal Format
    │
    ├─► Conversational Chat Logic
    │       │
    │       ├─► Get Workspace
    │       ├─► Get Chat History
    │       ├─► Build System Prompt
    │       ├─► Select Relevant Files
    │       └─► Call LLM (via adapter)
    │
    └─► Stream Response
            │
            └─► AI SDK Data Stream Protocol
```

---

## Implementation Details

### File Structure

**New Files:**
```
pkg/api/
├── chat.go (~200 lines) - HTTP handler for chat endpoint
├── auth.go (~100 lines) - Authentication middleware/helpers
└── types.go (~150 lines) - Request/response types

pkg/param/
└── param.go (+10 lines) - Add EnableAISDKChat flag
```

**Modified Files:**
```
cmd/run.go (+30 lines) - Start HTTP server alongside LISTEN/NOTIFY
pkg/listener/conversational.go (+50 lines) - Add conditional path for AI SDK streaming
pkg/llm/conversational.go (+20 lines) - Export helper functions if needed
```

### Key Implementation Steps

#### Phase 1: HTTP Server Setup (1-2 hours)

**Step 1.1: Add HTTP Server to Worker**
- Create HTTP server in `cmd/run.go`
- Start server on configurable port (default: 8080)
- Run alongside existing LISTEN/NOTIFY listeners
- Graceful shutdown handling

**Step 1.2: Route Registration**
- Create route registry in `pkg/api/`
- Register `/api/v1/chat/stream` endpoint
- Set up middleware chain (auth, validation, logging)

**Step 1.3: Feature Flag**
- Add `EnableAISDKChat` to `pkg/param/param.go`
- Read from `ENABLE_AI_SDK_CHAT` environment variable
- Default to `false` (old behavior)

#### Phase 2: Authentication (1 hour)

**Step 2.1: JWT Validation**
- Extract token from `Authorization: Bearer <token>` header
- Validate token (check signature, expiration)
- Query database for session if needed
- Extract user ID and workspace access

**Step 2.2: Authorization**
- Verify user has access to requested workspace
- Check workspace exists
- Return 401/403 if unauthorized

#### Phase 3: Request Handling (1-2 hours)

**Step 3.1: Request Parsing**
- Parse JSON request body
- Validate message array format
- Validate required fields (workspaceId, messages)
- Convert AI SDK messages to internal format

**Step 3.2: Integration with Conversational Chat**
- Call existing `llm.ConversationalChatMessage` logic
- Use AI SDK adapter from PR#3 for streaming
- Handle errors gracefully
- Return appropriate HTTP status codes

#### Phase 4: Streaming Response (1 hour)

**Step 4.1: SSE Setup**
- Set response headers (`Content-Type: text/event-stream`)
- Set up streaming writer
- Handle client disconnection

**Step 4.2: Stream AI SDK Format**
- Use adapter from PR#3 to convert Anthropic stream to AI SDK format
- Write SSE events to response
- Handle stream completion
- Handle errors during streaming

### Code Examples

#### Example 1: HTTP Handler Structure

```go
// pkg/api/chat.go
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"io"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type ChatStreamRequest struct {
	Messages       []AISDKMessage `json:"messages"`
	WorkspaceID    string         `json:"workspaceId"`
	RevisionNumber int            `json:"revisionNumber"`
	Role           string         `json:"role"` // "auto", "developer", "operator"
}

func ChatStreamHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check feature flag
	if !param.Get().EnableAISDKChat {
		http.Error(w, "AI SDK chat endpoint not enabled", http.StatusServiceUnavailable)
		return
	}

	// Authenticate
	userID, err := authenticateRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request
	var req ChatStreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	// Validate workspace access
	w, err := workspace.GetWorkspace(ctx, req.WorkspaceID)
	if err != nil {
		http.Error(w, "Workspace not found", http.StatusNotFound)
		return
	}

	// Convert AI SDK messages to internal format
	chatHistory, err := convertAISDKMessagesToChatHistory(req.Messages)
	if err != nil {
		http.Error(w, "Invalid message format", http.StatusBadRequest)
		return
	}

	// Set up SSE streaming
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Create streaming writer
	streamWriter := NewSSEWriter(w)

	// Call conversational chat with AI SDK adapter
	if err := streamConversationalChat(ctx, streamWriter, w, chatHistory, req); err != nil {
		// Error already written to stream or response
		return
	}
}
```

#### Example 2: Authentication Helper

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

func authenticateRequest(r *http.Request) (string, error) {
	// Extract Bearer token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", fmt.Errorf("missing authorization header")
	}

	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", fmt.Errorf("invalid authorization format")
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")

	// Validate token and get user ID
	// Option 1: Validate JWT signature and extract user ID
	// Option 2: Query database for session
	userID, err := validateTokenAndGetUserID(r.Context(), token)
	if err != nil {
		return "", fmt.Errorf("invalid token: %w", err)
	}

	return userID, nil
}

func validateTokenAndGetUserID(ctx context.Context, token string) (string, error) {
	// Query database for session
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Query session table
	// Return user_id if session is valid
	// Implementation depends on existing session schema
	// ...
}
```

#### Example 3: Message Format Conversion

```go
// pkg/api/types.go
package api

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type AISDKMessage struct {
	ID        string                 `json:"id"`
	Role      string                 `json:"role"` // "user", "assistant", "system"
	Content   string                 `json:"content"`
	CreatedAt string                 `json:"createdAt,omitempty"`
	ToolCalls []AISDKToolInvocation  `json:"toolInvocations,omitempty"`
}

func convertAISDKMessagesToChatHistory(messages []AISDKMessage) ([]workspacetypes.Chat, error) {
	var history []workspacetypes.Chat

	for _, msg := range messages {
		// Convert AI SDK message to internal Chat format
		chat := workspacetypes.Chat{
			ID:      msg.ID,
			Prompt:  msg.Content, // For user messages
			Response: msg.Content,  // For assistant messages
			// ... map other fields
		}

		history = append(history, chat)
	}

	return history, nil
}
```

#### Example 4: Streaming Integration

```go
// pkg/api/chat.go (continued)
func streamConversationalChat(
	ctx context.Context,
	streamWriter *SSEWriter,
	w *workspacetypes.Workspace,
	history []workspacetypes.Chat,
	prompt string,
) error {
	// Create a temporary chat message for the request
	chatMessage := &workspacetypes.Chat{
		WorkspaceID: w.ID,
		Prompt:      prompt,
		// ... other fields
	}

	// Call existing conversational chat logic, but with AI SDK adapter
	// This uses the adapter from PR#3
	if err := llm.StreamConversationalChatToAISDK(
		ctx,
		streamWriter,
		w,
		history,
		chatMessage,
	); err != nil {
		// Write error to stream
		streamWriter.WriteError(err)
		return err
	}

	return nil
}
```

---

## Testing Strategy

### Test Categories

#### Unit Tests

**Authentication Tests:**
- Valid JWT token → returns user ID
- Invalid JWT token → returns error
- Missing Authorization header → returns 401
- Expired token → returns 401
- Invalid token format → returns 401

**Request Validation Tests:**
- Valid request → parses correctly
- Missing messages array → returns 400
- Invalid message format → returns 400
- Missing workspaceId → returns 400
- Invalid workspaceId → returns 404

**Message Conversion Tests:**
- AI SDK user message → converts to internal format
- AI SDK assistant message → converts to internal format
- Multiple messages → converts in order
- Tool calls → preserved correctly

#### Integration Tests

**End-to-End Streaming:**
- Send POST request with valid messages
- Verify SSE stream starts
- Verify text-delta events received
- Verify tool-call events received
- Verify finish event received
- Verify stream closes correctly

**Error Scenarios:**
- LLM API failure → error event in stream
- Client disconnects → stream closes gracefully
- Invalid workspace → 404 response
- Unauthorized user → 401 response

**Feature Flag:**
- Flag disabled → returns 503 Service Unavailable
- Flag enabled → processes request normally

#### Manual Testing

**Happy Path:**
1. Start worker with `ENABLE_AI_SDK_CHAT=true`
2. Send POST request with curl/Postman
3. Verify streaming response
4. Verify response format matches AI SDK spec

**Authentication:**
1. Request without token → 401
2. Request with invalid token → 401
3. Request with valid token → 200

**Concurrent Requests:**
1. Send multiple requests simultaneously
2. Verify each streams independently
3. Verify no interference between streams

---

## Success Criteria

**Feature is complete when:**
- [ ] HTTP endpoint responds to POST `/api/v1/chat/stream`
- [ ] Endpoint authenticates requests correctly
- [ ] Endpoint streams AI SDK Data Stream Protocol format
- [ ] Endpoint integrates with existing conversational chat logic
- [ ] Feature flag controls activation
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing confirms streaming works
- [ ] Error handling works correctly
- [ ] Documentation updated

**Performance Targets:**
- Endpoint responds within 100ms (before streaming starts)
- Streaming latency < 50ms (time from LLM token to SSE event)
- Handles 10+ concurrent streams without degradation

**Quality Gates:**
- Zero critical bugs
- Test coverage > 80%
- No memory leaks in streaming
- Graceful error handling

---

## Risk Assessment

### Risk 1: HTTP Server Conflicts with LISTEN/NOTIFY
**Likelihood:** LOW  
**Impact:** HIGH  
**Mitigation:**
- HTTP server runs on separate goroutine
- No shared state between HTTP and LISTEN/NOTIFY
- Test both paths simultaneously
- Monitor for resource contention

**Status:** 🟢 LOW RISK

### Risk 2: Authentication Complexity
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Reuse existing session validation logic if possible
- Query database for session validation
- Add comprehensive auth tests
- Document auth flow clearly

**Status:** 🟡 MEDIUM RISK

### Risk 3: Message Format Conversion Errors
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Create comprehensive conversion tests
- Handle edge cases (missing fields, null values)
- Validate conversion both directions
- Add logging for conversion issues

**Status:** 🟡 MEDIUM RISK

### Risk 4: Streaming Performance
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:**
- Use efficient streaming (no buffering)
- Test with large responses
- Monitor memory usage
- Benchmark before/after

**Status:** 🟢 LOW RISK

### Risk 5: Feature Flag Rollback Issues
**Likelihood:** LOW  
**Impact:** LOW  
**Mitigation:**
- Feature flag defaults to false (old behavior)
- Test both paths thoroughly
- Document rollback procedure
- Monitor feature flag usage

**Status:** 🟢 LOW RISK

---

## Open Questions

1. **Question 1: JWT Validation in Go**
   - **Options:**
     - A: Use JWT library to validate signature (requires HMAC_SECRET)
     - B: Query database for session (more reliable, but slower)
   - **Decision needed by:** Implementation start
   - **Recommendation:** Query database for session (more reliable, matches existing patterns)

2. **Question 2: HTTP Server Port**
   - **Options:**
     - A: Fixed port (8080)
     - B: Configurable via environment variable
   - **Decision needed by:** Implementation start
   - **Recommendation:** Configurable via `WORKER_HTTP_PORT` (default: 8080)

3. **Question 3: Error Format in Stream**
   - **Options:**
     - A: AI SDK error format
     - B: Custom error format
   - **Decision needed by:** Implementation start
   - **Recommendation:** AI SDK error format (standard)

---

## Timeline

**Total Estimate:** 4-6 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | HTTP Server Setup | 1-2 h | ⏳ |
| 2 | Authentication | 1 h | ⏳ |
| 3 | Request Handling | 1-2 h | ⏳ |
| 4 | Streaming Response | 1 h | ⏳ |
| 5 | Testing | 1 h | ⏳ |

---

## Dependencies

**Requires:**
- [ ] PR#3 complete (AI SDK Streaming Adapter)
- [ ] Go worker running and accessible
- [ ] Database connection available
- [ ] LLM API keys configured

**Blocks:**
- PR#5 (Next.js API Route Proxy) - needs this endpoint
- PR#6 (useChat Hook Implementation) - needs this endpoint

---

## References

- **Related PR:** PR#3 (AI SDK Streaming Adapter)
- **Related PR:** PR#5 (Next.js API Route Proxy)
- **PRD:** [Vercel AI SDK Migration](../PRD-vercel-ai-sdk-migration.md)
- **Architecture:** [Architecture Comparison](../architecture-comparison.md)
- **AI SDK Spec:** https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
- **Existing Code:** `pkg/listener/conversational.go` (current chat handler)
- **Existing Code:** `pkg/llm/conversational.go` (LLM logic)

---

## Appendix

### A. AI SDK Data Stream Protocol Reference

The endpoint must output events in this format:

```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"text-delta","textDelta":" there"}

data: {"type":"tool-call","toolCallId":"call_123","toolName":"get_weather","args":{}}

data: {"type":"tool-result","toolCallId":"call_123","result":{"temp":72}}

data: {"type":"finish","finishReason":"stop"}
```

### B. Current Chat Flow (for reference)

```
1. Frontend calls createChatMessageAction
2. Server action inserts into workspace_chat table
3. Server action triggers pg_notify('new_conversational', ...)
4. Go worker LISTENs for notification
5. Worker calls handleConverationalNotification
6. Worker calls llm.ConversationalChatMessage
7. Worker streams via Centrifugo WebSocket
8. Frontend receives via useCentrifugo hook
```

### C. New Chat Flow (after this PR)

```
1. Frontend calls useChat hook (PR#6)
2. useChat sends POST to /api/chat (Next.js route, PR#5)
3. Next.js route proxies to Go worker /api/v1/chat/stream
4. Go worker authenticates and validates request
5. Worker calls llm.StreamConversationalChatToAISDK (uses adapter from PR#3)
6. Worker streams AI SDK format via HTTP SSE
7. Next.js route forwards stream to frontend
8. useChat receives and updates state
```

---

*This is a living document. Updates should be made as implementation progresses and learnings emerge.*

