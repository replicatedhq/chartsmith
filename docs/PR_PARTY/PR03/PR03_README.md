# PR#3: AI SDK Streaming Adapter - Quick Start

---

## TL;DR (30 seconds)

**What:** Implement the streaming adapter that converts Anthropic SDK events to Vercel AI SDK Data Stream Protocol format.

**Why:** This adapter is the critical translation layer enabling our Go backend to work with the frontend `useChat` hook.

**Time:** 4-6 hours estimated

**Complexity:** MEDIUM

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#2 is merged (aisdk-go library available)
- ✅ You understand HTTP SSE (Server-Sent Events)
- ✅ You're comfortable with Go streaming patterns
- ✅ You have 4-6 hours available
- ✅ You want to enable the AI SDK migration

**Red Lights (Skip/defer it!):**
- ❌ PR#2 not merged yet (dependency)
- ❌ Unfamiliar with streaming protocols
- ❌ Time-constrained (< 4 hours)
- ❌ Other priorities

**Decision Aid:** If PR#2 is merged and you have time, this is a good PR to tackle. It's foundational for the migration and relatively self-contained.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#2 merged (Go AI SDK library integration)
- [ ] Go 1.21+ installed
- [ ] Understanding of:
  - HTTP SSE (Server-Sent Events)
  - Go channels and streaming
  - JSON marshaling
  - Anthropic SDK streaming events
- [ ] Access to AI SDK protocol spec: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol

### Setup Commands
```bash
# 1. Verify PR#2 is merged
git log --oneline | grep "PR#2\|aisdk-go"

# 2. Create branch
git checkout -b feat/pr03-ai-sdk-streaming-adapter

# 3. Verify dependencies
go mod tidy
go build ./pkg/llm/...
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (30 minutes)
- [ ] Read this quick start (5 min)
- [ ] Read main specification (`PR03_AI_SDK_STREAMING_ADAPTER.md`) (20 min)
- [ ] Review AI SDK protocol spec (5 min)
- [ ] Note any questions

### Step 2: Understand Current Code (15 minutes)
- [ ] Review `pkg/llm/conversational.go` to see how Anthropic streaming works
- [ ] Understand the event types from Anthropic SDK
- [ ] Review `pkg/listener/conversational.go` to see how streams are consumed

### Step 3: Start Phase 1
- [ ] Open implementation checklist (`PR03_IMPLEMENTATION_CHECKLIST.md`)
- [ ] Begin Phase 1: Stream Writer Foundation
- [ ] Create `pkg/llm/aisdk.go` file
- [ ] Commit when first checkpoint reached

---

## Daily Progress Template

### Day 1 Goals (4-6 hours)
- [ ] Phase 1: Stream Writer Foundation (1-2 h)
  - [ ] Create AISDKStreamWriter struct
  - [ ] Implement constructor
  - [ ] Implement basic event writers
- [ ] Phase 2: Tool Call Support (1-2 h)
  - [ ] Implement tool call events
  - [ ] Test tool call streaming
- [ ] Phase 3: Anthropic Converter (1.5-2 h)
  - [ ] Implement StreamAnthropicToAISDK
  - [ ] Handle all event types
- [ ] Phase 4: Testing (1-2 h)
  - [ ] Write comprehensive tests
  - [ ] Verify coverage

**Checkpoint:** All event types implemented and tested ✓

---

## Common Issues & Solutions

### Issue 1: ResponseWriter doesn't support flushing
**Symptoms:** `NewAISDKStreamWriter` returns error  
**Cause:** Using wrong ResponseWriter type  
**Solution:** 
```go
// Ensure ResponseWriter implements http.Flusher
flusher, ok := w.(http.Flusher)
if !ok {
    return nil, fmt.Errorf("response writer does not support flushing")
}
```

### Issue 2: SSE format incorrect
**Symptoms:** Frontend can't parse events  
**Cause:** Missing double newline or wrong prefix  
**Solution:** 
```go
// Correct format: "data: {json}\n\n"
fmt.Fprintf(s.w, "data: %s\n\n", jsonData)
```

### Issue 3: JSON marshaling fails
**Symptoms:** `writeEvent` returns error  
**Cause:** Invalid data structure (circular references, functions, etc.)  
**Solution:** Ensure all event data is JSON-serializable (primitives, maps, slices)

### Issue 4: Race condition detected
**Symptoms:** Race detector finds issues  
**Cause:** Concurrent writes without mutex  
**Solution:** 
```go
func (s *AISDKStreamWriter) writeEvent(data interface{}) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    // ... write logic
}
```

### Issue 5: Tool call ID tracking
**Symptoms:** Tool call deltas don't match tool calls  
**Cause:** Not tracking current tool call ID  
**Solution:** Track `currentToolCallID` in converter function

---

## Quick Reference

### Key Files
- `pkg/llm/aisdk.go` - Stream writer implementation
- `pkg/llm/aisdk_anthropic.go` - Anthropic event converter
- `pkg/llm/aisdk_test.go` - Unit tests
- `pkg/llm/conversational.go` - Reference for Anthropic streaming

### Key Functions
- `NewAISDKStreamWriter()` - Creates stream writer
- `WriteTextDelta()` - Writes text token
- `WriteToolCallStart()` - Writes tool call start
- `WriteToolCallDelta()` - Writes tool call argument delta
- `WriteToolResult()` - Writes tool execution result
- `WriteFinish()` - Writes finish event
- `WriteError()` - Writes error event
- `StreamAnthropicToAISDK()` - Converts Anthropic stream to AI SDK format

### Key Concepts
- **SSE Format:** `"data: {json}\n\n"` - Each event is a line starting with "data: " followed by JSON and double newline
- **Event Types:** `text-delta`, `tool-call`, `tool-call-delta`, `tool-result`, `finish`, `error`
- **Thread Safety:** All writes must be protected by mutex
- **Streaming:** Events are flushed immediately, not buffered

### Useful Commands
```bash
# Run tests
go test ./pkg/llm/... -v -run AISDK

# Run tests with coverage
go test ./pkg/llm/... -cover -run AISDK

# Run tests with race detector
go test ./pkg/llm/... -race -run AISDK

# Build
go build ./pkg/llm/...

# Lint (if configured)
golangci-lint run ./pkg/llm/...
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] All unit tests pass
- [ ] Test coverage is 90%+
- [ ] No race conditions detected
- [ ] SSE format is correct (validated by tests)
- [ ] All Anthropic event types are handled
- [ ] Code compiles without warnings

**Performance Targets:**
- Stream writer overhead: < 1ms per event
- Memory usage: < 1MB per active stream
- Concurrent streams: Support 100+ simultaneous streams

---

## Help & Support

### Stuck?
1. Check main planning doc for details (`PR03_AI_SDK_STREAMING_ADAPTER.md`)
2. Review AI SDK protocol spec: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
3. Review Anthropic SDK docs: https://docs.anthropic.com/claude/reference/messages-streaming
4. Check implementation checklist for step-by-step guidance
5. Review `pkg/llm/conversational.go` for Anthropic streaming examples

### Want to Skip a Feature?
- **Can't skip:** All event types are required for AI SDK compatibility
- **Can defer:** Integration tests with mock Anthropic stream (can add in future PR)

### Running Out of Time?
- **Priority 1:** Basic events (text-delta, finish, error) - Required
- **Priority 2:** Tool call events - Required for tool support
- **Priority 3:** Comprehensive tests - Can add more in follow-up PR

---

## Motivation

**You've got this!** 💪

This PR is foundational for the entire AI SDK migration. Once this adapter is complete, the frontend can consume streams from the Go backend using standard `useChat` patterns. You're building the bridge between our proven Go LLM orchestration and modern frontend patterns.

**What's Already Built:**
- ✅ Anthropic streaming works (in `conversational.go`)
- ✅ Go backend is solid
- ✅ Frontend is ready (PR#1)

**What You're Building:**
- 🔨 The translation layer that connects them

---

## Next Steps

**When ready:**
1. Verify PR#2 is merged (5 min)
2. Read main spec (30 min)
3. Start Phase 1 from checklist
4. Commit early and often

**Status:** Ready to build! 🚀

---

## Related Documentation

- **Main Spec:** `PR03_AI_SDK_STREAMING_ADAPTER.md` - Full technical details
- **Checklist:** `PR03_IMPLEMENTATION_CHECKLIST.md` - Step-by-step tasks
- **Testing:** `PR03_TESTING_GUIDE.md` - Test strategy
- **Planning:** `PR03_PLANNING_SUMMARY.md` - Decisions and strategy
- **PRD:** `../PRD-vercel-ai-sdk-migration.md` - Overall migration strategy
- **Architecture:** `../architecture-comparison.md` - Protocol details

---

*This document is part of the PR_PARTY documentation system. See `PR_PARTY/README.md` for more information.*

