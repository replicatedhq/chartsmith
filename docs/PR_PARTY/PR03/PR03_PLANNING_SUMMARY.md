# PR#3: Planning Complete 🚀

**Date:** [Date]  
**Status:** ✅ PLANNING COMPLETE  
**Time Spent Planning:** 2-3 hours  
**Estimated Implementation:** 4-6 hours

---

## What Was Created

**5 Core Planning Documents:**

1. **Technical Specification** (~8,000 words)
   - File: `PR03_AI_SDK_STREAMING_ADAPTER.md`
   - Architecture and design decisions
   - Implementation details with code examples
   - Testing strategies
   - Risk assessment

2. **Implementation Checklist** (~6,000 words)
   - File: `PR03_IMPLEMENTATION_CHECKLIST.md`
   - Step-by-step task breakdown
   - Testing checkpoints per phase
   - Time estimates per task

3. **Quick Start Guide** (~3,000 words)
   - File: `PR03_README.md`
   - Decision framework
   - Prerequisites
   - Getting started guide
   - Common issues & solutions

4. **Testing Guide** (~4,000 words)
   - File: `PR03_TESTING_GUIDE.md`
   - Test categories
   - Specific test cases
   - Acceptance criteria

5. **Planning Summary** (this document)
   - What was created
   - Key decisions
   - Implementation strategy

**Total Documentation:** ~21,000 words of comprehensive planning

---

## What We're Building

### Core Components

| Component | Time | Priority | Impact |
|-----------|------|----------|--------|
| AISDKStreamWriter | 1-2 h | HIGH | Foundation for all streaming |
| Tool Call Support | 1-2 h | HIGH | Required for tool functionality |
| Anthropic Converter | 1.5-2 h | HIGH | Core translation layer |
| Comprehensive Tests | 1-2 h | HIGH | Quality assurance |

**Total Time:** 4-6 hours

### Key Deliverables

1. **`pkg/llm/aisdk.go`** (~200 lines)
   - `AISDKStreamWriter` struct
   - Event writing methods
   - SSE format handling

2. **`pkg/llm/aisdk_anthropic.go`** (~150 lines)
   - `StreamAnthropicToAISDK()` function
   - Event type conversion
   - Stop reason mapping

3. **`pkg/llm/aisdk_test.go`** (~400 lines)
   - Unit tests for all event types
   - Integration tests
   - Edge case coverage

---

## Key Decisions Made

### Decision 1: Adapter Location
**Choice:** `pkg/llm/aisdk.go`  
**Rationale:**
- Keeps LLM-related code together
- Adapter is tightly coupled to LLM streaming logic
- Follows existing package structure

**Impact:** Easy to find and maintain, logical organization

### Decision 2: Streaming Method
**Choice:** HTTP SSE (Server-Sent Events)  
**Rationale:**
- AI SDK Data Stream Protocol requires SSE format
- Standard HTTP, easier to debug than WebSocket
- Built-in browser support

**Impact:** Standard protocol, AI SDK compatibility, easy debugging

### Decision 3: Error Handling Strategy
**Choice:** Stream error events  
**Rationale:**
- Matches AI SDK protocol specification
- Frontend can display error messages to users
- Allows partial responses before error

**Impact:** Better UX, matches spec, debuggable

### Decision 4: Tool Call Streaming Approach
**Choice:** Hybrid (start immediately, stream args)  
**Rationale:**
- AI SDK spec supports `tool-call` and `tool-call-delta` events
- Provides immediate feedback when tool is invoked
- Matches Anthropic SDK's streaming behavior

**Impact:** Real-time feedback, matches spec, better UX

---

## Implementation Strategy

### Timeline
```
Day 1 (4-6 hours):
├─ Phase 1: Stream Writer Foundation (1-2 h)
│  ├─ Create AISDKStreamWriter struct
│  ├─ Implement constructor
│  └─ Implement basic event writers
├─ Phase 2: Tool Call Support (1-2 h)
│  ├─ Implement tool call events
│  └─ Test tool call streaming
├─ Phase 3: Anthropic Converter (1.5-2 h)
│  ├─ Implement StreamAnthropicToAISDK
│  └─ Handle all event types
└─ Phase 4: Testing (1-2 h)
   ├─ Write comprehensive tests
   └─ Verify coverage
```

### Key Principle
**Test after EACH phase** - Don't move to next phase until current phase is tested and working.

### Implementation Order
1. **Foundation first** - Stream writer must work before converter
2. **Basic events first** - Text and finish before tool calls
3. **Test incrementally** - Test each component as it's built
4. **Integration last** - Full converter test comes after all pieces work

---

## Success Metrics

### Quantitative
- [ ] Test coverage: 90%+
- [ ] All event types implemented: 6/6 (text-delta, tool-call, tool-call-delta, tool-result, finish, error)
- [ ] All Anthropic event types handled: 5/5 (ContentBlockStart, ContentBlockDelta, ContentBlockStop, MessageStop, MessageDelta)
- [ ] Zero race conditions
- [ ] Zero critical bugs

### Qualitative
- [ ] Code is clean and maintainable
- [ ] Tests are comprehensive
- [ ] Documentation is clear
- [ ] Ready for integration in PR#4

---

## Risks Identified & Mitigated

### Risk 1: Protocol Mismatch 🟡 MEDIUM
**Issue:** AI SDK protocol may have nuances not covered  
**Mitigation:** 
- Review AI SDK spec thoroughly
- Test against actual `useChat` hook consumption
- Create protocol compliance tests

**Status:** Documented, requires careful validation

### Risk 2: Anthropic Event Type Coverage 🟢 LOW
**Issue:** May miss some Anthropic event types  
**Mitigation:**
- Review Anthropic SDK documentation for all event types
- Test with actual Anthropic responses
- Log unhandled events for debugging

**Status:** Well understood, comprehensive handling planned

### Risk 3: Thread Safety Issues 🟢 LOW
**Issue:** Concurrent writes may cause race conditions  
**Mitigation:**
- Use mutex for all write operations
- Test with race detector
- Document thread safety guarantees

**Status:** Standard Go patterns, well understood

### Risk 4: Performance Overhead 🟢 LOW
**Issue:** Additional abstraction layer may slow streaming  
**Mitigation:**
- Benchmark if needed
- Optimize hot paths
- Use efficient JSON marshaling

**Status:** Expected to be minimal

### Risk 5: SSE Format Errors 🟡 MEDIUM
**Issue:** Incorrect SSE format may break frontend parsing  
**Mitigation:**
- Strict SSE format compliance (tested)
- Validate JSON before writing
- Test with real frontend consumption

**Status:** Requires careful testing

**Overall Risk:** LOW-MEDIUM - Well understood with clear mitigation strategies

---

## Hot Tips

### Tip 1: Test SSE Format Strictly
**Why:** Frontend parsing is strict - any format deviation breaks consumption  
**How:** Create dedicated test that validates exact SSE format (`"data: {json}\n\n"`)

### Tip 2: Use Mutex for All Writes
**Why:** HTTP handlers may be called concurrently  
**How:** Protect all `writeEvent()` calls with mutex lock

### Tip 3: Track Tool Call State
**Why:** Tool call deltas must match tool call IDs  
**How:** Track `currentToolCallID` in converter function

### Tip 4: Test Edge Cases Early
**Why:** Edge cases (empty deltas, connection drops) are common  
**How:** Include edge case tests in each phase, not just at the end

### Tip 5: Validate JSON Before Writing
**Why:** Invalid JSON breaks frontend parsing  
**How:** Use `json.Marshal()` and handle errors before writing

---

## Go / No-Go Decision

### Go If:
- ✅ PR#2 is merged (aisdk-go library available)
- ✅ You have 4-6 hours available
- ✅ You understand HTTP SSE and Go streaming
- ✅ You're comfortable with JSON marshaling
- ✅ You want to enable AI SDK migration

### No-Go If:
- ❌ PR#2 not merged yet (dependency)
- ❌ Time-constrained (< 4 hours)
- ❌ Unfamiliar with streaming protocols
- ❌ Other priorities

**Decision Aid:** If PR#2 is merged and you have time, this is a good PR to tackle. It's foundational and relatively self-contained.

---

## Immediate Next Actions

### Pre-Flight (5 minutes)
- [ ] Verify PR#2 is merged
- [ ] Review prerequisites
- [ ] Create branch: `feat/pr03-ai-sdk-streaming-adapter`

### Day 1 Goals (4-6 hours)
- [ ] Read main specification (30 min)
- [ ] Start Phase 1: Stream Writer Foundation (1-2 h)
- [ ] Complete Phase 2: Tool Call Support (1-2 h)
- [ ] Complete Phase 3: Anthropic Converter (1.5-2 h)
- [ ] Complete Phase 4: Testing (1-2 h)

**Checkpoint:** All event types implemented and tested ✓

---

## Dependencies

### Requires
- ✅ PR#2: Go AI SDK Library Integration (must be merged)
- ✅ Go 1.21+ (for context support)
- ✅ `github.com/anthropics/anthropic-sdk-go` (existing dependency)

### Blocks
- PR#4: New Chat Streaming Endpoint (needs this adapter)
- PR#5: Next.js API Route Proxy (needs this adapter)
- PR#6: useChat Hook Implementation (needs this adapter)

### Parallel With
- Can work in parallel with PR#1 (Frontend setup) - No dependencies

---

## Conclusion

**Planning Status:** ✅ COMPLETE  
**Confidence Level:** HIGH  
**Recommendation:** **BUILD IT** - Well-planned, clear implementation path, manageable scope

**Next Step:** When PR#2 is merged, start with Phase 1 from the implementation checklist.

---

## Key Insights

### What Makes This PR Important
- **Foundation:** This adapter is the critical translation layer for the entire migration
- **Self-Contained:** Relatively isolated, doesn't modify existing code
- **Testable:** Can be thoroughly tested in isolation
- **Clear Scope:** Well-defined boundaries and deliverables

### What Makes This PR Manageable
- **No Database Changes:** Only affects streaming format
- **No Frontend Changes:** Pure backend implementation
- **Incremental:** Can be built and tested phase by phase
- **Well-Documented:** Clear protocol specs to follow

### What Makes This PR Challenging
- **Protocol Compliance:** Must match AI SDK spec exactly
- **Event Type Coverage:** Must handle all Anthropic event types
- **Thread Safety:** Must handle concurrent writes safely
- **Testing:** Requires comprehensive test coverage

---

**You've got this!** 💪

This PR is well-planned with clear steps, comprehensive testing strategy, and manageable scope. Once complete, it enables the entire frontend migration to use `useChat` hook.

---

*"Perfect is the enemy of good. Ship the adapter that works, then iterate based on integration feedback."*

