# PR#9: Remove Feature Flags & Legacy Code - Quick Start

---

## TL;DR (30 seconds)

**What:** Remove feature flags, legacy Centrifugo chat handlers, and old streaming code paths after successful AI SDK migration.

**Why:** Clean up codebase by removing ~500-1000 lines of legacy code, reduce bundle size, eliminate feature flag complexity, and complete the migration cleanly.

**Time:** 3-5 hours estimated

**Complexity:** MEDIUM

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#1-8 all complete and merged
- ✅ AI SDK chat validated in production/staging
- ✅ Feature flag set to `true` everywhere
- ✅ No regressions reported
- ✅ You have 3-5 hours available
- ✅ Comfortable with code removal and cleanup

**Red Lights (Skip/defer it!):**
- ❌ PR#1-8 not all complete
- ❌ AI SDK chat not yet validated
- ❌ Regressions still being fixed
- ❌ Time-constrained (<3 hours)
- ❌ Not comfortable removing code
- ❌ Prefer to keep legacy code as fallback

**Decision Aid:** This is a cleanup PR that should only be done after the migration is proven stable. If AI SDK chat is working well in production and you're confident, proceed. If unsure, wait until you have more confidence.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#1 complete (AI SDK packages installed)
- [ ] PR#2 complete (Go AI SDK library)
- [ ] PR#3 complete (Streaming adapter)
- [ ] PR#4 complete (Chat endpoint)
- [ ] PR#5 complete (API route proxy)
- [ ] PR#6 complete (useChat hook)
- [ ] PR#7 complete (Chat UI migration)
- [ ] PR#8 complete (Tool calling)
- [ ] AI SDK chat validated in production/staging
- [ ] Feature flag set to `true` everywhere
- [ ] No regressions reported

### Recommended
- [ ] Read [PRD: Vercel AI SDK Migration](../../PRD-vercel-ai-sdk-migration.md) - Understand overall migration
- [ ] Read [Architecture Comparison](../../architecture-comparison.md) - Understand before/after
- [ ] Review PR#1-8 documentation - Understand what was built
- [ ] Familiarity with codebase structure

### Setup Commands
```bash
# 1. Verify all previous PRs are merged
git log --oneline | grep -E "pr[0-9]|PR[0-9]"

# 2. Verify AI SDK chat works
# (Test in browser)

# 3. Create branch
git checkout -b feat/ai-sdk-cleanup

# 4. Take baseline measurements
cd chartsmith-app
npm run build
# Note bundle size
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (30 minutes)
- [ ] Read this quick start (5 min) ✓
- [ ] Read main specification (20 min)
  - [ ] Understand what code to remove
  - [ ] Note key files to modify
  - [ ] Review code examples
- [ ] Review implementation checklist (5 min)
  - [ ] Understand phase structure
  - [ ] Note testing checkpoints

### Step 2: Verify Prerequisites (15 minutes)
- [ ] Verify PR#1-8 are complete
- [ ] Test AI SDK chat in browser
- [ ] Verify plans/renders still work
- [ ] Run test suite (baseline)

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Pre-Removal Verification
- [ ] Follow checklist step-by-step
- [ ] Commit when phase complete

---

## Daily Progress Template

### Day 1 Goals (3-5 hours)
- [ ] Phase 1: Pre-Removal Verification (30 min)
- [ ] Phase 2: Remove Feature Flags (45 min)
- [ ] Phase 3: Remove Legacy Frontend (1 h)
- [ ] Phase 4: Remove Legacy Backend (1 h)
- [ ] Phase 5: Cleanup & Verification (1 h)

**Checkpoint:** All legacy code removed, tests passing, bundle size reduced

---

## Common Issues & Solutions

### Issue 1: Can't find feature flag references
**Symptoms:** Grep doesn't find all references  
**Cause:** Feature flags might be in different formats or locations  
**Solution:**
```bash
# Try multiple search patterns
grep -r "feature-flags" --include="*.ts" --include="*.tsx"
grep -r "featureFlags" --include="*.ts" --include="*.tsx"
grep -r "enableAISDKChat" --include="*.ts" --include="*.tsx"
grep -r "ENABLE_AI_SDK_CHAT" --include="*"

# Check git history to see where flags were added
git log --all --full-history -- "**/feature-flags.ts"
```

### Issue 2: Plans/renders stop working after removing chat code
**Symptoms:** Plans and renders don't update  
**Cause:** Accidentally removed Centrifugo code needed for plans/renders  
**Solution:**
```typescript
// Make sure you KEEP plan/render subscriptions
// Only REMOVE chat subscription

// KEEP:
const planChannel = `workspace:${workspaceId}:plan`;
const planSub = centrifuge.subscribe(planChannel, handlePlanUpdated);

const renderChannel = `workspace:${workspaceId}:render`;
const renderSub = centrifuge.subscribe(renderChannel, handleRenderUpdated);

// REMOVE:
const chatChannel = `workspace:${workspaceId}:chat`;
const chatSub = centrifuge.subscribe(chatChannel, handleChatMessageUpdated);
```

### Issue 3: Tests fail after removing feature flags
**Symptoms:** Tests reference feature flags that no longer exist  
**Cause:** Tests weren't updated to remove feature flag checks  
**Solution:**
```typescript
// BEFORE (in test):
import { featureFlags } from '@/lib/config/feature-flags';
expect(featureFlags.enableAISDKChat).toBe(true);

// AFTER (in test):
// Remove feature flag test
// Test actual functionality instead
expect(chatHook).toBeDefined();
expect(chatHook.messages).toBeDefined();
```

### Issue 4: Bundle size not reduced
**Symptoms:** Bundle size same or larger after cleanup  
**Cause:** Unused dependencies not removed, or new code added  
**Solution:**
```bash
# Check for unused dependencies
npm run build
npx webpack-bundle-analyzer .next/static/chunks/*.js

# Remove unused dependencies
npm uninstall [package-name]

# Verify reduction
npm run build
```

### Issue 5: TypeScript errors after removing code
**Symptoms:** Type errors for removed types  
**Cause:** Types still referenced somewhere  
**Solution:**
```bash
# Find all references to removed type
grep -r "LegacyChat" --include="*.ts" --include="*.tsx"

# Remove or update references
# Run type check
npx tsc --noEmit
```

---

## Quick Reference

### Key Files to Modify
- `chartsmith-app/lib/config/feature-flags.ts` - DELETE
- `chartsmith-app/hooks/useAIChat.ts` - Remove flag check
- `chartsmith-app/hooks/useCentrifugo.ts` - Remove chat subscription
- `chartsmith-app/components/ChatContainer.tsx` - Remove flag conditional
- `pkg/listener/conversational.go` - Remove legacy streaming
- `pkg/realtime/centrifugo.go` - Remove chat methods

### Key Functions to Remove/Update
- `featureFlags.enableAISDKChat` - REMOVE
- `handleChatMessageUpdated` - REMOVE or RENAME (if used for renders)
- Legacy chat streaming functions - REMOVE
- Feature flag conditionals - REMOVE

### Key Concepts
- **Feature Flags:** Temporary infrastructure for safe rollout - no longer needed
- **Centrifugo:** Still used for plans/renders - only remove chat subscription
- **Legacy Code:** Old implementation that's been replaced - safe to remove

### Useful Commands
```bash
# Find feature flag references
grep -r "featureFlags" --include="*.ts" --include="*.tsx"

# Find Centrifugo chat code
grep -r "chat.*channel" --include="*.ts" --include="*.tsx" -i

# Run tests
npm test
go test ./...

# Check bundle size
npm run build
ls -lh .next/static/chunks/

# Type check
npx tsc --noEmit
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] Feature flag file doesn't exist
- [ ] No feature flag references in code
- [ ] Chat works via AI SDK only
- [ ] Plans/renders still work via Centrifugo
- [ ] All tests pass
- [ ] Bundle size reduced
- [ ] No console errors

**Performance Targets:**
- Bundle size: Reduced by 50-100KB
- Test pass rate: 100%
- No performance regressions

---

## Help & Support

### Stuck?
1. Check main planning doc for details
2. Review PR#1-8 to understand what was built
3. Check git history to see what was added
4. Search codebase for similar patterns

### Want to Skip Something?
- **Can skip:** Documentation updates (can do later)
- **Can't skip:** Feature flag removal, legacy code removal, tests

### Running Out of Time?
- **Priority 1:** Remove feature flags (safest, biggest impact)
- **Priority 2:** Remove legacy frontend code
- **Priority 3:** Remove legacy backend code
- **Priority 4:** Cleanup and documentation

---

## Motivation

**You've got this!** 💪

This is the final cleanup step of a major migration. You're removing code that's no longer needed, which is satisfying and makes the codebase cleaner. The hard work of migration is done - now it's just cleanup!

---

## Next Steps

**When ready:**
1. Verify prerequisites (15 min)
2. Read main spec (20 min)
3. Start Phase 1 from checklist
4. Commit early and often

**Status:** Ready to clean up! 🧹

