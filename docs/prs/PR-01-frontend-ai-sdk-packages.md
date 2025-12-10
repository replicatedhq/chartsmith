# PR-01: Install Frontend AI SDK Packages

**Branch:** `feat/ai-sdk-frontend-packages`
**Dependencies:** None (can start immediately)
**Parallel With:** PR-02, PR-03
**Estimated Complexity:** Low
**Success Criteria:** G1 (Replace custom chat UI with Vercel AI SDK)

---

## Overview

Install the Vercel AI SDK packages in the Next.js frontend. This is a foundational PR that adds dependencies without changing any functionality.

## Prerequisites

- Access to the `chartsmith-app` directory
- Ability to run `npm install`

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI SDK version | `^3.0.0` (latest stable) | Most features, best docs |
| React package | `@ai-sdk/react` | Official React bindings |
| Core package | `ai` | Required peer dependency |

---

## Step-by-Step Instructions

### Step 1: Navigate to Frontend Directory

```bash
cd chartsmith-app
```

### Step 2: Install AI SDK Packages

```bash
npm install ai @ai-sdk/react
```

### Step 3: Verify Installation

Check that packages were added to `package.json`:

```bash
cat package.json | grep -A2 '"ai"'
cat package.json | grep -A2 '"@ai-sdk/react"'
```

Expected output should show both packages with versions.

### Step 4: Verify No Breaking Changes

Run the existing build to ensure nothing broke:

```bash
npm run build
```

Build should complete successfully with no new errors.

### Step 5: Run Existing Tests

```bash
npm run test
```

All existing tests should pass.

### Step 6: Create Type Verification File (Optional)

Create a simple file to verify TypeScript types are working:

```typescript
// lib/ai-sdk-types-check.ts
// This file verifies AI SDK types are available
// Delete after verification or keep for documentation

import type { Message } from 'ai';
import type { UseChatHelpers } from '@ai-sdk/react';

// Type check - these should not error
type MessageCheck = Message;
type HelpersCheck = UseChatHelpers;

export {}; // Make this a module
```

Run TypeScript check:

```bash
npm run type-check
# or
npx tsc --noEmit
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `chartsmith-app/package.json` | Modified | Added `ai` and `@ai-sdk/react` dependencies |
| `chartsmith-app/package-lock.json` | Modified | Lock file updated |

---

## Acceptance Criteria

- [ ] `ai` package is in `package.json` dependencies
- [ ] `@ai-sdk/react` package is in `package.json` dependencies
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes (all existing tests)
- [ ] No TypeScript errors related to new packages
- [ ] No runtime errors on app startup

---

## Testing Instructions

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the app in browser and verify it loads normally

3. Check browser console for any new errors (there should be none)

---

## Rollback Plan

If issues arise:

```bash
npm uninstall ai @ai-sdk/react
git checkout package.json package-lock.json
```

---

## PR Checklist

- [ ] Branch created from `main`
- [ ] Packages installed successfully
- [ ] Build passes
- [ ] Tests pass
- [ ] No console errors in browser
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- This PR only adds dependencies, no code changes
- Verify package versions are latest stable
- Check that bundle size increase is reasonable (AI SDK is ~50KB gzipped)
