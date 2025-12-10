# PR#9: Remove Feature Flags & Legacy Code

**Estimated Time:** 3-5 hours  
**Complexity:** MEDIUM  
**Dependencies:** PR#1, PR#2, PR#3, PR#4, PR#5, PR#6, PR#7, PR#8 (All AI SDK features working)  
**Success Criteria:** G1, G2, G6 (Remove feature flags, remove legacy code, tests pass)

---

## Overview

### What We're Building

This PR completes the Vercel AI SDK migration by removing all temporary infrastructure and legacy code:

1. **Remove feature flags** - AI SDK chat is now the default (no flag needed)
2. **Remove old Centrifugo chat handlers** - Chat no longer uses Centrifugo WebSocket streaming
3. **Remove old streaming code paths** - Legacy conversational chat streaming code
4. **Clean up unused imports/types** - Remove dead code and unused dependencies
5. **Update documentation** - Remove references to feature flags and legacy implementations

### Why It Matters

After successfully migrating to AI SDK, maintaining both implementations creates:
- **Code complexity** - Two code paths to maintain and test
- **Bundle size** - Unused code increases bundle size
- **Confusion** - Feature flags add cognitive overhead
- **Technical debt** - Legacy code accumulates bugs and becomes harder to remove

This cleanup PR:
- Simplifies the codebase by removing ~500-1000 lines of legacy code
- Reduces bundle size by removing unused dependencies
- Eliminates feature flag complexity
- Makes the codebase easier to understand and maintain
- Completes the migration cleanly

### Success in One Sentence

"This PR is successful when feature flags are removed, all legacy chat code is deleted, AI SDK is the only implementation, and all tests pass."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Removal Strategy
**Options Considered:**
1. **Big bang removal** - Delete everything at once, test after
2. **Incremental removal** - Remove piece by piece with verification
3. **Keep as fallback** - Leave legacy code commented out

**Chosen:** Incremental removal with verification

**Rationale:**
- Safer approach - can verify each removal doesn't break anything
- Easier to debug if issues arise
- Can rollback individual changes if needed
- Clearer git history

**Trade-offs:**
- Gain: Safety, easier debugging, clear history
- Lose: Slightly more time (but worth it for safety)

#### Decision 2: Centrifugo Retention
**Options Considered:**
1. **Remove Centrifugo entirely** - Clean slate, but breaks plans/renders
2. **Keep Centrifugo for non-chat** - Hybrid approach
3. **Migrate everything off Centrifugo** - Out of scope

**Chosen:** Keep Centrifugo for non-chat events (plans, renders, artifacts)

**Rationale:**
- Plans and renders are async, long-running operations
- Centrifugo handles these well with pub/sub
- Chat is synchronous, user-initiated - perfect for HTTP streaming
- Separation of concerns: chat via AI SDK, events via Centrifugo

**Trade-offs:**
- Gain: Keep working async event system
- Lose: Still maintain Centrifugo (but it's needed anyway)

#### Decision 3: Feature Flag Removal Timing
**Options Considered:**
1. **Remove immediately** - Clean, but risky if issues found
2. **Keep flag but default to true** - Safe, but adds complexity
3. **Remove after validation period** - Safest, but delays cleanup

**Chosen:** Remove immediately (after PR#8 validation)

**Rationale:**
- PR#8 should have validated AI SDK works in production
- Feature flags add maintenance overhead
- Clean removal is better than keeping dead code
- Can always revert this PR if issues found

**Trade-offs:**
- Gain: Cleaner codebase immediately
- Lose: No easy rollback (but git revert is always available)

### Data Model

**No database changes** - This PR only removes code, not data structures.

### API Design

**No API changes** - This PR removes old endpoints, but doesn't change existing ones.

**Removed Endpoints:**
- Legacy chat streaming endpoints (if any)
- Feature flag check endpoints (if any)

**Kept Endpoints:**
- `/api/chat` - AI SDK streaming endpoint (from PR#5)
- All other existing endpoints unchanged

### Component Hierarchy

```
BEFORE (with feature flags):
ChatContainer.tsx
├── Checks featureFlags.enableAISDKChat
├── If true: useAIChat (AI SDK)
└── If false: useLegacyChat (Centrifugo)

AFTER (clean):
ChatContainer.tsx
└── useAIChat (AI SDK only)
```

---

## Implementation Details

### File Structure

**Files to Delete:**
```
chartsmith-app/
├── lib/
│   └── config/
│       └── feature-flags.ts (DELETE)
├── hooks/
│   └── useLegacyChat.ts (DELETE if exists)
└── components/
    ├── LegacyChatContainer.tsx (DELETE if exists)
    └── LegacyChatMessage.tsx (DELETE if exists)
```

**Files to Modify:**
```
chartsmith-app/
├── hooks/
│   ├── useAIChat.ts (remove feature flag check)
│   └── useCentrifugo.ts (remove chat subscription)
├── components/
│   ├── ChatContainer.tsx (remove feature flag conditional)
│   └── ChatMessage.tsx (remove legacy message handling)
�kg/
├── listener/
│   └── conversational.go (remove legacy streaming path)
└── api/
    └── routes.go (remove legacy chat routes if any)
```

**Environment Files:**
```
chartsmith-app/
├── .env.example (remove NEXT_PUBLIC_ENABLE_AI_SDK_CHAT)
└── .env.local (remove NEXT_PUBLIC_ENABLE_AI_SDK_CHAT)
```

### Key Implementation Steps

#### Phase 1: Pre-Removal Verification (30 minutes)
1. Verify AI SDK chat works in production/staging
2. Check feature flag is set to `true` everywhere
3. Verify no regressions reported
4. Run full test suite
5. Check bundle size baseline

#### Phase 2: Remove Feature Flag Infrastructure (45 minutes)
1. Remove `lib/config/feature-flags.ts`
2. Remove feature flag imports from all files
3. Remove feature flag conditionals
4. Update `.env.example` to remove flag
5. Remove flag from documentation

#### Phase 3: Remove Legacy Frontend Code (1 hour)
1. Remove chat subscription from `useCentrifugo.ts`
2. Remove `handleChatMessageUpdated` function (or keep only for render tracking)
3. Remove legacy chat components if they exist
4. Remove legacy chat hooks if they exist
5. Update `useAIChat.ts` to remove feature flag check

#### Phase 4: Remove Legacy Backend Code (1 hour)
1. Remove legacy conversational streaming from Go
2. Remove legacy chat routes
3. Remove Centrifugo chat publishing code
4. Keep Centrifugo for plans/renders/artifacts
5. Clean up unused imports

#### Phase 5: Cleanup & Verification (1 hour)
1. Remove unused imports
2. Remove unused types
3. Run linter and fix issues
4. Run full test suite
5. Verify bundle size reduced
6. Update documentation

### Code Examples

**Example 1: Removing Feature Flag Check**

```typescript
// BEFORE: hooks/useAIChat.ts
import { featureFlags } from '@/lib/config/feature-flags';

export function useAIChat(options: UseAIChatOptions) {
  const isEnabled = featureFlags.enableAISDKChat;
  
  if (!isEnabled) {
    // Legacy implementation
    return useLegacyChat(options);
  }
  
  // AI SDK implementation
  return useChat({ ... });
}

// AFTER: hooks/useAIChat.ts
export function useAIChat(options: UseAIChatOptions) {
  // AI SDK implementation only
  return useChat({ ... });
}
```

**Example 2: Removing Centrifugo Chat Subscription**

```typescript
// BEFORE: hooks/useCentrifugo.ts
useEffect(() => {
  // Chat subscription (REMOVE)
  const chatChannel = `workspace:${workspaceId}:chat`;
  const chatSub = centrifuge.subscribe(chatChannel, handleChatMessageUpdated);
  
  // Plan subscription (KEEP)
  const planChannel = `workspace:${workspaceId}:plan`;
  const planSub = centrifuge.subscribe(planChannel, handlePlanUpdated);
  
  // Render subscription (KEEP)
  const renderChannel = `workspace:${workspaceId}:render`;
  const renderSub = centrifuge.subscribe(renderChannel, handleRenderUpdated);
  
  return () => {
    chatSub.unsubscribe(); // REMOVE
    planSub.unsubscribe();
    renderSub.unsubscribe();
  };
}, [workspaceId]);

// AFTER: hooks/useCentrifugo.ts
useEffect(() => {
  // Plan subscription (KEEP)
  const planChannel = `workspace:${workspaceId}:plan`;
  const planSub = centrifuge.subscribe(planChannel, handlePlanUpdated);
  
  // Render subscription (KEEP)
  const renderChannel = `workspace:${workspaceId}:render`;
  const renderSub = centrifuge.subscribe(renderChannel, handleRenderUpdated);
  
  return () => {
    planSub.unsubscribe();
    renderSub.unsubscribe();
  };
}, [workspaceId]);
```

**Example 3: Removing Legacy Go Streaming**

```go
// BEFORE: pkg/listener/conversational.go
func HandleConversationalChat(ctx context.Context, ...) error {
    // Check feature flag
    if !isAISDKEnabled() {
        // Legacy Centrifugo streaming
        return streamViaCentrifugo(ctx, ...)
    }
    
    // AI SDK streaming
    return streamViaAISDK(ctx, ...)
}

// AFTER: pkg/listener/conversational.go
func HandleConversationalChat(ctx context.Context, ...) error {
    // AI SDK streaming only
    return streamViaAISDK(ctx, ...)
}
```

**Example 4: Removing Feature Flag from Component**

```typescript
// BEFORE: components/ChatContainer.tsx
import { featureFlags } from '@/lib/config/feature-flags';

export function ChatContainer(props: ChatContainerProps) {
  if (featureFlags.enableAISDKChat) {
    return <ChatContainerAISDK {...props} />;
  }
  return <LegacyChatContainer {...props} />;
}

// AFTER: components/ChatContainer.tsx
export function ChatContainer(props: ChatContainerProps) {
  return <ChatContainerAISDK {...props} />;
}
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- Verify feature flag file doesn't exist
- Verify no feature flag imports
- Verify useAIChat works without flag check
- Verify Centrifugo still works for plans/renders

**Integration Tests:**
- Chat flow works end-to-end
- Plans still update via Centrifugo
- Renders still update via Centrifugo
- No regressions in existing functionality

**Manual Testing:**
- Chat works in browser
- Streaming works correctly
- Plans appear correctly
- Renders appear correctly
- No console errors
- No TypeScript errors

**Bundle Size Testing:**
- Measure bundle size before
- Measure bundle size after
- Verify reduction (expected ~50-100KB)

### Edge Cases

- **Centrifugo still needed** - Verify plans/renders work
- **Message history** - Verify old messages still load
- **Error handling** - Verify errors still handled correctly
- **Concurrent users** - Verify no race conditions

---

## Success Criteria

**Feature is complete when:**
- [ ] Feature flag file deleted
- [ ] All feature flag references removed
- [ ] Legacy chat code removed
- [ ] Centrifugo chat subscription removed
- [ ] Legacy Go streaming code removed
- [ ] All tests pass
- [ ] Bundle size reduced
- [ ] No console errors
- [ ] Documentation updated
- [ ] Code review approved

**Performance Targets:**
- Bundle size: Reduced by 50-100KB
- Test pass rate: 100%
- No performance regressions

**Quality Gates:**
- Zero critical bugs
- All tests passing
- No console errors
- TypeScript strict mode passes
- Linter passes

---

## Risk Assessment

### Risk 1: Breaking Plans/Renders
**Likelihood:** LOW  
**Impact:** HIGH  
**Mitigation:** 
- Keep Centrifugo subscription code for plans/renders
- Test plans/renders thoroughly before removing chat code
- Verify Centrifugo channels are separate

**Status:** 🟢 LOW RISK

### Risk 2: Missing Legacy Code Path
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Comprehensive code search for feature flag references
- Use grep/ripgrep to find all occurrences
- Review git history to see what was added

**Status:** 🟡 MEDIUM RISK

### Risk 3: Bundle Size Not Reduced
**Likelihood:** LOW  
**Impact:** LOW  
**Mitigation:**
- Measure before/after
- Use bundle analyzer if needed
- Remove unused dependencies

**Status:** 🟢 LOW RISK

### Risk 4: Test Failures
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Run full test suite before starting
- Update tests that reference feature flags
- Fix tests incrementally

**Status:** 🟡 MEDIUM RISK

---

## Open Questions

1. **Question:** Should we keep feature flag infrastructure for future features?
   - **Option A:** Keep infrastructure, remove AI SDK flag
   - **Option B:** Remove entire feature flag system
   - **Decision:** Remove entire system (can add back if needed)

2. **Question:** Should we keep legacy code commented out for reference?
   - **Option A:** Keep commented code
   - **Option B:** Delete completely
   - **Decision:** Delete completely (git history has it)

---

## Timeline

**Total Estimate:** 3-5 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Pre-Removal Verification | 30 min | ⏳ |
| 2 | Remove Feature Flags | 45 min | ⏳ |
| 3 | Remove Legacy Frontend | 1 h | ⏳ |
| 4 | Remove Legacy Backend | 1 h | ⏳ |
| 5 | Cleanup & Verification | 1 h | ⏳ |

---

## Dependencies

**Requires:**
- [ ] PR#1 complete (AI SDK packages installed)
- [ ] PR#2 complete (Go AI SDK library)
- [ ] PR#3 complete (Streaming adapter)
- [ ] PR#4 complete (Chat endpoint)
- [ ] PR#5 complete (API route proxy)
- [ ] PR#6 complete (useChat hook)
- [ ] PR#7 complete (Chat UI migration)
- [ ] PR#8 complete (Tool calling)
- [ ] AI SDK chat validated in production

**Blocks:**
- PR#10 (Frontend Anthropic SDK removal) - Can work in parallel
- PR#11 (Documentation & Final Testing) - Should wait for this

---

## References

- Related PR: PR#1 (Feature flag infrastructure)
- Related PR: PR#6 (useChat implementation)
- Related PR: PR#7 (Chat UI migration)
- PRD: [Vercel AI SDK Migration](../PRD-vercel-ai-sdk-migration.md)
- Architecture: [Architecture Comparison](../architecture-comparison.md)

