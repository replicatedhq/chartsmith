# PR#1: Frontend AI SDK Setup - Quick Start

---

## TL;DR (30 seconds)

**What:** Install Vercel AI SDK packages, create hook abstraction, and add feature flag infrastructure for the chat migration.

**Why:** Foundation for migrating from custom Centrifugo-based chat to industry-standard Vercel AI SDK.

**Time:** 2-3 hours estimated

**Complexity:** LOW

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ You have 2-3 hours available
- ✅ You understand the overall migration strategy (read PRD)
- ✅ You're comfortable with npm and TypeScript
- ✅ You want to establish foundation before larger changes

**Red Lights (Skip/defer it!):**
- ❌ Time-constrained (<2 hours)
- ❌ Haven't read the PRD or architecture docs
- ❌ Not comfortable with package management
- ❌ Prefer to wait until full migration plan is clearer

**Decision Aid:** This is a foundational PR with no functional changes. It's safe to do now and enables incremental migration. If unsure, read the [main specification](./PR01_FRONTEND_AI_SDK_SETUP.md) first.

---

## Prerequisites (5 minutes)

### Required
- [ ] Access to `chartsmith-app` directory
- [ ] Node.js and npm installed
- [ ] Git access (for creating branch)
- [ ] Basic understanding of TypeScript and React hooks

### Recommended
- [ ] Read [PRD: Vercel AI SDK Migration](../../PRD-vercel-ai-sdk-migration.md) - Understand overall strategy
- [ ] Read [Architecture Comparison](../../architecture-comparison.md) - Understand before/after
- [ ] Familiarity with Next.js environment variables

### Setup Commands
```bash
# 1. Navigate to frontend directory
cd chartsmith-app

# 2. Verify Node.js version (should be 18+)
node --version

# 3. Verify npm works
npm --version

# 4. Create branch
git checkout -b feat/ai-sdk-frontend-foundation
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (30 minutes)
- [ ] Read this quick start (5 min) ✓
- [ ] Read main specification (20 min)
  - [ ] Understand architecture decisions
  - [ ] Note key implementation steps
  - [ ] Review code examples
- [ ] Review implementation checklist (5 min)
  - [ ] Understand phase structure
  - [ ] Note testing checkpoints

### Step 2: Set Up Environment (5 minutes)
- [ ] Navigate to `chartsmith-app` directory
- [ ] Create git branch
- [ ] Verify current state (run `npm run build` to baseline)

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Install Packages
- [ ] Follow checklist step-by-step
- [ ] Commit when phase complete

---

## Daily Progress Template

### Day 1 Goals (2-3 hours)
- [ ] Phase 1: Install Packages (15 min)
- [ ] Phase 2: Feature Flag Infrastructure (30 min)
- [ ] Phase 3: Hook Abstraction (45 min)
- [ ] Phase 4: Verification (30 min)
- [ ] Documentation (30 min)

**Checkpoint:** All packages installed, feature flag works, hook shell created, everything verified

---

## Common Issues & Solutions

### Issue 1: npm install fails
**Symptoms:** Error during `npm install`  
**Cause:** Network issues, package registry problems, or dependency conflicts  
**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and lock file
rm -rf node_modules package-lock.json

# Try again
npm install
```

### Issue 2: TypeScript errors after installation
**Symptoms:** Type errors when running `tsc --noEmit`  
**Cause:** Type definitions not installed or version mismatch  
**Solution:**
```bash
# Verify TypeScript version
npx tsc --version

# Reinstall types
npm install --save-dev @types/node @types/react
```

### Issue 3: Build fails with module not found
**Symptoms:** Build error about missing AI SDK modules  
**Cause:** Packages not installed correctly  
**Solution:**
```bash
# Verify packages in package.json
cat package.json | grep -A2 '"ai"'

# Reinstall if missing
npm install ai @ai-sdk/react @ai-sdk/anthropic
```

### Issue 4: Feature flag always returns false
**Symptoms:** `isAISDKChatEnabled()` always returns false even when env var is set  
**Cause:** Environment variable not prefixed with `NEXT_PUBLIC_` or server restart needed  
**Solution:**
```bash
# Verify env var name (must start with NEXT_PUBLIC_)
echo $NEXT_PUBLIC_ENABLE_AI_SDK_CHAT

# Restart dev server after changing env vars
# Stop server (Ctrl+C) and restart: npm run dev
```

### Issue 5: Bundle size increased significantly
**Symptoms:** Build output shows large bundle size increase  
**Cause:** AI SDK packages are included even though not used yet  
**Solution:**
- This is expected - packages are installed but not used
- Tree-shaking will remove unused code when we actually use them
- ~50KB gzipped is acceptable for the migration benefits
- Can verify actual usage in future PRs

---

## Quick Reference

### Key Files
- `chartsmith-app/package.json` - Dependencies configuration
- `chartsmith-app/hooks/useAIChat.ts` - Hook abstraction (new)
- `chartsmith-app/lib/config/feature-flags.ts` - Feature flag utility (new)

### Key Functions
- `isAISDKChatEnabled()` - Checks if AI SDK chat is enabled
- `useAIChat()` - Chat hook abstraction (shell for now)

### Key Concepts
- **Feature Flag:** Environment variable `NEXT_PUBLIC_ENABLE_AI_SDK_CHAT` controls which implementation to use
- **Hook Abstraction:** `useAIChat` provides consistent interface regardless of implementation
- **Incremental Migration:** This PR adds infrastructure only; no functional changes

### Useful Commands
```bash
# Install packages
npm install ai @ai-sdk/react @ai-sdk/anthropic

# Run build
npm run build

# Run tests
npm run test:unit

# Type check
npx tsc --noEmit

# Start dev server
npm run dev
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] Packages appear in `package.json`
- [ ] Build succeeds without errors
- [ ] All tests pass
- [ ] Feature flag function exists and works
- [ ] Hook shell compiles without errors
- [ ] No console errors in browser
- [ ] App functionality unchanged

**Performance Targets:**
- Build time: Same or better
- Bundle size: <100KB increase (acceptable for foundation)
- Runtime: No impact (packages not used yet)

---

## Help & Support

### Stuck?
1. Check main planning doc for details: `PR01_FRONTEND_AI_SDK_SETUP.md`
2. Review implementation checklist: `PR01_IMPLEMENTATION_CHECKLIST.md`
3. Check [PRD](../../PRD-vercel-ai-sdk-migration.md) for overall context
4. Review [Architecture Comparison](../../architecture-comparison.md) for technical details

### Want to Skip a Feature?
- Can't skip - this is foundational
- All parts are necessary for future PRs
- But you can defer if time-constrained

### Running Out of Time?
- Phase 1 (packages) is critical - must complete
- Phase 2 (feature flag) is critical - must complete
- Phase 3 (hook) can be simplified to just shell
- Phase 4 (verification) is critical - must complete

**Minimum viable:** Packages + feature flag + basic hook shell + verification

---

## Motivation

**You've got this!** 💪

This is a straightforward foundation PR. You're:
- Installing well-documented packages
- Creating simple utility functions
- Building infrastructure for future work
- Making zero functional changes (safe!)

The hardest part is being thorough with verification. Take your time testing - it's worth it!

---

## Next Steps

**When ready:**
1. Read main spec (30 min)
2. Review checklist (5 min)
3. Start Phase 1: Install Packages
4. Follow checklist step-by-step
5. Commit frequently

**After completion:**
- PR#2: Go AI SDK Library Integration (parallel)
- PR#6: useChat Hook Implementation (depends on this)
- PR#7: Chat UI Component Migration (depends on PR#6)

**Status:** Ready to build! 🚀

