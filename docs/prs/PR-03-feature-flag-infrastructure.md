# PR-03: Feature Flag Infrastructure

**Branch:** `feat/ai-sdk-feature-flag`
**Dependencies:** None (can start immediately)
**Parallel With:** PR-01, PR-02
**Estimated Complexity:** Low
**Success Criteria:** Safe rollout capability

---

## Overview

Add feature flag infrastructure to toggle between the old and new chat implementations. This enables safe, incremental rollout of the AI SDK migration.

## Prerequisites

- PR-01 merged (for TypeScript types) OR work in parallel and merge after PR-01
- Access to `chartsmith-app` directory

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Flag mechanism | Environment variable | Simple, no external service needed |
| Flag name | `NEXT_PUBLIC_ENABLE_AI_SDK_CHAT` | `NEXT_PUBLIC_` prefix exposes to browser |
| Default value | `false` | Old implementation by default (safe) |
| Flag location | `.env` files + runtime config | Supports both build-time and runtime |

---

## Step-by-Step Instructions

### Step 1: Create Feature Flags Module

Create a new file for feature flag utilities:

```typescript
// chartsmith-app/lib/config/feature-flags.ts

/**
 * Feature flags for incremental rollout of new features.
 *
 * AI SDK Chat Migration:
 * - Set NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true to enable new chat implementation
 * - Default is false (uses legacy Centrifugo-based chat)
 */

export const featureFlags = {
  /**
   * Enable Vercel AI SDK chat implementation.
   * When true: Uses useChat hook with HTTP streaming
   * When false: Uses legacy Centrifugo WebSocket streaming
   */
  enableAISDKChat: process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT === 'true',
} as const;

/**
 * Type-safe feature flag checker
 */
export function isFeatureEnabled(flag: keyof typeof featureFlags): boolean {
  return featureFlags[flag];
}

/**
 * Hook for components that need reactive feature flag checks
 * (For future use if we add runtime flag updates)
 */
export function useFeatureFlag(flag: keyof typeof featureFlags): boolean {
  // Currently just returns static value
  // Could be extended to use React context or SWR for dynamic flags
  return featureFlags[flag];
}
```

### Step 2: Add Environment Variable to Example File

Update or create `.env.example`:

```bash
# chartsmith-app/.env.example

# ... existing variables ...

# AI SDK Migration Feature Flags
# Set to 'true' to enable new Vercel AI SDK chat implementation
# Default: false (uses legacy Centrifugo-based chat)
NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false
```

### Step 3: Add to Local Development Environment

Update `.env.local` (or create if doesn't exist):

```bash
# chartsmith-app/.env.local

# Enable AI SDK chat for local development testing
# Change to 'true' when ready to test new implementation
NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false
```

**Note:** `.env.local` should be in `.gitignore`

### Step 4: Add TypeScript Types for Environment

Create or update environment types:

```typescript
// chartsmith-app/types/env.d.ts (create if doesn't exist)

declare namespace NodeJS {
  interface ProcessEnv {
    // ... existing env vars ...

    /** Enable AI SDK chat implementation ('true' or 'false') */
    NEXT_PUBLIC_ENABLE_AI_SDK_CHAT?: string;
  }
}
```

### Step 5: Create a Test Component (Optional)

Create a simple component to verify the flag works:

```typescript
// chartsmith-app/components/FeatureFlagDebug.tsx
// DELETE THIS FILE BEFORE PRODUCTION or gate behind admin check

'use client';

import { featureFlags } from '@/lib/config/feature-flags';

export function FeatureFlagDebug() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded text-xs opacity-75">
      <div>AI SDK Chat: {featureFlags.enableAISDKChat ? '✅ ON' : '❌ OFF'}</div>
    </div>
  );
}
```

### Step 6: Verify Feature Flag Works

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Add the debug component temporarily to a page to verify

3. Test toggling:
   ```bash
   # In .env.local, change to:
   NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true
   ```

4. Restart dev server and verify flag changed

### Step 7: Add Unit Test

```typescript
// chartsmith-app/lib/config/__tests__/feature-flags.test.ts

import { featureFlags, isFeatureEnabled, useFeatureFlag } from '../feature-flags';

describe('Feature Flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('enableAISDKChat', () => {
    it('should be false by default', () => {
      delete process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT;
      // Re-import to get fresh value
      const { featureFlags: freshFlags } = require('../feature-flags');
      expect(freshFlags.enableAISDKChat).toBe(false);
    });

    it('should be true when env var is "true"', () => {
      process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT = 'true';
      const { featureFlags: freshFlags } = require('../feature-flags');
      expect(freshFlags.enableAISDKChat).toBe(true);
    });

    it('should be false for any other value', () => {
      process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT = 'yes';
      const { featureFlags: freshFlags } = require('../feature-flags');
      expect(freshFlags.enableAISDKChat).toBe(false);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return flag value', () => {
      const result = isFeatureEnabled('enableAISDKChat');
      expect(typeof result).toBe('boolean');
    });
  });
});
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `chartsmith-app/lib/config/feature-flags.ts` | Added | Feature flag utilities |
| `chartsmith-app/.env.example` | Modified | Added AI SDK flag |
| `chartsmith-app/types/env.d.ts` | Modified/Added | TypeScript env types |
| `chartsmith-app/lib/config/__tests__/feature-flags.test.ts` | Added | Unit tests |
| `chartsmith-app/components/FeatureFlagDebug.tsx` | Added (Optional) | Debug component |

---

## Acceptance Criteria

- [ ] `featureFlags.enableAISDKChat` returns `false` by default
- [ ] Setting `NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true` changes flag to `true`
- [ ] TypeScript types work correctly
- [ ] Unit tests pass
- [ ] Build succeeds
- [ ] Flag is accessible in both server and client components

---

## Testing Instructions

1. Run unit tests:
   ```bash
   npm test -- --testPathPattern=feature-flags
   ```

2. Manual verification:
   - Start dev server with flag OFF
   - Verify `featureFlags.enableAISDKChat` is `false`
   - Change `.env.local` to `true`
   - Restart server
   - Verify flag is now `true`

---

## Usage in Future PRs

```typescript
// Example usage in a component:
import { featureFlags } from '@/lib/config/feature-flags';

function ChatContainer() {
  if (featureFlags.enableAISDKChat) {
    // Use new AI SDK implementation
    return <AISDKChat />;
  }

  // Use legacy implementation
  return <LegacyChat />;
}
```

---

## Rollback Plan

Feature flag is designed for safe rollback:

1. Set `NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false` in environment
2. Redeploy
3. Old implementation is immediately active

---

## PR Checklist

- [ ] Branch created from `main`
- [ ] Feature flag module created
- [ ] Environment example updated
- [ ] TypeScript types added
- [ ] Unit tests added and passing
- [ ] Build passes
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Flag defaults to `false` for safety
- `NEXT_PUBLIC_` prefix is intentional - we need client-side access
- Debug component should be removed before production (or gated)
- Consider if we need the flag in Go backend too (future PR if needed)
