# PR#3: AI SDK Streaming Adapter

**Estimated Time:** 4-6 hours  
**Complexity:** MEDIUM  
**Dependencies:** PR#2 (Go AI SDK Library Integration)  
**Success Criteria:** G2 (Migrate to AI SDK Core), G3 (Maintain chat functionality)

---

## Overview

### What We're Building

This PR implements the core streaming adapter that converts Anthropic SDK streaming events into the Vercel AI SDK Data Stream Protocol format. This adapter enables our Go backend to output streams that the frontend `useChat` hook can consume directly.

**Key Components:**
1. **AISDKStreamWriter** - HTTP SSE writer that outputs AI SDK protocol format
2. **StreamAnthropicToAISDK** - Converter function that translates Anthropic events to AI SDK events
3. **Comprehensive unit tests** - Tests for all event types and edge cases

### Why It Matters

This adapter is the **critical translation layer** between our proven Go LLM orchestration and the modern frontend patterns. Without this adapter, we cannot migrate to the Vercel AI SDK. It enables:

- Standardized streaming protocol (AI SDK Data Stream Protocol)
- Compatibility with `useChat` hook expectations
- Foundation for future provider switching
- Clean separation between LLM logic and streaming format

### Success in One Sentence

"This PR is successful when Anthropic streaming events are correctly converted to AI SDK Data Stream Protocol format, all event types are handled, and comprehensive tests validate the conversion."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Adapter Location
**Options Considered:**
1. `pkg/llm/aisdk.go` - Keep with LLM logic, clear organization
2. `pkg/api/aisdk.go` - Separate API concerns, but splits related code
3. `pkg/streaming/aisdk.go` - New package, but adds unnecessary abstraction

**Chosen:** `pkg/llm/aisdk.go`

**Rationale:**
- Keeps LLM-related code together
- Adapter is tightly coupled to LLM streaming logic
- Follows existing package structure (`pkg/llm/` contains all LLM code)
- Easy to find and maintain

**Trade-offs:**
- Gain: Logical organization, easy to discover
- Lose: None significant

#### Decision 2: Streaming Method
**Options Considered:**
1. HTTP SSE (Server-Sent Events) - Standard, AI SDK requirement
2. WebSocket - More complex, not what AI SDK expects
3. HTTP chunked transfer - Non-standard, harder to parse

**Chosen:** HTTP SSE (Server-Sent Events)

**Rationale:**
- AI SDK Data Stream Protocol requires SSE format
- Standard HTTP, easier to debug than WebSocket
- Works well with HTTP/2
- Built-in browser support

**Trade-offs:**
- Gain: Standard protocol, AI SDK compatibility, easy debugging
- Lose: Unidirectional (server → client only, but that's what we need)

#### Decision 3: Error Handling Strategy
**Options Considered:**
1. Stream error events - Matches AI SDK spec, frontend can handle gracefully
2. Close connection on error - Simpler, but less informative
3. Return error and close - Breaks streaming, poor UX

**Chosen:** Stream error events

**Rationale:**
- Matches AI SDK protocol specification
- Frontend can display error messages to users
- Allows partial responses before error
- Better debugging (error context in stream)

**Trade-offs:**
- Gain: Better UX, matches spec, debuggable
- Lose: Slightly more complex (but necessary)

#### Decision 4: Tool Call Streaming Approach
**Options Considered:**
1. Stream tool calls as they're detected - Real-time, matches AI SDK spec
2. Buffer and send complete tool calls - Simpler, but less responsive
3. Hybrid (start immediately, stream args) - Best UX, matches spec

**Chosen:** Hybrid (start immediately, stream args)

**Rationale:**
- AI SDK spec supports `tool-call` and `tool-call-delta` events
- Provides immediate feedback when tool is invoked
- Allows streaming of tool arguments as they arrive
- Matches Anthropic SDK's streaming behavior

**Trade-offs:**
- Gain: Real-time feedback, matches spec, better UX
- Lose: More complex implementation (but necessary for spec compliance)

### Data Model

**No database changes** - This PR only affects streaming format, not data persistence.

**Stream Protocol Format:**
```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"tool-call","toolCallId":"call_123","toolName":"get_weather","args":{}}

data: {"type":"tool-call-delta","toolCallId":"call_123","argsTextDelta":"{\"city\":"}

data: {"type":"tool-result","toolCallId":"call_123","result":{"temp":72}}

data: {"type":"finish","finishReason":"stop"}
```

### API Design

**New Functions:**

```go
// AISDKStreamWriter writes events in AI SDK Data Stream Protocol format
type AISDKStreamWriter struct {
    w       http.ResponseWriter
    flusher http.Flusher
    mu      sync.Mutex
    closed  bool
}

// NewAISDKStreamWriter creates a new stream writer
// Returns error if ResponseWriter doesn't support flushing
func NewAISDKStreamWriter(w http.ResponseWriter) (*AISDKStreamWriter, error)

// WriteTextDelta writes a text delta event
// Called for each token/chunk of text from the LLM
func (s *AISDKStreamWriter) WriteTextDelta(text string) error

// WriteToolCallStart writes the start of a tool call
// Called when the LLM begins a tool invocation
func (s *AISDKStreamWriter) WriteToolCallStart(toolCallID, toolName string) error

// WriteToolCallDelta writes tool call argument deltas
// Called as tool arguments are streamed
func (s *AISDKStreamWriter) WriteToolCallDelta(toolCallID string, argsJson string) error

// WriteToolResult writes a tool result
// Called after tool execution completes
func (s *AISDKStreamWriter) WriteToolResult(toolCallID string, result interface{}) error

// WriteFinish writes the finish event
// Called when the LLM response is complete
func (s *AISDKStreamWriter) WriteFinish(reason string) error

// WriteError writes an error event
// Called when an error occurs during streaming
func (s *AISDKStreamWriter) WriteError(err error) error

// Close marks the stream as closed
func (s *AISDKStreamWriter) Close()

// StreamAnthropicToAISDK converts Anthropic streaming to AI SDK format
// This is the main integration point between Anthropic SDK and AI SDK protocol
func StreamAnthropicToAISDK(
    ctx context.Context,
    stream *anthropic.MessageStream,
    writer *AISDKStreamWriter,
) error

// mapAnthropicStopReason converts Anthropic stop reasons to AI SDK format
func mapAnthropicStopReason(reason string) string
```

### Component Hierarchy

```
pkg/llm/
├── aisdk.go (new)
│   ├── AISDKStreamWriter struct
│   └── NewAISDKStreamWriter() function
├── aisdk_anthropic.go (new)
│   ├── StreamAnthropicToAISDK() function
│   └── mapAnthropicStopReason() function
├── aisdk_test.go (new)
│   └── Comprehensive unit tests
└── conversational.go (not modified in this PR)
```

---

## Implementation Details

### File Structure

**New Files:**
```
pkg/llm/
├── aisdk.go (~200 lines)
│   └── AISDKStreamWriter implementation
├── aisdk_anthropic.go (~150 lines)
│   └── Anthropic event converter
└── aisdk_test.go (~400 lines)
    └── Unit tests for all scenarios
```

**Modified Files:**
- None (this PR adds new code only, no modifications to existing code)

### Key Implementation Steps

#### Phase 1: Stream Writer Foundation (1-2 hours)
1. Create `AISDKStreamWriter` struct
2. Implement SSE header setup
3. Implement `writeEvent()` helper method
4. Implement basic event writers (`WriteTextDelta`, `WriteFinish`, `WriteError`)
5. Add mutex protection for thread safety
6. Add close tracking

#### Phase 2: Tool Call Support (1-2 hours)
1. Implement `WriteToolCallStart()`
2. Implement `WriteToolCallDelta()`
3. Implement `WriteToolResult()`
4. Handle tool call state tracking

#### Phase 3: Anthropic Event Converter (1.5-2 hours)
1. Create `StreamAnthropicToAISDK()` function
2. Handle `ContentBlockStartEvent` (text and tool use)
3. Handle `ContentBlockDeltaEvent` (text and tool args)
4. Handle `ContentBlockStopEvent`
5. Handle `MessageStopEvent` and `MessageDeltaEvent`
6. Map Anthropic stop reasons to AI SDK format
7. Handle errors and stream completion

#### Phase 4: Testing (1-2 hours)
1. Test text delta streaming
2. Test tool call events
3. Test tool result events
4. Test finish events
5. Test error handling
6. Test SSE format compliance
7. Test HTTP headers
8. Test concurrent access safety

### Code Examples

**Example 1: Creating and Using Stream Writer**
```go
// In HTTP handler (future PR)
w.Header().Set("Content-Type", "text/event-stream")
writer, err := llm.NewAISDKStreamWriter(w)
if err != nil {
    http.Error(w, "Streaming not supported", http.StatusInternalServerError)
    return
}
defer writer.Close()

// Stream text
writer.WriteTextDelta("Hello")
writer.WriteTextDelta(" World")
writer.WriteFinish("stop")
```

**Example 2: Converting Anthropic Stream**
```go
// In conversational.go (future PR)
stream := client.Messages.NewStreaming(ctx, params)
err := llm.StreamAnthropicToAISDK(ctx, stream, writer)
if err != nil {
    writer.WriteError(err)
    return err
}
```

**Example 3: Handling Tool Calls**
```go
// In StreamAnthropicToAISDK
case anthropic.ContentBlockStartEvent:
    switch block := e.ContentBlock.AsUnion().(type) {
    case anthropic.ToolUseBlock:
        currentToolCallID = block.ID
        writer.WriteToolCallStart(block.ID, block.Name)
    }
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- `AISDKStreamWriter` creation and initialization
- Text delta events (single and multiple)
- Tool call start events
- Tool call delta events
- Tool result events
- Finish events with different reasons
- Error events
- SSE format compliance (valid JSON, correct prefix)
- HTTP headers (Content-Type, Cache-Control, etc.)
- Thread safety (concurrent writes)
- Close behavior (no writes after close)

**Integration Tests:**
- Mock Anthropic stream → AI SDK output
- Full event sequence (text → tool → result → finish)
- Error scenarios (stream errors, write errors)
- Stop reason mapping (all Anthropic reasons)

**Edge Cases:**
- Empty text deltas
- Large text deltas
- Multiple tool calls in sequence
- Tool calls without results
- Stream interruption
- Invalid JSON in tool args
- Connection drops

**Performance Tests:**
- Streaming throughput (tokens/second)
- Memory usage during long streams
- Concurrent stream handling

### Test Coverage Goals

- **Target:** 90%+ code coverage
- **Critical paths:** 100% coverage (all event types, error paths)
- **Edge cases:** All identified edge cases tested

---

## Success Criteria

**Feature is complete when:**
- [ ] `AISDKStreamWriter` correctly writes SSE format
- [ ] All event types implemented (`text-delta`, `tool-call`, `tool-call-delta`, `tool-result`, `finish`, `error`)
- [ ] `StreamAnthropicToAISDK` handles all Anthropic event types
- [ ] Stop reason mapping is correct (all Anthropic reasons mapped)
- [ ] HTTP headers set correctly for SSE
- [ ] All unit tests pass (90%+ coverage)
- [ ] Thread-safe (no race conditions)
- [ ] Error handling comprehensive
- [ ] Code compiles without warnings
- [ ] No memory leaks (tested with long streams)

**Performance Targets:**
- Stream writer overhead: < 1ms per event
- Memory usage: < 1MB per active stream
- Concurrent streams: Support 100+ simultaneous streams

**Quality Gates:**
- Zero critical bugs
- All tests passing
- No race conditions detected
- Linting passes (`golangci-lint`)
- Code review approved

---

## Risk Assessment

### Risk 1: Protocol Mismatch
**Likelihood:** MEDIUM  
**Impact:** HIGH  
**Description:** AI SDK protocol may have nuances not covered by our implementation

**Mitigation:**
- Review AI SDK spec thoroughly: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
- Test against actual `useChat` hook consumption
- Create protocol compliance tests
- Validate with AI SDK examples

**Status:** 🟡 Requires careful validation

### Risk 2: Anthropic Event Type Coverage
**Likelihood:** LOW  
**Impact:** HIGH  
**Description:** May miss some Anthropic event types, causing incomplete conversion

**Mitigation:**
- Review Anthropic SDK documentation for all event types
- Test with actual Anthropic responses
- Add comprehensive event type handling
- Log unhandled events for debugging

**Status:** 🟢 Well understood

### Risk 3: Thread Safety Issues
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Description:** Concurrent writes to stream writer may cause race conditions

**Mitigation:**
- Use mutex for all write operations
- Test with concurrent goroutines
- Use race detector (`go test -race`)
- Document thread safety guarantees

**Status:** 🟢 Standard Go patterns

### Risk 4: Performance Overhead
**Likelihood:** LOW  
**Impact:** LOW  
**Description:** Additional abstraction layer may slow streaming

**Mitigation:**
- Benchmark before/after (if applicable)
- Optimize hot paths (event writing)
- Use efficient JSON marshaling
- Profile if needed

**Status:** 🟢 Expected to be minimal

### Risk 5: SSE Format Errors
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Description:** Incorrect SSE format may break frontend parsing

**Mitigation:**
- Strict SSE format compliance (tested)
- Validate JSON before writing
- Test with real frontend consumption
- Add format validation tests

**Status:** 🟡 Requires careful testing

---

## Open Questions

1. **Question:** Should we buffer small text deltas or send immediately?
   - **Option A:** Send immediately (lower latency)
   - **Option B:** Buffer small chunks (fewer events)
   - **Decision:** Send immediately (matches Anthropic behavior, better UX)
   - **Status:** ✅ Resolved

2. **Question:** How to handle partial tool call arguments?
   - **Option A:** Stream as `tool-call-delta` events
   - **Option B:** Buffer until complete
   - **Decision:** Stream as deltas (matches AI SDK spec)
   - **Status:** ✅ Resolved

3. **Question:** Should we validate JSON before writing?
   - **Option A:** Yes, catch errors early
   - **Option B:** No, trust marshaling
   - **Decision:** Yes, validate (better error messages)
   - **Status:** ✅ Resolved

---

## Timeline

**Total Estimate:** 4-6 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Stream Writer Foundation | 1-2 h | ⏳ |
| 2 | Tool Call Support | 1-2 h | ⏳ |
| 3 | Anthropic Event Converter | 1.5-2 h | ⏳ |
| 4 | Testing | 1-2 h | ⏳ |

**Buffer Time:** 1 hour for unexpected issues

---

## Dependencies

**Requires:**
- [ ] PR#2 complete (aisdk-go library available)
- [ ] Go 1.21+ (for context support)
- [ ] `github.com/anthropics/anthropic-sdk-go` (existing dependency)
- [ ] `net/http` package (standard library)

**Blocks:**
- PR#4 (New Chat Streaming Endpoint) - Needs this adapter
- PR#5 (Next.js API Route Proxy) - Needs this adapter
- PR#6 (useChat Hook Implementation) - Needs this adapter

**Parallel With:**
- Can work in parallel with PR#1 (Frontend setup) - No dependencies

---

## References

- **AI SDK Data Stream Protocol:** https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
- **Anthropic SDK Docs:** https://docs.anthropic.com/claude/reference/messages-streaming
- **Related PR:** PR#2 (Go AI SDK Library Integration)
- **Related PR:** PR#4 (New Chat Streaming Endpoint) - Will use this adapter
- **Architecture Doc:** `docs/architecture-comparison.md` - Protocol details
- **PRD:** `docs/PRD-vercel-ai-sdk-migration.md` - Overall migration strategy

---

## Appendix

### AI SDK Data Stream Protocol Reference

**Event Types:**

| Type | Fields | Description |
|------|--------|-------------|
| `text-delta` | `textDelta` (string) | Incremental text token |
| `tool-call` | `toolCallId`, `toolName`, `args` | Tool invocation start |
| `tool-call-delta` | `toolCallId`, `argsTextDelta` | Tool argument chunk |
| `tool-result` | `toolCallId`, `result` | Tool execution result |
| `finish` | `finishReason` | Stream complete |
| `error` | `error` | Error occurred |

**Finish Reasons:**
- `stop` - Normal completion
- `length` - Max tokens reached
- `tool-calls` - Stopped for tool calls
- `content-filter` - Content filtered
- `error` - Error occurred

### Anthropic Event Types

| Anthropic Event | AI SDK Event | Notes |
|----------------|--------------|-------|
| `ContentBlockDeltaEvent` (text) | `text-delta` | Direct mapping |
| `ContentBlockStartEvent` (tool) | `tool-call` | Extract tool ID and name |
| `ContentBlockDeltaEvent` (tool args) | `tool-call-delta` | Stream partial JSON |
| Tool result | `tool-result` | After tool execution |
| `MessageDeltaEvent` (stop) | `finish` | Map stop reason |
| Stream error | `error` | Wrap error message |

### Example Stream Output

```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"text-delta","textDelta":" "}

data: {"type":"text-delta","textDelta":"world"}

data: {"type":"tool-call","toolCallId":"call_abc123","toolName":"latest_subchart_version","args":{}}

data: {"type":"tool-call-delta","toolCallId":"call_abc123","argsTextDelta":"{\"chart_name\":"}

data: {"type":"tool-call-delta","toolCallId":"call_abc123","argsTextDelta":"\"nginx\""}

data: {"type":"tool-call-delta","toolCallId":"call_abc123","argsTextDelta":"}"}

data: {"type":"tool-result","toolCallId":"call_abc123","result":"1.2.3"}

data: {"type":"finish","finishReason":"stop"}
```

---

*This document is part of the PR_PARTY documentation system. See `PR_PARTY/README.md` for more information.*

