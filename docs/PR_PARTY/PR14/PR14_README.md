# PR#14: Remove Old Centrifugo Chat Handlers - Quick Start

---

## TL;DR (30 seconds)

**What:** Remove all legacy Centrifugo-based chat streaming handlers from frontend, extension, and backend. Chat now flows exclusively through Vercel AI SDK HTTP SSE protocol.

**Why:** Complete the migration by removing dead code, reducing maintenance burden, and clarifying architecture.

**Time:** 4-6 hours estimated

**Complexity:** MEDIUM

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#13 complete (feature flags removed, new is default)
- ✅ PR#6 complete (useChat hook working)
- ✅ PR#7 complete (Chat UI migrated)
- ✅ All previous PRs merged and deployed
- ✅ Chat functionality validated via AI SDK
- ✅ Ready for final cleanup

**Red Lights (Skip/defer it!):**
- ❌ Previous PRs not complete
- ❌ Chat not working via AI SDK
- ❌ Feature flags still present
- ❌ Migration not validated
- ❌ Other priorities

**Decision Aid:** This PR should only be started after all previous migration PRs are complete and validated. If chat is working via AI SDK and feature flags are removed, proceed. If not, complete previous PRs first.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#13 complete (feature flags removed)
- [ ] PR#6 complete (useChat hook implemented)
- [ ] PR#7 complete (Chat UI migrated)
- [ ] PR#8 complete (Tool calls working)
- [ ] All previous PRs merged and deployed
- [ ] Chat functionality validated via AI SDK
- [ ] Access to codebase
- [ ] Git branch ready

### Setup Commands
```bash
# 1. Verify previous PRs complete
git log --oneline | grep -E "PR#(6|7|8|13)"

# 2. Create branch
git checkout -b feat/pr14-remove-centrifugo-chat-handlers

# 3. Verify chat works via AI SDK
# (Manual test - send a chat message and verify it works)
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (30 minutes)
- [ ] Read this quick start (5 min)
- [ ] Read main specification (20 min)
  - [ ] Understand what code needs to be removed
  - [ ] Review code removal map
  - [ ] Note any questions
- [ ] Review implementation checklist (5 min)
  - [ ] Understand phases
  - [ ] Note time estimates

### Step 2: Search for References (15 minutes)
- [ ] Search for `chatmessage-updated` references
  ```bash
  grep -r "chatmessage-updated" .
  ```
- [ ] Search for `handleChatMessageUpdated` references
  ```bash
  grep -r "handleChatMessageUpdated" .
  ```
- [ ] Search for `ChatMessageUpdatedEvent` references
  ```bash
  grep -r "ChatMessageUpdatedEvent" .
  ```
- [ ] Document all findings

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Frontend Cleanup
- [ ] Remove chat handler from `useCentrifugo.ts`
- [ ] Test frontend changes
- [ ] Commit when complete

---

## Daily Progress Template

### Day 1 Goals (4-6 hours)
- [ ] Phase 1: Frontend cleanup (1-2 h)
  - [ ] Remove chat handler from useCentrifugo.ts
  - [ ] Test frontend changes
- [ ] Phase 2: Extension cleanup (30 min)
  - [ ] Remove chat handler from extension
  - [ ] Test extension
- [ ] Phase 3: Backend cleanup (1-2 h)
  - [ ] Remove Centrifugo streaming from conversational handler
  - [ ] Remove event type (if safe)
  - [ ] Test backend changes
- [ ] Phase 4: Testing (2-3 h)
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] Manual testing
  - [ ] Regression testing

**Checkpoint:** All code removed, all tests passing ✓

---

## Common Issues & Solutions

### Issue 1: TypeScript Errors After Removal
**Symptoms:** TypeScript compilation errors after removing handlers  
**Cause:** Broken references or missing imports  
**Solution:**
```bash
# Check for broken references
cd chartsmith-app
npx tsc --noEmit

# Search for references
grep -r "handleChatMessageUpdated" .

# Remove or fix broken references
```

### Issue 2: Go Compilation Errors
**Symptoms:** Go build fails after removing event type  
**Cause:** Missing imports or broken references  
**Solution:**
```bash
# Check for broken references
go build ./pkg/...

# Search for references
grep -r "ChatMessageUpdatedEvent" .

# Remove or fix broken references
```

### Issue 3: Chat Not Working After Removal
**Symptoms:** Chat messages don't appear after removing handlers  
**Cause:** AI SDK not properly configured or previous PRs incomplete  
**Solution:**
- Verify PR#6 and PR#7 complete
- Verify useChat hook configured correctly
- Check browser console for errors
- Verify `/api/chat` endpoint works

### Issue 4: Centrifugo Events Broken
**Symptoms:** Plan/render updates not appearing after removal  
**Cause:** Accidentally removed non-chat handlers  
**Solution:**
- Verify only chat handlers removed
- Verify plan/render handlers still present
- Test Centrifugo connection
- Check event routing

### Issue 5: Tests Failing
**Symptoms:** Tests fail after removing handlers  
**Cause:** Tests reference removed code  
**Solution:**
- Update test mocks
- Remove chat handler mocks
- Update test expectations
- Verify test coverage maintained

---

## Quick Reference

### Key Files
- `chartsmith-app/hooks/useCentrifugo.ts` - Remove chat handler
- `chartsmith-extension/src/modules/webSocket/index.ts` - Remove chat handler
- `pkg/listener/conversational.go` - Remove Centrifugo streaming
- `pkg/realtime/types/chatmessage-updated.go` - Remove event type (if safe)

### Key Functions to Remove
- `handleChatMessageUpdated()` - Frontend chat handler
- `handleChatMessageUpdated()` - Extension chat handler
- `ChatMessageUpdatedEvent` creation - Backend event creation
- `chatmessage-updated` event case - Event routing

### Key Concepts
- **Chat via AI SDK**: Chat messages now flow through HTTP SSE, not Centrifugo
- **Centrifugo for non-chat**: Plans, renders, artifacts still use Centrifugo
- **Clean removal**: Remove all chat-related Centrifugo code
- **Preserve critical code**: Keep database updates and render job creation

### Useful Commands
```bash
# Search for references
grep -r "chatmessage-updated" .
grep -r "handleChatMessageUpdated" .
grep -r "ChatMessageUpdatedEvent" .

# Type check
cd chartsmith-app && npx tsc --noEmit
cd chartsmith-extension && npx tsc --noEmit

# Build
cd chartsmith-app && npm run build
go build ./pkg/...

# Test
cd chartsmith-app && npm run test
go test ./pkg/...
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] Chat messages work via AI SDK (not Centrifugo)
- [ ] Plan/render updates still work via Centrifugo
- [ ] No references to `chatmessage-updated` in codebase
- [ ] No references to `handleChatMessageUpdated` in codebase
- [ ] No references to `ChatMessageUpdatedEvent` (if removed)
- [ ] All tests pass
- [ ] Bundle size reduced
- [ ] No console errors

**Performance Targets:**
- Chat response time: Same or better than before
- Bundle size: Smaller than before (removed ~100 lines)
- Memory usage: Same or better

---

## Help & Support

### Stuck?
1. Check main planning doc for details
2. Review implementation checklist for step-by-step guidance
3. Search codebase for similar patterns
4. Check previous PRs (PR#6, PR#7, PR#13) for context
5. Review architecture comparison doc

### Want to Skip Something?
**Don't skip:**
- Removing chat handlers (core of this PR)
- Testing (critical for validation)
- Verification (ensures correctness)

**Can defer:**
- Event type removal (if used elsewhere)
- Documentation updates (can do in follow-up)
- Performance optimization (if not critical)

### Running Out of Time?
**Priority order:**
1. Remove frontend chat handler (highest impact)
2. Remove backend Centrifugo streaming (completes migration)
3. Testing (validates correctness)
4. Extension cleanup (lower priority)
5. Event type removal (can defer if used elsewhere)

---

## Motivation

**You've got this!** 💪

This is the final cleanup PR of the migration. You've already:
- ✅ Installed AI SDK packages
- ✅ Implemented useChat hook
- ✅ Migrated Chat UI components
- ✅ Validated chat works via AI SDK
- ✅ Removed feature flags

Now it's time to remove the old code and complete the migration. This PR will:
- Clean up the codebase
- Reduce maintenance burden
- Clarify the architecture
- Complete the migration

**The finish line is in sight!** 🏁

---

## Next Steps

**When ready:**
1. Verify prerequisites (5 min)
2. Read main spec (30 min)
3. Search for references (15 min)
4. Start Phase 1: Frontend cleanup
5. Follow implementation checklist step-by-step
6. Test thoroughly
7. Celebrate completion! 🎉

**Status:** Ready to build! 🚀

---

## Related Documentation

- **Main Spec:** `PR14_REMOVE_CENTRIFUGO_CHAT_HANDLERS.md`
- **Checklist:** `PR14_IMPLEMENTATION_CHECKLIST.md`
- **Testing Guide:** `PR14_TESTING_GUIDE.md`
- **Planning Summary:** `PR14_PLANNING_SUMMARY.md`
- **PRD:** `../PRD-vercel-ai-sdk-migration.md`
- **Architecture:** `../architecture-comparison.md`

---

*This PR completes the Vercel AI SDK migration. After this, chat flows exclusively through AI SDK, and Centrifugo handles only non-chat events.*

