# PR#14: Remove Old Centrifugo Chat Handlers & Final Testing

**Estimated Time:** 4-6 hours  
**Complexity:** MEDIUM  
**Dependencies:** PR#13 (Remove feature flags & legacy code) must be complete  
**Success Criteria:** G1, G3, G6 (Replace chat UI with AI SDK, Maintain functionality, Tests pass)

---

## Overview

### What We're Building

This PR completes the Vercel AI SDK migration by removing all legacy Centrifugo-based chat streaming code. After this PR, chat messages will flow exclusively through the AI SDK HTTP SSE protocol, and Centrifugo will only be used for non-chat events (plans, renders, artifacts).

**Key Activities:**
1. **Remove frontend chat handlers** - Delete `handleChatMessageUpdated` and `chatmessage-updated` event handling from `useCentrifugo.ts`
2. **Remove extension chat handlers** - Delete chat message handling from VS Code extension WebSocket module
3. **Remove backend Centrifugo streaming** - Remove the old Centrifugo streaming path from `pkg/listener/conversational.go`
4. **Clean up event types** - Remove or deprecate `ChatMessageUpdatedEvent` if no longer needed
5. **Comprehensive final testing** - Validate all functionality works correctly after cleanup

### Why It Matters

This PR represents the final cleanup step of the migration. Removing legacy code:
- **Reduces maintenance burden** - No need to maintain two streaming implementations
- **Eliminates confusion** - Clear single path for chat messages
- **Reduces bundle size** - Removes unused code paths
- **Improves code clarity** - Simpler, easier to understand architecture
- **Completes the migration** - Migration is not truly complete until old code is removed

### Success in One Sentence

"This PR is successful when all Centrifugo chat handlers are removed, chat functionality works identically via AI SDK, all tests pass, and no legacy chat code remains."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Complete Removal vs. Deprecation
**Options Considered:**
1. **Complete removal** - Delete all chat-related Centrifugo code immediately
2. **Deprecation with removal later** - Mark as deprecated, remove in future PR
3. **Conditional removal** - Keep code but make it unreachable

**Chosen:** Complete removal

**Rationale:**
- Migration is complete and validated (PR#13)
- Feature flags already removed (PR#13)
- No need to maintain dead code
- Cleaner codebase is easier to maintain
- If issues arise, we can rollback entire migration via git

**Trade-offs:**
- Gain: Simpler codebase, no confusion
- Lose: Cannot easily rollback just this PR (but can rollback entire migration)

#### Decision 2: Event Type Cleanup Strategy
**Options Considered:**
1. **Remove `ChatMessageUpdatedEvent` entirely** - Delete type and all references
2. **Keep type but mark deprecated** - Leave for potential future use
3. **Move to deprecated package** - Archive for reference

**Chosen:** Remove entirely (if only used for chat)

**Rationale:**
- If event type is only used for chat, it's dead code
- If used elsewhere, we'll discover during removal
- Clean removal is better than deprecated code
- Can always reference git history if needed

**Trade-offs:**
- Gain: No dead code
- Lose: Cannot reference old implementation easily (but git history exists)

#### Decision 3: Testing Strategy
**Options Considered:**
1. **Minimal testing** - Just verify chat works
2. **Comprehensive testing** - Test all chat flows, edge cases, integration
3. **Regression testing** - Test everything that could be affected

**Chosen:** Comprehensive testing

**Rationale:**
- This is final cleanup PR - need high confidence
- Removing code paths can have unexpected side effects
- Need to validate Centrifugo still works for non-chat events
- Migration success depends on this working correctly

**Trade-offs:**
- Gain: High confidence in correctness
- Lose: More time spent testing

### Code Removal Map

#### Frontend (`chartsmith-app/`)

**File: `hooks/useCentrifugo.ts`**
- **Remove:** `handleChatMessageUpdated` function (lines ~89-150)
- **Remove:** `chatmessage-updated` case from `handleCentrifugoMessage` (line ~452-453)
- **Remove:** `handleChatMessageUpdated` from dependency array (line ~474)
- **Keep:** All other event handlers (plan-updated, render-stream, etc.)

**Impact:** ~60 lines removed

#### Extension (`chartsmith-extension/`)

**File: `src/modules/webSocket/index.ts`**
- **Remove:** `handleChatMessageUpdated` function (lines ~104-120)
- **Remove:** `chatmessage-updated` case from `handleWebSocketMessage` (lines ~84-86)
- **Keep:** All other event handlers

**Impact:** ~20 lines removed

#### Backend (`pkg/`)

**File: `pkg/listener/conversational.go`**
- **Remove:** Centrifugo streaming path (lines ~70-79)
  - Remove `ChatMessageUpdatedEvent` creation
  - Remove `realtime.SendEvent` call for chat updates
- **Keep:** Database updates (lines ~82-84)
- **Keep:** Render job creation (lines ~96-99)
- **Note:** This file may have been modified in earlier PRs - verify current state

**Impact:** ~10 lines removed

**File: `pkg/realtime/types/chatmessage-updated.go`**
- **Check:** Is `ChatMessageUpdatedEvent` used elsewhere?
- **Action:** If only used for chat, remove entire file
- **Action:** If used for other purposes, keep but document

**Impact:** ~20 lines potentially removed

**File: `pkg/listener/new_intent.go`**
- **Check:** Does this file send `ChatMessageUpdatedEvent`?
- **Action:** If yes, remove those calls (chat now handled via AI SDK)
- **Action:** Verify intent classification still works

**Impact:** Variable (need to check)

### What Stays the Same

#### Critical Preservations
- ✅ **Centrifugo for non-chat events** - Plans, renders, artifacts still use Centrifugo
- ✅ **Database operations** - Chat message persistence unchanged
- ✅ **Render job creation** - Still triggered after chat completion
- ✅ **Intent classification** - Still routes to appropriate handlers
- ✅ **All other event handlers** - Plan updates, render streams, etc. unchanged

#### Unchanged Components
- Go worker LLM orchestration
- Plan generation and execution
- Render job processing
- File artifact updates
- Centrifugo connection and subscription logic (for non-chat events)

---

## Implementation Details

### File Structure

**Files to Modify:**
```
chartsmith-app/hooks/useCentrifugo.ts (~60 lines removed)
chartsmith-extension/src/modules/webSocket/index.ts (~20 lines removed)
pkg/listener/conversational.go (~10 lines removed)
pkg/realtime/types/chatmessage-updated.go (potentially removed)
pkg/listener/new_intent.go (check and potentially modify)
```

**Files to Create:**
```
(None - this is a removal PR)
```

**Files to Test:**
```
All chat-related components
All Centrifugo event handlers (non-chat)
Integration tests
E2E tests
```

### Key Implementation Steps

#### Phase 1: Frontend Cleanup (1-2 hours)

**Step 1.1: Remove Chat Handler from useCentrifugo**
- Remove `handleChatMessageUpdated` function
- Remove `chatmessage-updated` case from event router
- Remove from dependency arrays
- Verify TypeScript compiles
- Verify no broken references

**Step 1.2: Test Frontend**
- Verify chat still works via AI SDK
- Verify other Centrifugo events still work (plans, renders)
- Check for console errors
- Verify no memory leaks

#### Phase 2: Extension Cleanup (30 minutes)

**Step 2.1: Remove Chat Handler from Extension**
- Remove `handleChatMessageUpdated` function
- Remove `chatmessage-updated` case from event router
- Verify TypeScript compiles
- Verify no broken references

**Step 2.2: Test Extension**
- Verify extension chat still works (if applicable)
- Verify other events still work
- Check for errors

#### Phase 3: Backend Cleanup (1-2 hours)

**Step 3.1: Remove Centrifugo Streaming from Conversational Handler**
- Remove `ChatMessageUpdatedEvent` creation
- Remove `realtime.SendEvent` call for chat
- Keep database updates
- Keep render job creation
- Verify Go compiles

**Step 3.2: Check Other Files**
- Search for `ChatMessageUpdatedEvent` usage
- Remove from `new_intent.go` if present
- Verify intent classification still works

**Step 3.3: Remove Event Type (if safe)**
- Check if `ChatMessageUpdatedEvent` is used elsewhere
- If only used for chat, remove `chatmessage-updated.go`
- Update imports if needed
- Verify Go compiles

#### Phase 4: Testing & Validation (2-3 hours)

**Step 4.1: Unit Tests**
- Run all unit tests
- Update tests that reference removed code
- Add tests for edge cases
- Verify test coverage maintained

**Step 4.2: Integration Tests**
- Test chat flow end-to-end
- Test Centrifugo events (plans, renders)
- Test error scenarios
- Test concurrent operations

**Step 4.3: Manual Testing**
- Chat functionality
- Plan generation
- Render jobs
- File updates
- Error handling
- Performance

**Step 4.4: Regression Testing**
- All existing features
- All user workflows
- Edge cases
- Error scenarios

### Code Examples

#### Before: Frontend Chat Handler

```typescript
// ❌ REMOVE THIS
const handleChatMessageUpdated = useCallback((data: CentrifugoMessageData) => {
  if (!data.chatMessage) return;
  
  const chatMessage = data.chatMessage;
  // ... update messages state ...
  setMessages(prev => {
    // ... message update logic ...
  });
}, [setMessages, setActiveRenderIds]);

// ❌ REMOVE THIS CASE
} else if (eventType === 'chatmessage-updated') {
  handleChatMessageUpdated(message.data);
}
```

#### After: Frontend (Chat Removed)

```typescript
// ✅ Chat now handled by useChat hook (AI SDK)
// No Centrifugo handler needed for chat

// ✅ Other events still handled
} else if (eventType === 'plan-updated') {
  handlePlanUpdated(message.data);
} else if (eventType === 'render-stream') {
  handleRenderStreamEvent(message.data);
}
// ... other events ...
```

#### Before: Backend Centrifugo Streaming

```go
// ❌ REMOVE THIS
case stream := <-streamCh:
    buffer.WriteString(stream)
    
    chatMessage.Response = buffer.String()
    e := realtimetypes.ChatMessageUpdatedEvent{
        WorkspaceID: w.ID,
        ChatMessage: chatMessage,
    }
    
    if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
        return fmt.Errorf("failed to send chat message update: %w", err)
    }
    
    // ✅ KEEP THIS - Database update still needed
    if err := workspace.AppendChatMessageResponse(ctx, chatMessage.ID, stream); err != nil {
        return fmt.Errorf("failed to write chat message response to database: %w", err)
    }
```

#### After: Backend (Centrifugo Removed, DB Kept)

```go
// ✅ Chat streaming now handled by AI SDK endpoint
// ✅ Database updates still happen (via AI SDK path)

case stream := <-streamCh:
    // Database update happens in AI SDK adapter
    // No Centrifugo event needed
    buffer.WriteString(stream)
    
    // ✅ KEEP - Database update (if not handled by AI SDK adapter)
    if err := workspace.AppendChatMessageResponse(ctx, chatMessage.ID, stream); err != nil {
        return fmt.Errorf("failed to write chat message response to database: %w", err)
    }
```

---

## Testing Strategy

### Test Categories

#### 1. Chat Functionality Tests
- **Test:** Send chat message
  - Expected: Message appears in UI via AI SDK
  - Actual: [Record result]
  
- **Test:** Receive streaming response
  - Expected: Text streams token-by-token smoothly
  - Actual: [Record result]
  
- **Test:** Complete chat message
  - Expected: Message marked as complete, render job created
  - Actual: [Record result]
  
- **Test:** Chat history loads
  - Expected: Previous messages load correctly
  - Actual: [Record result]

#### 2. Centrifugo Event Tests (Non-Chat)
- **Test:** Plan update event
  - Expected: Plan updates appear in UI
  - Actual: [Record result]
  
- **Test:** Render stream event
  - Expected: Render progress updates in real-time
  - Actual: [Record result]
  
- **Test:** Artifact update event
  - Expected: File updates appear in workspace
  - Actual: [Record result]

#### 3. Integration Tests
- **Test:** Chat → Render flow
  - Expected: Chat completes, render job starts, updates via Centrifugo
  - Actual: [Record result]
  
- **Test:** Plan → Execute flow
  - Expected: Plan created, execution updates via Centrifugo
  - Actual: [Record result]

#### 4. Error Handling Tests
- **Test:** Network error during chat
  - Expected: Error handled gracefully, user notified
  - Actual: [Record result]
  
- **Test:** Centrifugo disconnection
  - Expected: Non-chat events still work when reconnected
  - Actual: [Record result]

#### 5. Performance Tests
- **Test:** Chat response time
  - Expected: Same or better than before
  - Actual: [Record result]
  
- **Test:** Bundle size
  - Expected: Smaller than before (removed code)
  - Actual: [Record result]

### Edge Cases

- **Empty chat message** - Should handle gracefully
- **Very long chat response** - Should stream correctly
- **Concurrent chat messages** - Should handle correctly
- **Chat during render** - Should not interfere
- **Chat during plan execution** - Should not interfere

---

## Success Criteria

**Feature is complete when:**
- [ ] All Centrifugo chat handlers removed from frontend
- [ ] All Centrifugo chat handlers removed from extension
- [ ] All Centrifugo chat streaming removed from backend
- [ ] `ChatMessageUpdatedEvent` removed (if only used for chat)
- [ ] Chat functionality works identically via AI SDK
- [ ] All Centrifugo non-chat events still work (plans, renders)
- [ ] All tests pass
- [ ] No console errors
- [ ] No TypeScript/Go compilation errors
- [ ] Bundle size reduced (measurable)
- [ ] Code review approved
- [ ] Documentation updated

**Performance Targets:**
- Chat response time: Same or better than before
- Bundle size: Smaller than before (removed ~100 lines)
- Memory usage: Same or better

**Quality Gates:**
- Zero regressions
- All existing features work
- Test coverage maintained or improved
- No dead code remaining

---

## Risk Assessment

### Risk 1: Breaking Non-Chat Centrifugo Events
**Likelihood:** LOW  
**Impact:** HIGH  
**Mitigation:**
- Comprehensive testing of all Centrifugo events
- Clear separation between chat and non-chat handlers
- Feature flag already removed (PR#13) - code path validated
- Can rollback entire migration if needed

**Status:** 🟢 LOW RISK

### Risk 2: Missing Edge Cases in Removal
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Thorough code search for all references
- Comprehensive testing
- Code review by multiple developers
- Gradual removal (frontend → extension → backend)

**Status:** 🟡 MEDIUM RISK

### Risk 3: Database Updates Not Happening
**Likelihood:** LOW  
**Impact:** HIGH  
**Mitigation:**
- Verify database updates happen in AI SDK adapter
- Test chat message persistence
- Check database after chat completion
- Integration tests validate persistence

**Status:** 🟢 LOW RISK

### Risk 4: Render Jobs Not Created
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:**
- Verify render job creation code still present
- Test chat → render flow
- Check render jobs appear after chat
- Integration tests validate flow

**Status:** 🟢 LOW RISK

### Risk 5: Extension Functionality Broken
**Likelihood:** LOW  
**Impact:** LOW  
**Mitigation:**
- Extension may not use chat (verify)
- Test extension if it uses chat
- Extension can be fixed separately if needed

**Status:** 🟢 LOW RISK

---

## Open Questions

1. **Question 1:** Is `ChatMessageUpdatedEvent` used anywhere besides chat?
   - **Investigation:** Search codebase for all references
   - **Decision:** Remove if only used for chat, keep if used elsewhere
   - **Decision needed by:** Phase 3

2. **Question 2:** Does the extension actually use chat functionality?
   - **Investigation:** Check extension code and usage
   - **Decision:** Remove if unused, test if used
   - **Decision needed by:** Phase 2

3. **Question 3:** Are database updates handled in AI SDK adapter or conversational handler?
   - **Investigation:** Check PR#6 implementation
   - **Decision:** Ensure updates happen in correct place
   - **Decision needed by:** Phase 3

---

## Timeline

**Total Estimate:** 4-6 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Frontend cleanup | 1-2 h | ⏳ |
| 2 | Extension cleanup | 30 min | ⏳ |
| 3 | Backend cleanup | 1-2 h | ⏳ |
| 4 | Testing & validation | 2-3 h | ⏳ |

**Breakdown:**
- Code removal: 2-3 hours
- Testing: 2-3 hours
- **Total:** 4-6 hours

---

## Dependencies

**Requires:**
- [ ] PR#13 complete (feature flags removed, new is default)
- [ ] PR#6 complete (useChat hook implemented)
- [ ] PR#7 complete (Chat UI migrated)
- [ ] PR#8 complete (Tool calls working)
- [ ] All previous PRs merged and deployed

**Blocks:**
- Migration completion
- Documentation finalization
- Performance validation

---

## References

- **PRD:** `docs/PRD-vercel-ai-sdk-migration.md`
- **Architecture:** `docs/architecture-comparison.md`
- **PR#13:** Remove feature flags & legacy code
- **PR#6:** useChat hook implementation
- **PR#7:** Chat UI component migration
- **AI SDK Docs:** https://sdk.vercel.ai/docs

---

## Appendix

### A. Files to Search for References

```bash
# Search for chatmessage-updated
grep -r "chatmessage-updated" .

# Search for ChatMessageUpdatedEvent
grep -r "ChatMessageUpdatedEvent" .

# Search for handleChatMessageUpdated
grep -r "handleChatMessageUpdated" .
```

### B. Verification Checklist

After removal, verify:
- [ ] No references to `chatmessage-updated` in codebase
- [ ] No references to `ChatMessageUpdatedEvent` (if removed)
- [ ] No references to `handleChatMessageUpdated`
- [ ] TypeScript compiles without errors
- [ ] Go compiles without errors
- [ ] All tests pass
- [ ] Chat works via AI SDK
- [ ] Centrifugo events still work (non-chat)

### C. Rollback Plan

If issues arise:
1. **Immediate:** Revert this PR via git
2. **If migration issues:** Revert entire migration (PRs 1-14)
3. **Partial rollback:** Re-add specific handlers if needed
4. **Documentation:** Document any issues found

---

*This PR completes the Vercel AI SDK migration. After this, chat will flow exclusively through AI SDK, and Centrifugo will handle only non-chat events.*

