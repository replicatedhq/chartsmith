# PR-13: Remove Frontend Anthropic SDK

**Branch:** `cleanup/remove-frontend-anthropic-sdk`
**Dependencies:** PR-12 (Legacy chat removal complete)
**Parallel With:** PR-14 (documentation)
**Estimated Complexity:** Low
**Success Criteria:** G2 (Remove @anthropic-ai/sdk)

---

## Overview

Remove the `@anthropic-ai/sdk` package from the frontend now that all chat functionality uses the Vercel AI SDK through the Go backend. This completes the migration by eliminating the direct Anthropic dependency in the browser.

## Prerequisites

- PR-12 merged (Legacy streaming removed)
- All chat functionality working via AI SDK
- No remaining usage of `@anthropic-ai/sdk` in frontend

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Removal timing | After full validation | Ensure no hidden dependencies |
| Go Anthropic SDK | Keep | Still used for LLM calls |
| Type definitions | Use AI SDK types | Better type safety |

---

## Pre-Removal Verification

### Step 1: Find All Anthropic SDK Usage

```bash
cd chartsmith-app

# Find imports
grep -r "@anthropic-ai/sdk" . --include="*.ts" --include="*.tsx"

# Find Anthropic types
grep -r "Anthropic\." . --include="*.ts" --include="*.tsx"

# Find MessageParam, ContentBlock, etc.
grep -r "MessageParam\|ContentBlock\|TextBlock" . --include="*.ts" --include="*.tsx"
```

Expected findings (to be removed):
- Import statements
- Type annotations using Anthropic types
- Any `promptType()` or similar utility functions

### Step 2: Document Current Usage

Before removal, document what's using the SDK:

| File | Usage | Replacement |
|------|-------|-------------|
| `lib/llm/prompt-type.ts` | `promptType()` function | Remove or replace |
| Type definitions | Message types | Use AI SDK `Message` type |

---

## Step-by-Step Instructions

### Step 3: Remove/Replace promptType Function

If there's a `promptType()` function that uses Anthropic SDK:

```typescript
// chartsmith-app/lib/llm/prompt-type.ts

// BEFORE: Uses Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';

export async function promptType(prompt: string): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
  });
  // ... classification logic
}

// OPTION A: Move to API route (recommended)
// Delete this file, create API route instead

// OPTION B: Remove entirely if no longer needed
// Delete this file if the functionality is handled elsewhere
```

If replacing with API route:

```typescript
// chartsmith-app/app/api/classify-prompt/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * POST /api/classify-prompt
 * Classify a prompt's intent type
 *
 * Note: This functionality may already exist in Go backend
 * Check pkg/llm/intent.go before implementing
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prompt } = await req.json();

  // Forward to Go backend which handles intent classification
  const goWorkerUrl = process.env.GO_WORKER_URL || 'http://localhost:8080';
  const response = await fetch(`${goWorkerUrl}/api/v1/intent/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Classification failed' },
      { status: response.status }
    );
  }

  return NextResponse.json(await response.json());
}
```

### Step 4: Update Type Imports

Replace Anthropic types with AI SDK types:

```typescript
// BEFORE
import Anthropic from '@anthropic-ai/sdk';

interface ChatMessage {
  role: Anthropic.MessageParam['role'];
  content: Anthropic.ContentBlock[];
}

// AFTER
import { Message } from '@ai-sdk/react';

interface ChatMessage {
  role: Message['role'];
  content: string;
}
```

### Step 5: Remove Package from Dependencies

```bash
cd chartsmith-app

# Remove the package
npm uninstall @anthropic-ai/sdk

# Verify removal
cat package.json | grep anthropic
# Should return nothing
```

### Step 6: Remove Environment Variable

```bash
# chartsmith-app/.env.example

# BEFORE
NEXT_PUBLIC_ANTHROPIC_API_KEY=your-key-here

# AFTER
# DELETE the line - no longer needed in frontend
```

```typescript
// chartsmith-app/types/env.d.ts

// BEFORE
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_ANTHROPIC_API_KEY?: string;
    // ... other vars
  }
}

// AFTER
declare namespace NodeJS {
  interface ProcessEnv {
    // NEXT_PUBLIC_ANTHROPIC_API_KEY removed
    // ... other vars
  }
}
```

### Step 7: Update Any Remaining References

Search for and update any remaining references:

```bash
# Find any remaining Anthropic references
grep -r "anthropic" chartsmith-app/ --include="*.ts" --include="*.tsx" --include="*.json" -i

# Check for API key references
grep -r "ANTHROPIC" chartsmith-app/ --include="*.ts" --include="*.tsx" -i
```

### Step 8: Remove Type Declaration Files (If Any)

```bash
# If there are custom Anthropic type files
rm chartsmith-app/types/anthropic.d.ts  # If exists
rm chartsmith-app/lib/types/anthropic.ts  # If exists
```

### Step 9: Verify Build

```bash
cd chartsmith-app

# Clean install
rm -rf node_modules
rm package-lock.json  # or yarn.lock
npm install

# Type check
npm run type-check

# Build
npm run build

# Run tests
npm test
```

### Step 10: Verify Runtime

```bash
# Start dev server
npm run dev

# Test chat functionality
# - Send messages
# - Verify streaming
# - Check tool calls
# - Verify no console errors about missing Anthropic
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `package.json` | Modified | Remove @anthropic-ai/sdk |
| `package-lock.json` | Modified | Updated lockfile |
| `lib/llm/prompt-type.ts` | Deleted | Remove Anthropic usage |
| `app/api/classify-prompt/route.ts` | Added | Replacement API (if needed) |
| `.env.example` | Modified | Remove API key |
| `types/env.d.ts` | Modified | Remove type declaration |
| Various `.ts`/`.tsx` files | Modified | Update type imports |

---

## Acceptance Criteria

- [ ] `@anthropic-ai/sdk` removed from package.json
- [ ] No imports of `@anthropic-ai/sdk` in codebase
- [ ] No `Anthropic.` type references
- [ ] `NEXT_PUBLIC_ANTHROPIC_API_KEY` removed
- [ ] `promptType()` removed or replaced
- [ ] Type check passes
- [ ] Build succeeds
- [ ] All tests pass
- [ ] Chat still works end-to-end

---

## Security Improvement

This change improves security by:

1. **Removing browser API key** - No more `dangerouslyAllowBrowser: true`
2. **Server-side only** - All LLM calls go through authenticated backend
3. **Reduced attack surface** - No direct Anthropic access from client

---

## Bundle Size Improvement

Removing `@anthropic-ai/sdk` reduces the frontend bundle:

```bash
# Check bundle size before removal
npm run build
# Note the size

# After removal
npm run build
# Compare - should be smaller
```

Expected reduction: ~50-100KB (depending on tree-shaking)

---

## Testing Instructions

1. Type check:
   ```bash
   npm run type-check
   ```

2. Unit tests:
   ```bash
   npm test
   ```

3. Build verification:
   ```bash
   npm run build
   ```

4. Manual testing:
   - Open workspace
   - Send chat message
   - Verify streaming works
   - Check network tab - no Anthropic API calls
   - Check console - no errors

5. Verify no Anthropic calls:
   ```bash
   # In browser dev tools, Network tab
   # Filter by "anthropic"
   # Should see no requests to api.anthropic.com
   ```

---

## Rollback Plan

If issues are found:

1. Re-add the package:
   ```bash
   npm install @anthropic-ai/sdk
   ```

2. Restore deleted files from git:
   ```bash
   git checkout HEAD~1 -- lib/llm/prompt-type.ts
   ```

3. Re-add environment variable

---

## PR Checklist

- [ ] Verified no remaining Anthropic SDK usage
- [ ] Package removed from package.json
- [ ] All type imports updated
- [ ] Environment variable removed
- [ ] Type check passes
- [ ] Build succeeds
- [ ] Tests pass
- [ ] Manual testing complete
- [ ] Bundle size reduced (document in PR)
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- This completes the frontend portion of the migration
- Go backend still uses Anthropic SDK - that's expected
- All LLM calls now route through authenticated backend
- Security improvement: no browser API keys
- Performance improvement: smaller bundle
