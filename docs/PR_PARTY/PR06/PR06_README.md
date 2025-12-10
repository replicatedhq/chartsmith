# PR#6: useChat Hook Implementation - Quick Start

---

## TL;DR (30 seconds)

**What:** Implement the `useAIChat` hook that wraps `useChat` from Vercel AI SDK, converts message formats, and integrates with existing Jotai atoms.

**Why:** This is the critical integration point that enables the frontend to use AI SDK patterns while preserving all existing functionality.

**Time:** 8-12 hours estimated

**Complexity:** MEDIUM-HIGH

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#1 complete (AI SDK packages installed)
- ✅ PR#5 complete (`/api/chat` endpoint working)
- ✅ Feature flag infrastructure exists
- ✅ You have 8-12 hours available
- ✅ You understand React hooks and state management
- ✅ You're comfortable with TypeScript

**Red Lights (Skip/defer it!):**
- ❌ PR#1 or PR#5 not complete
- ❌ Feature flag infrastructure missing
- ❌ Time-constrained (<8 hours)
- ❌ Not familiar with React hooks
- ❌ Uncomfortable with TypeScript

**Decision Aid:** If PR#1 and PR#5 are complete, and you have the time, proceed! This is a critical integration PR that unlocks PR#7.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#1 deployed and working (AI SDK packages installed)
- [ ] PR#5 deployed and working (`/api/chat` endpoint streaming AI SDK protocol)
- [ ] Feature flag `ENABLE_AI_SDK_CHAT` configured
- [ ] Knowledge: React hooks, TypeScript, Jotai atoms
- [ ] Understanding: AI SDK Data Stream Protocol

### Setup Commands
```bash
# 1. Ensure dependencies are installed
cd chartsmith-app
npm install

# 2. Verify feature flag is available
# Check .env or .env.local for NEXT_PUBLIC_ENABLE_AI_SDK_CHAT

# 3. Create branch
git checkout -b feat/ai-sdk-use-chat

# 4. Verify backend is running
# Go worker should be running with /api/v1/chat endpoint
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (45 minutes)
- [ ] Read this quick start (10 min)
- [ ] Read main specification (`PR06_USECHAT_HOOK_IMPLEMENTATION.md`) (30 min)
- [ ] Review implementation checklist (5 min)
- [ ] Note any questions or concerns

### Step 2: Set Up Environment (15 minutes)
- [ ] Run setup commands above
- [ ] Verify `/api/chat` endpoint works (test with curl or Postman)
- [ ] Open relevant files in editor:
  - `chartsmith-app/hooks/useAIChat.ts` (will create)
  - `chartsmith-app/lib/types/chat.ts` (will create)
  - `chartsmith-app/atoms/workspace.ts` (will modify)
  - `chartsmith-app/components/ChatContainer.tsx` (reference)

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Message Format Adapters
- [ ] Create `lib/types/chat.ts` file
- [ ] Commit when first function complete

---

## Daily Progress Template

### Day 1 Goals (4-6 hours)
- [ ] Phase 1: Message Format Adapters (2-3 h)
  - [ ] Create chat types file
  - [ ] Implement `aiMessageToMessage()`
  - [ ] Implement `messageToAIMessages()`
  - [ ] Implement `messagesToAIMessages()`
  - [ ] Write unit tests
- [ ] Phase 2: Hook Implementation - Start (2-3 h)
  - [ ] Set up hook structure
  - [ ] Implement feature flag check
  - [ ] Implement initial messages loading

**Checkpoint:** Message conversion functions working, hook structure in place

### Day 2 Goals (4-6 hours)
- [ ] Phase 2: Hook Implementation - Complete (2-3 h)
  - [ ] Configure useChat hook
  - [ ] Implement message conversion on stream
  - [ ] Implement onFinish handler
  - [ ] Implement error handling
- [ ] Phase 3: Jotai Integration (2-3 h)
  - [ ] Verify atom structure
  - [ ] Test message sync
  - [ ] Preserve plans/renders integration
  - [ ] Add metadata preservation

**Checkpoint:** Hook working end-to-end, messages syncing to atom

### Day 3 Goals (2-3 hours)
- [ ] Phase 4: Feature Flag Integration (1-2 h)
  - [ ] Update feature flag logic
  - [ ] Test both paths
- [ ] Testing Phase (2-3 h)
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] Manual testing
  - [ ] Performance testing

**Checkpoint:** All tests passing, ready for PR#7

---

## Common Issues & Solutions

### Issue 1: Message Format Mismatch
**Symptoms:** Conversion errors, missing fields, type errors  
**Cause:** AI SDK message format doesn't match our Message type  
**Solution:**
```typescript
// Ensure all fields are mapped correctly
// Check Message type definition in components/types.ts
// Add missing fields to MessageMetadata interface
```

### Issue 2: Messages Not Syncing to Atom
**Symptoms:** Messages appear in useChat but not in atom  
**Cause:** useEffect dependencies incorrect or sync logic wrong  
**Solution:**
```typescript
// Check useEffect dependencies
// Verify setMessages is called correctly
// Add console.log to debug sync flow
```

### Issue 3: Streaming Not Working
**Symptoms:** Messages don't update incrementally  
**Cause:** Conversion happening too late or not on every update  
**Solution:**
```typescript
// Ensure useEffect runs on every aiMessages change
// Check that isLoading state is handled correctly
// Verify isComplete is set correctly during streaming
```

### Issue 4: Feature Flag Not Working
**Symptoms:** Hook always uses new implementation  
**Cause:** Flag not read correctly or default value wrong  
**Solution:**
```typescript
// Check useFeatureFlag implementation
// Verify environment variable name
// Add console.log to verify flag value
```

### Issue 5: Plans/Renders Broken
**Symptoms:** Plans or renders don't work after hook implementation  
**Cause:** Metadata not preserved or Centrifugo conflicts  
**Solution:**
```typescript
// Ensure responsePlanId and responseRenderId preserved
// Verify Centrifugo still receives plan/render updates
// Check for race conditions between useChat and Centrifugo
```

---

## Quick Reference

### Key Files
- `chartsmith-app/hooks/useAIChat.ts` - Main hook implementation
- `chartsmith-app/lib/types/chat.ts` - Message conversion functions
- `chartsmith-app/atoms/workspace.ts` - Jotai atoms (messagesAtom)
- `chartsmith-app/components/ChatContainer.tsx` - Will use hook in PR#7

### Key Functions
- `useAIChat()` - Main hook, wraps useChat
- `aiMessageToMessage()` - Convert AI SDK → Message
- `messageToAIMessages()` - Convert Message → AI SDK
- `messagesToAIMessages()` - Batch conversion

### Key Concepts
- **AI SDK Message Format**: `{ role: 'user' | 'assistant', content: string, id: string }`
- **Our Message Format**: `{ id, prompt, response, isComplete, ...metadata }`
- **Hybrid State**: AI SDK manages chat, Jotai manages plans/renders
- **Feature Flag**: `ENABLE_AI_SDK_CHAT` controls which implementation

### Useful Commands
```bash
# Run tests
npm test -- hooks/useAIChat
npm test -- lib/types/chat

# Type check
npm run type-check

# Build
npm run build

# Start dev server
npm run dev
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] Hook sends messages to `/api/chat`
- [ ] Responses stream back incrementally
- [ ] Messages appear in `messagesAtom`
- [ ] Message format conversion preserves all fields
- [ ] Plans and renders still work
- [ ] Feature flag toggles correctly
- [ ] No console errors

**Performance Targets:**
- Message conversion: <10ms per message
- Hook initialization: <100ms
- Memory: No leaks over 100 messages

---

## Help & Support

### Stuck?
1. Check main planning doc for details
2. Review PR#1 and PR#5 implementations
3. Check AI SDK docs: https://sdk.vercel.ai/docs
4. Review `useChat` hook docs: https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
5. Search memory bank for patterns
6. Check architecture comparison doc

### Want to Skip a Feature?
- **Can skip:** Advanced error handling (can add in PR#7)
- **Can skip:** Tool call handling (handled in PR#8)
- **Cannot skip:** Message conversion (core functionality)
- **Cannot skip:** Jotai integration (required for components)

### Running Out of Time?
**Priority order:**
1. Message conversion functions (critical)
2. Basic hook implementation (critical)
3. Jotai sync (critical)
4. Feature flag (can simplify)
5. Advanced error handling (can defer)
6. Performance optimization (can defer)

---

## Motivation

**You've got this!** 💪

This PR is the **critical integration point** that makes the entire migration possible. Once this hook works, PR#7 (Chat UI Migration) becomes straightforward - just swap out the old implementation for `useAIChat`.

The message conversion might seem complex, but it's just mapping between two formats. The Jotai integration ensures backward compatibility while we migrate. And the feature flag gives us a safety net.

**Key insight:** This hook is the bridge between the old world (Centrifugo + Jotai) and the new world (AI SDK + HTTP SSE). Once this bridge is built, everything else flows naturally.

---

## Next Steps

**When ready:**
1. Run prerequisites (5 min)
2. Read main spec (45 min)
3. Start Phase 1 from checklist
4. Commit early and often

**Status:** Ready to build! 🚀

**After completion:**
- PR#7 can proceed (Chat UI Component Migration)
- PR#8 can proceed in parallel (Tool Call Protocol Support)

