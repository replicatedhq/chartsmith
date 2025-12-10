# PR#4: New Chat Streaming Endpoint - Quick Start

---

## TL;DR (30 seconds)

**What:** Create an HTTP endpoint in the Go worker that accepts chat requests and streams AI SDK formatted responses.

**Why:** This endpoint bridges the frontend `useChat` hook with the Go backend LLM orchestration, enabling standard HTTP SSE streaming instead of WebSocket.

**Time:** 4-6 hours estimated

**Complexity:** MEDIUM

**Status:** 📋 PLANNED

**Dependencies:** PR#3 (AI SDK Streaming Adapter) must be complete

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#3 is complete (AI SDK Streaming Adapter exists)
- ✅ You have 4-6 hours available
- ✅ You understand Go HTTP servers and SSE streaming
- ✅ You're comfortable with authentication/authorization patterns
- ✅ You understand the existing conversational chat flow

**Red Lights (Skip/defer it!):**
- ❌ PR#3 not complete (blocking dependency)
- ❌ Time-constrained (<4 hours)
- ❌ Unfamiliar with Go HTTP servers
- ❌ Other priorities take precedence

**Decision Aid:** This PR is foundational for the AI SDK migration. If PR#3 is done and you have the time, proceed. If not, complete PR#3 first or wait until you have adequate time.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#3 complete (AI SDK Streaming Adapter in `pkg/llm/aisdk.go`)
- [ ] Go worker codebase accessible
- [ ] Database connection works (`DATABASE_URL` configured)
- [ ] LLM API keys configured (`ANTHROPIC_API_KEY`, etc.)
- [ ] Understanding of existing chat flow (`pkg/listener/conversational.go`)

### Knowledge Prerequisites
- [ ] Go HTTP server basics
- [ ] Server-Sent Events (SSE) format
- [ ] JWT authentication patterns
- [ ] Existing workspace/chat data structures

### Setup Commands
```bash
# 1. Verify PR#3 is merged
git checkout main
git pull
# Verify pkg/llm/aisdk.go exists

# 2. Create branch
git checkout -b feat/ai-sdk-chat-endpoint

# 3. Verify environment
# Check that DATABASE_URL, ANTHROPIC_API_KEY are set
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (45 minutes)
- [ ] Read this quick start (10 min) ✓
- [ ] Read main specification (30 min)
  - [ ] Understand architecture decisions
  - [ ] Review API design
  - [ ] Note authentication approach
- [ ] Review existing code (5 min)
  - [ ] `pkg/listener/conversational.go` - current chat handler
  - [ ] `pkg/llm/conversational.go` - LLM integration
  - [ ] `cmd/run.go` - worker startup

### Step 2: Set Up Environment (15 minutes)
- [ ] Verify Go environment
  ```bash
  go version
  go mod tidy
  ```
- [ ] Verify database connection
  ```bash
  # Test connection (if you have a test script)
  ```
- [ ] Open relevant files in editor
  - `cmd/run.go`
  - `pkg/param/param.go`
  - `pkg/listener/conversational.go`

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: HTTP Server Setup
- [ ] Create `pkg/api/server.go`
- [ ] Commit when Phase 1 complete

---

## Daily Progress Template

### Day 1 Goals (4-6 hours)

**Morning (2-3 hours):**
- [ ] Phase 1: HTTP Server Setup (1-2 h)
  - [ ] Create HTTP server function
  - [ ] Update worker startup
  - [ ] Register routes
  - [ ] Add feature flag
- [ ] Phase 2: Authentication (1 h)
  - [ ] JWT validation
  - [ ] Workspace access check

**Afternoon (2-3 hours):**
- [ ] Phase 3: Request Handling (1-2 h)
  - [ ] Define types
  - [ ] Request parsing
  - [ ] Message conversion
  - [ ] Integration with chat logic
- [ ] Phase 4: Streaming Response (1 h)
  - [ ] SSE writer
  - [ ] Main handler

**End of Day:**
- [ ] Phase 5: Testing (1 h)
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] Manual testing

**Checkpoint:** Endpoint responds to POST requests and streams AI SDK format ✓

---

## Common Issues & Solutions

### Issue 1: HTTP Server Port Already in Use
**Symptoms:** `bind: address already in use` error  
**Cause:** Port 8080 already taken by another service  
**Solution:**
```bash
# Option 1: Change port via environment variable
export WORKER_HTTP_PORT=8081

# Option 2: Find and kill process using port 8080
lsof -ti:8080 | xargs kill -9
```

### Issue 2: Authentication Fails
**Symptoms:** All requests return 401 Unauthorized  
**Cause:** JWT validation logic incorrect or session query wrong  
**Solution:**
- Check session table schema matches query
- Verify JWT token format matches what frontend sends
- Add logging to see what token is received
- Test with known valid token from database

### Issue 3: SSE Stream Not Flushing
**Symptoms:** Events not appearing until stream completes  
**Cause:** Flusher not working or buffering enabled  
**Solution:**
```go
// Ensure flusher is available
flusher, ok := w.(http.Flusher)
if !ok {
    // Handle error
}

// Add header to disable buffering
w.Header().Set("X-Accel-Buffering", "no")

// Flush after each event
flusher.Flush()
```

### Issue 4: Message Conversion Errors
**Symptoms:** `Invalid message format` errors  
**Cause:** AI SDK message structure doesn't match expected format  
**Solution:**
- Check AI SDK message spec
- Add validation for each field
- Log received messages for debugging
- Handle missing/optional fields gracefully

### Issue 5: Feature Flag Not Working
**Symptoms:** Endpoint always returns 503 or always works  
**Cause:** Environment variable not read correctly  
**Solution:**
- Verify `ENABLE_AI_SDK_CHAT` is set in environment
- Check `pkg/param/param.go` reads env var correctly
- Restart worker after setting env var
- Add logging to show flag value at startup

---

## Quick Reference

### Key Files
- `pkg/api/chat.go` - Main chat handler
- `pkg/api/auth.go` - Authentication logic
- `pkg/api/types.go` - Request/response types
- `pkg/api/sse.go` - SSE writer implementation
- `pkg/api/server.go` - HTTP server setup
- `pkg/api/routes.go` - Route registration
- `cmd/run.go` - Worker startup (modified)
- `pkg/param/param.go` - Feature flag (modified)

### Key Functions
- `ChatStreamHandler()` - Main HTTP handler
- `AuthenticateRequest()` - JWT validation
- `VerifyWorkspaceAccess()` - Authorization check
- `parseChatRequest()` - Request parsing
- `convertAISDKMessagesToChatHistory()` - Message conversion
- `streamConversationalChat()` - Streaming integration
- `NewSSEWriter()` - SSE writer creation

### Key Concepts
- **SSE Format:** `data: {json}\n\n` (double newline required)
- **AI SDK Protocol:** Text-delta, tool-call, tool-result, finish events
- **Authentication:** Bearer token in Authorization header
- **Feature Flag:** `ENABLE_AI_SDK_CHAT` environment variable

### Useful Commands
```bash
# Start worker with feature flag
ENABLE_AI_SDK_CHAT=true make run-worker

# Test endpoint with curl
curl -X POST http://localhost:8080/api/v1/chat/stream \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @test-request.json

# Check if server is running
curl http://localhost:8080/health

# View logs
# (depends on your logging setup)
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] HTTP server starts on port 8080
- [ ] Health endpoint returns 200 OK
- [ ] POST to `/api/v1/chat/stream` with valid token returns 200
- [ ] SSE stream starts and events are received
- [ ] Text-delta events contain streaming text
- [ ] Finish event received at end of stream
- [ ] Invalid requests return appropriate error codes

**Performance Targets:**
- Endpoint responds within 100ms (before streaming starts)
- Streaming latency < 50ms (time from LLM token to SSE event)
- Handles 10+ concurrent streams

**Quality Gates:**
- All unit tests pass
- All integration tests pass
- Manual testing confirms streaming works
- Error handling works correctly
- No memory leaks in streaming

---

## Help & Support

### Stuck?
1. **Check main planning doc** (`PR04_NEW_CHAT_STREAMING_ENDPOINT.md`) for detailed design
2. **Review implementation checklist** (`PR04_IMPLEMENTATION_CHECKLIST.md`) for step-by-step tasks
3. **Check existing code:**
   - `pkg/listener/conversational.go` - see how current chat works
   - `pkg/llm/conversational.go` - see LLM integration
4. **Review PR#3 code** - understand AI SDK adapter
5. **Check testing guide** (`PR04_TESTING_GUIDE.md`) for test examples

### Want to Skip a Feature?
- **Can skip:** Health endpoint (nice-to-have)
- **Cannot skip:** Authentication, request parsing, streaming (core functionality)

### Running Out of Time?
**Priority order:**
1. HTTP server setup (required)
2. Authentication (required)
3. Basic request handling (required)
4. Streaming integration (required)
5. Comprehensive error handling (can simplify)
6. Extensive tests (can add later, but add basic tests)

---

## Motivation

**You've got this!** 💪

This PR is a critical bridge between the frontend and backend. Once complete, the frontend can use the standard `useChat` hook, making the entire chat system more maintainable and easier to extend. The work you're doing here enables the rest of the AI SDK migration.

**What's already built:**
- ✅ PR#3 provides the AI SDK adapter (streaming format conversion)
- ✅ Existing conversational chat logic works (just needs new interface)
- ✅ Authentication patterns exist (can reuse/adapt)

**What you're building:**
- 🚧 HTTP endpoint for chat streaming
- 🚧 Standard SSE streaming protocol
- 🚧 Foundation for frontend integration (PR#5, PR#6)

---

## Next Steps

**When ready:**
1. ✅ Verify PR#3 is complete (5 min)
2. ✅ Read main specification (30 min)
3. ✅ Set up environment (15 min)
4. ✅ Start Phase 1 from checklist
5. ✅ Commit early and often

**Status:** Ready to build! 🚀

---

## Related Documentation

- **Main Spec:** `PR04_NEW_CHAT_STREAMING_ENDPOINT.md` - Full technical design
- **Checklist:** `PR04_IMPLEMENTATION_CHECKLIST.md` - Step-by-step tasks
- **Testing:** `PR04_TESTING_GUIDE.md` - Test cases and examples
- **Planning:** `PR04_PLANNING_SUMMARY.md` - Decisions and strategy
- **PRD:** `../PRD-vercel-ai-sdk-migration.md` - Overall migration strategy
- **Architecture:** `../architecture-comparison.md` - Before/after comparison

---

*Remember: This endpoint is the bridge. Make it solid, and the rest of the migration will flow smoothly!*

