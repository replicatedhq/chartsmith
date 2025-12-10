# PR#7: Chat UI Component Migration - Quick Start

---

## TL;DR (30 seconds)

**What:** Migrate `ChatContainer.tsx` and `ChatMessage.tsx` to use the new `useAIChat` hook from PR#6, replacing custom state management with Vercel AI SDK's `useChat` hook.

**Why:** Complete the frontend migration to Vercel AI SDK, providing improved streaming UX and standard patterns while preserving all existing functionality.

**Time:** 4-6 hours estimated

**Complexity:** MEDIUM

**Status:** 📋 PLANNED

**Dependencies:** PR#5 (API Route), PR#6 (useChat Hook) must be complete

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#5 is complete (API route `/api/chat` exists)
- ✅ PR#6 is complete (`useAIChat` hook exists and works)
- ✅ You have 4-6 hours available
- ✅ You're comfortable with React hooks and state management
- ✅ You understand the existing ChatContainer/ChatMessage components

**Red Lights (Skip/defer it!):**
- ❌ PR#5 or PR#6 not complete
- ❌ Time-constrained (<4 hours)
- ❌ Not familiar with React hooks
- ❌ Other priorities take precedence

**Decision Aid:** This PR is the final frontend integration step. If PR#5 and PR#6 are done, this is the natural next step. If not, complete those first.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#5 complete - `/api/chat` route exists and works
- [ ] PR#6 complete - `useAIChat` hook exists and works
- [ ] Feature flag infrastructure available (`isAISDKChatEnabled()`)
- [ ] Knowledge of React hooks (`useState`, `useEffect`, `useRef`)
- [ ] Understanding of Jotai atoms (used for state sync)

### Setup Commands
```bash
# 1. Verify PR#5 and PR#6 are merged
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feat/ai-sdk-chat-ui

# 3. Verify useAIChat hook exists
ls chartsmith-app/hooks/useAIChat.ts

# 4. Verify API route exists
ls chartsmith-app/app/api/chat/route.ts

# 5. Start dev server
cd chartsmith-app
npm run dev
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (45 minutes)
- [ ] Read this quick start (10 min) ✓
- [ ] Read main specification (30 min)
  - Understand architecture decisions
  - Review code examples
  - Note message format conversion
- [ ] Review implementation checklist (5 min)
  - Understand phases
  - Note testing requirements

### Step 2: Review Existing Code (15 minutes)
- [ ] Read `ChatContainer.tsx` current implementation
  - Understand state management
  - Note form handling
  - Review role selector
- [ ] Read `ChatMessage.tsx` current implementation
  - Understand message rendering
  - Note streaming text display
  - Review feature integrations
- [ ] Review `useAIChat.ts` hook (from PR#6)
  - Understand hook interface
  - Note return values
  - Check feature flag handling

### Step 3: Start Phase 1
- [ ] Open `ChatContainer.tsx` in editor
- [ ] Begin Phase 1.1: Add imports
- [ ] Follow checklist step-by-step
- [ ] Commit when task complete

---

## Daily Progress Template

### Day 1 Goals (4-6 hours)
- [ ] Phase 1: Update ChatContainer.tsx (2-3 hours)
  - [ ] Add useAIChat imports
  - [ ] Replace state management
  - [ ] Sync state to Jotai atoms
  - [ ] Update form handling
  - [ ] Update role selector
  - [ ] Update loading/error states
  - [ ] Handle new chart flow
  - [ ] Test ChatContainer
- [ ] Phase 2: Update ChatMessage.tsx (1-2 hours)
  - [ ] Verify message format
  - [ ] Update streaming text rendering
  - [ ] Preserve existing features
  - [ ] Handle edge cases
  - [ ] Test ChatMessage
- [ ] Phase 3: Integration Testing (1 hour)
  - [ ] End-to-end chat flow
  - [ ] Feature flag testing
  - [ ] Cross-component integration
  - [ ] Performance testing

**Checkpoint:** Chat UI components migrated and working with useAIChat hook

---

## Common Issues & Solutions

### Issue 1: useAIChat Hook Not Found
**Symptoms:** TypeScript error "Cannot find module '@/hooks/useAIChat'"  
**Cause:** PR#6 not complete or hook file missing  
**Solution:**
```bash
# Verify PR#6 is merged
git log --oneline | grep "useChat"

# If missing, complete PR#6 first
```

### Issue 2: Messages Not Syncing to Jotai Atoms
**Symptoms:** Messages appear in hook but not in UI  
**Cause:** Sync useEffect not working or dependencies wrong  
**Solution:**
```typescript
// Check useEffect dependencies
useEffect(() => {
  if (isAISDKChatEnabled() && aiChatHook?.messages && workspace) {
    const convertedMessages = aiChatHook.messages.map(msg => 
      convertAISDKMessageToMessage(msg, workspace.id)
    );
    setMessages(convertedMessages);
  }
}, [aiChatHook?.messages, workspace?.id, setMessages]); // Ensure all deps included
```

### Issue 3: Streaming Text Not Updating
**Symptoms:** Response appears all at once, not streaming  
**Cause:** Message conversion losing streaming updates  
**Solution:**
```typescript
// Ensure message.response updates trigger re-render
// Check if message object reference changes during streaming
// May need to use message ID + response text separately
```

### Issue 4: Role Selector Not Working
**Symptoms:** Role selection doesn't affect messages  
**Cause:** Role not passed to useAIChat hook  
**Solution:**
```typescript
// Pass role to hook
const aiChatHook = workspace ? useAIChat(
  workspace.id, 
  session, 
  selectedRole  // Ensure role is passed
) : null;
```

### Issue 5: Feature Flag Not Toggling
**Symptoms:** Flag change doesn't affect behavior  
**Cause:** Dev server needs restart or flag not read correctly  
**Solution:**
```bash
# Restart dev server after changing flag
# Check .env.local has correct value
NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true

# Verify flag is read
console.log('Flag:', isAISDKChatEnabled());
```

---

## Quick Reference

### Key Files
- `chartsmith-app/components/ChatContainer.tsx` - Main chat container component
- `chartsmith-app/components/ChatMessage.tsx` - Individual message component
- `chartsmith-app/hooks/useAIChat.ts` - AI SDK chat hook (from PR#6)
- `chartsmith-app/lib/config/feature-flags.ts` - Feature flag utilities

### Key Functions
- `useAIChat(workspaceId, session, role?)` - Main hook for chat functionality
- `convertAISDKMessageToMessage()` - Convert AI SDK message to Message type
- `isAISDKChatEnabled()` - Check if AI SDK chat is enabled

### Key Concepts
- **Message Format Conversion:** AI SDK messages need conversion to existing Message type
- **State Syncing:** Hook state synced to Jotai atoms for compatibility
- **Feature Flag:** Toggles between old (Centrifugo) and new (AI SDK) implementations

### Useful Commands
```bash
# Run dev server
cd chartsmith-app && npm run dev

# Run tests
npm test

# Type check
npm run type-check

# Build
npm run build
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] Chat input works identically to before
- [ ] Messages appear in list correctly
- [ ] Streaming text renders incrementally
- [ ] Role selector works
- [ ] Enter key submission works
- [ ] Disabled state during streaming works
- [ ] Error handling works
- [ ] Feature flag toggles between implementations
- [ ] No visual regressions
- [ ] No console errors

**Performance Targets:**
- Time-to-first-token: Same or better than current
- Streaming smoothness: No jank or flicker
- Memory usage: No leaks

---

## Help & Support

### Stuck?
1. Check main planning doc for details
2. Review PR#6 implementation (useAIChat hook)
3. Review PR#5 implementation (API route)
4. Check AI SDK documentation: https://sdk.vercel.ai/docs
5. Search memory bank for similar patterns

### Want to Skip a Feature?
- **Can Skip:** Advanced error handling (can add later)
- **Cannot Skip:** Basic chat functionality, streaming, role selector

### Running Out of Time?
**Priority Order:**
1. ChatContainer basic functionality (must have)
2. ChatMessage basic rendering (must have)
3. Streaming text (must have)
4. Role selector (should have)
5. Error handling (nice to have)
6. Edge cases (nice to have)

---

## Motivation

**You've got this!** 💪

This PR completes the frontend migration to Vercel AI SDK. You're connecting the UI layer to the streaming infrastructure built in previous PRs. The hard work (API route, hook implementation) is done - now it's about wiring it up!

**What's Already Built:**
- ✅ API route `/api/chat` (PR#5)
- ✅ `useAIChat` hook (PR#6)
- ✅ Feature flag infrastructure (PR#1)
- ✅ Backend streaming (PR#3, PR#4)

**What You're Building:**
- Chat UI components using the new hook
- Message format conversion
- State syncing for compatibility

**Why It Matters:**
- Users get improved streaming experience
- Code becomes more maintainable
- Foundation for provider switching
- Standard patterns instead of custom code

---

## Next Steps

**When ready:**
1. Verify prerequisites (5 min)
2. Read main spec (30 min)
3. Review existing code (15 min)
4. Start Phase 1 from checklist
5. Commit early and often

**Status:** Ready to build! 🚀

---

## Related Documentation

- [Main Specification](./PR07_CHAT_UI_COMPONENT_MIGRATION.md) - Full technical details
- [Implementation Checklist](./PR07_IMPLEMENTATION_CHECKLIST.md) - Step-by-step tasks
- [Planning Summary](./PR07_PLANNING_SUMMARY.md) - Key decisions and strategy
- [Testing Guide](./PR07_TESTING_GUIDE.md) - Test cases and acceptance criteria
- [PRD: Vercel AI SDK Migration](../../PRD-vercel-ai-sdk-migration.md) - Overall migration strategy

