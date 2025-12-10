# PR#6: Planning Complete 🚀

**Date:** [Date]  
**Status:** ✅ PLANNING COMPLETE  
**Time Spent Planning:** 2-3 hours  
**Estimated Implementation:** 8-12 hours

---

## What Was Created

**5 Core Planning Documents:**

1. **Technical Specification** (~8,000 words)
   - File: `PR06_USECHAT_HOOK_IMPLEMENTATION.md`
   - Architecture and design decisions
   - Implementation details with code examples
   - Testing strategies
   - Risk assessment

2. **Implementation Checklist** (~6,000 words)
   - File: `PR06_IMPLEMENTATION_CHECKLIST.md`
   - Step-by-step task breakdown
   - Testing checkpoints per phase
   - Daily progress template

3. **Quick Start Guide** (~3,000 words)
   - File: `PR06_README.md`
   - Decision framework
   - Prerequisites
   - Getting started guide
   - Common issues & solutions

4. **Planning Summary** (this document)
   - What was created
   - Key decisions
   - Implementation strategy
   - Go/No-Go decision

5. **Testing Guide** (~4,000 words)
   - File: `PR06_TESTING_GUIDE.md`
   - Test categories
   - Specific test cases
   - Acceptance criteria

**Total Documentation:** ~21,000 words of comprehensive planning

---

## What We're Building

### Core Features

| Feature | Time | Priority | Impact |
|---------|------|----------|--------|
| Message Format Adapters | 2-3 h | HIGH | Enables conversion between formats |
| useChat Hook Implementation | 3-4 h | HIGH | Core functionality |
| Jotai Integration | 2-3 h | HIGH | Preserves existing functionality |
| Feature Flag Integration | 1-2 h | MEDIUM | Safety net for rollback |
| Testing | 2-3 h | HIGH | Quality assurance |

**Total Time:** 8-12 hours

### Key Deliverables

1. **`useAIChat` Hook**
   - Wraps `useChat` from `@ai-sdk/react`
   - Handles message format conversion
   - Integrates with Jotai atoms
   - Supports feature flag toggling

2. **Message Conversion Functions**
   - `aiMessageToMessage()` - AI SDK → Message
   - `messageToAIMessages()` - Message → AI SDK
   - `messagesToAIMessages()` - Batch conversion

3. **Jotai Integration**
   - Syncs messages to `messagesAtom`
   - Preserves plans/renders functionality
   - Maintains metadata

---

## Key Decisions Made

### Decision 1: Hook Abstraction Strategy
**Choice:** Thin wrapper (`useAIChat`)  
**Rationale:**
- Allows gradual migration
- Enables feature flag toggling
- Preserves access to AI SDK features
- Makes testing easier

**Impact:** Components can use hook without being tightly coupled to AI SDK

### Decision 2: Message Format Conversion Strategy
**Choice:** Convert on-the-fly with adapter functions  
**Rationale:**
- Keeps components using familiar `Message` type
- Single source of truth (AI SDK format)
- Conversion logic centralized
- Easier to test

**Impact:** Components don't need to know about AI SDK message format

### Decision 3: State Management Integration
**Choice:** Hybrid approach with sync  
**Rationale:**
- AI SDK manages chat messages
- Jotai still needed for plans, renders, workspace
- Sync `messagesAtom` for backward compatibility
- Clear separation of concerns

**Impact:** Gradual migration possible, no breaking changes

### Decision 4: Historical Messages Loading
**Choice:** Hybrid approach (load via server action, convert to AI SDK)  
**Rationale:**
- Reuse existing tested code
- Simpler than modifying backend
- Can optimize later if needed

**Impact:** Faster implementation, leverages existing infrastructure

---

## Implementation Strategy

### Timeline
```
Day 1 (4-6 hours):
├─ Phase 1: Message Format Adapters (2-3 h)
│   ├─ Create chat types file
│   ├─ Implement conversion functions
│   └─ Write unit tests
└─ Phase 2: Hook Implementation - Start (2-3 h)
    ├─ Set up hook structure
    ├─ Implement feature flag check
    └─ Implement initial messages loading

Day 2 (4-6 hours):
├─ Phase 2: Hook Implementation - Complete (2-3 h)
│   ├─ Configure useChat hook
│   ├─ Implement message conversion on stream
│   ├─ Implement onFinish handler
│   └─ Implement error handling
└─ Phase 3: Jotai Integration (2-3 h)
    ├─ Verify atom structure
    ├─ Test message sync
    ├─ Preserve plans/renders integration
    └─ Add metadata preservation

Day 3 (2-3 hours):
├─ Phase 4: Feature Flag Integration (1-2 h)
│   ├─ Update feature flag logic
│   └─ Test both paths
└─ Testing Phase (2-3 h)
    ├─ Unit tests
    ├─ Integration tests
    ├─ Manual testing
    └─ Performance testing
```

### Key Principle
**"Convert early, sync often"** - Convert AI SDK messages to our format as soon as they arrive, sync to Jotai atom immediately. This ensures components see updates in real-time and maintains backward compatibility.

---

## Success Metrics

### Quantitative
- [ ] Message conversion: <10ms per message
- [ ] Hook initialization: <100ms
- [ ] Memory: No leaks over 100 messages
- [ ] Test coverage: >80% for new code
- [ ] Zero critical bugs

### Qualitative
- [ ] Hook feels natural to use
- [ ] Message conversion preserves all data
- [ ] Plans/renders work seamlessly
- [ ] Feature flag provides safety net
- [ ] Code is maintainable and well-documented

---

## Risks Identified & Mitigated

### Risk 1: Message Format Mismatch 🟡 MEDIUM
**Issue:** AI SDK message format may not map cleanly to our Message type  
**Mitigation:**
- Comprehensive conversion tests
- Handle all message fields
- Preserve metadata in separate structure if needed
- Test with real messages from database

**Status:** Documented, needs careful implementation

### Risk 2: State Sync Conflicts 🟡 MEDIUM
**Issue:** AI SDK state and Jotai state may conflict  
**Mitigation:**
- Clear separation: AI SDK manages chat, Jotai manages plans/renders
- Sync only when feature flag enabled
- Test both implementations side-by-side
- Monitor for race conditions

**Status:** Documented, needs testing

### Risk 3: Performance Regression 🟢 LOW
**Issue:** Conversion overhead may slow streaming  
**Mitigation:**
- Benchmark conversion functions
- Use memoization for expensive operations
- Profile re-renders
- Optimize hot paths

**Status:** Low risk with proper optimization

### Risk 4: Feature Flag Complexity 🟢 LOW
**Issue:** Flag logic may be complex  
**Mitigation:**
- Keep flag logic simple
- Test both paths thoroughly
- Document flag usage
- Remove flag in PR#9

**Status:** Low risk

### Risk 5: Historical Messages Loading 🟢 LOW
**Issue:** Loading may be slow or incorrect  
**Mitigation:**
- Reuse existing server action
- Test with various message counts
- Handle empty history gracefully
- Optimize if needed

**Status:** Low risk

**Overall Risk:** MEDIUM - Main risks are around message format conversion and state sync, both are manageable with careful implementation and testing.

---

## Hot Tips

### Tip 1: Start with Conversion Functions
**Why:** These are the foundation. Get them right, and everything else flows naturally. Write tests first (TDD approach).

### Tip 2: Test with Real Data
**Why:** Don't just test with mock data. Load real messages from the database to ensure conversion handles all edge cases.

### Tip 3: Use TypeScript Strictly
**Why:** TypeScript will catch many conversion errors at compile time. Use strict mode and fix all type errors.

### Tip 4: Log Everything Initially
**Why:** Add console.logs during development to understand the flow. Remove them before committing.

### Tip 5: Test Feature Flag Early
**Why:** Don't wait until the end to test the feature flag. Test both paths as you build to catch issues early.

---

## Go / No-Go Decision

### Go If:
- ✅ PR#1 complete (AI SDK packages installed)
- ✅ PR#5 complete (`/api/chat` endpoint working)
- ✅ Feature flag infrastructure exists
- ✅ You have 8-12 hours available
- ✅ You understand React hooks and state management
- ✅ You're comfortable with TypeScript

### No-Go If:
- ❌ PR#1 or PR#5 not complete
- ❌ Feature flag infrastructure missing
- ❌ Time-constrained (<8 hours)
- ❌ Not familiar with React hooks
- ❌ Uncomfortable with TypeScript

**Decision Aid:** If prerequisites are met and you have the time, proceed! This is a critical integration PR that unlocks PR#7. If unsure, review PR#1 and PR#5 first.

---

## Immediate Next Actions

### Pre-Flight (5 minutes)
- [ ] Prerequisites checked (PR#1, PR#5 complete)
- [ ] Dependencies installed
- [ ] Environment configured
- [ ] Branch created: `feat/ai-sdk-use-chat`

### Day 1 Goals (4-6 hours)
- [ ] Read full specification (45 min)
- [ ] Set up environment (15 min)
- [ ] Start Phase 1: Message Format Adapters (2-3 h)
  - [ ] Create `lib/types/chat.ts`
  - [ ] Implement `aiMessageToMessage()`
  - [ ] Implement `messageToAIMessages()`
  - [ ] Implement `messagesToAIMessages()`
  - [ ] Write unit tests
- [ ] Start Phase 2: Hook Implementation (2-3 h)
  - [ ] Set up hook structure
  - [ ] Implement feature flag check
  - [ ] Implement initial messages loading

**Checkpoint:** Message conversion functions working, hook structure in place

---

## Conclusion

**Planning Status:** ✅ COMPLETE  
**Confidence Level:** HIGH  
**Recommendation:** **BUILD IT** - Prerequisites are clear, implementation is well-defined, risks are manageable.

**Next Step:** When ready, start with Phase 1 (Message Format Adapters). Follow the implementation checklist step-by-step.

---

**You've got this!** 💪

This PR is the **critical integration point** that makes the entire migration possible. The planning is comprehensive, the approach is sound, and the risks are manageable. Once this hook works, PR#7 (Chat UI Migration) becomes straightforward.

**Key insight:** This hook is the bridge between the old world (Centrifugo + Jotai) and the new world (AI SDK + HTTP SSE). Build the bridge carefully, test it thoroughly, and everything else will flow naturally.

---

*"Perfect is the enemy of good. Ship the hook, test it, iterate."*

