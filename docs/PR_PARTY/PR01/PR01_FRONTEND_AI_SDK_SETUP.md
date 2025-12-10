# PR#1: Frontend AI SDK Setup

**Estimated Time:** 2-3 hours  
**Complexity:** LOW  
**Dependencies:** None (can start immediately)  
**Parallel With:** PR#2, PR#3  
**Success Criteria:** G1 (Replace custom chat UI with Vercel AI SDK)

---

## Overview

### What We're Building

This PR establishes the foundation for migrating Chartsmith's chat system to the Vercel AI SDK. We will:

1. **Install AI SDK packages** - Add `@ai-sdk/react` and `ai` to the frontend dependencies
2. **Create hook abstraction** - Build a `useAIChat.ts` hook shell that will eventually wrap `useChat`
3. **Add feature flag infrastructure** - Create a feature flag system to toggle between old and new implementations
4. **No functional changes** - This PR adds infrastructure only; no existing functionality changes

### Why It Matters

This foundational PR enables the entire Vercel AI SDK migration. By establishing the infrastructure early, we can:
- Incrementally migrate features without breaking existing functionality
- Test new implementation alongside old implementation
- Roll back easily if issues arise
- Build confidence in the new approach before full migration

### Success in One Sentence

"This PR is successful when AI SDK packages are installed, a hook abstraction exists, feature flags work, and all existing functionality continues to work unchanged."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Package Versions
**Options Considered:**
1. Latest stable (`^3.0.0`) - Most features, best docs, actively maintained
2. Specific version (`3.0.0`) - Pinned, no surprises, but harder to update
3. Beta/RC versions - Cutting edge features, but potential instability

**Chosen:** Latest stable (`^3.0.0`)

**Rationale:**
- Vercel AI SDK is mature and stable
- Latest version has best documentation and community support
- Caret range allows patch updates for security fixes
- We can pin exact versions in package-lock.json

**Trade-offs:**
- Gain: Easy to get latest features and fixes
- Lose: Potential for minor version updates (mitigated by lock file)

#### Decision 2: Hook Abstraction Strategy
**Options Considered:**
1. Direct `useChat` usage - Simple, but tightly couples components to AI SDK
2. Abstraction layer (`useAIChat`) - More work upfront, but flexible for future changes
3. Wrapper component - Too heavy for this phase

**Chosen:** Abstraction layer (`useAIChat.ts`)

**Rationale:**
- Allows swapping implementations without changing components
- Enables feature flag toggling
- Provides consistent interface regardless of implementation
- Makes testing easier

**Trade-offs:**
- Gain: Flexibility, testability, feature flag support
- Lose: Slight indirection (minimal overhead)

#### Decision 3: Feature Flag Implementation
**Options Considered:**
1. Environment variable (`ENABLE_AI_SDK_CHAT`) - Simple, requires restart
2. Runtime config API - More complex, can toggle without restart
3. Build-time flag - Simplest, but requires rebuild

**Chosen:** Environment variable (`ENABLE_AI_SDK_CHAT`)

**Rationale:**
- Simple and standard approach
- No need for runtime toggling (we'll remove flag after migration)
- Consistent with Next.js patterns
- Easy to test both paths

**Trade-offs:**
- Gain: Simplicity, no runtime overhead
- Lose: Requires restart to toggle (acceptable for this use case)

### Data Model

**No database changes** - This PR only affects frontend dependencies and code structure.

### API Design

**No API changes** - This PR only adds frontend infrastructure.

### Component Hierarchy

```
Current (unchanged):
ChatContainer.tsx
├── Uses custom chat logic
└── Uses Jotai atoms for state

Future (after migration):
ChatContainer.tsx
├── Uses useAIChat hook
│   └── useAIChat.ts
│       ├── Feature flag check
│       ├── Old: Custom Centrifugo logic
│       └── New: useChat from @ai-sdk/react
└── Uses AI SDK state management
```

---

## Implementation Details

### File Structure

**New Files:**
```
chartsmith-app/
├── hooks/
│   └── useAIChat.ts (~50 lines) - Hook abstraction shell
└── lib/
    └── config/
        └── feature-flags.ts (~30 lines) - Feature flag utilities
```

**Modified Files:**
- `chartsmith-app/package.json` (+2 dependencies) - Add AI SDK packages
- `chartsmith-app/package-lock.json` (auto-generated) - Lock file updates

### Key Implementation Steps

#### Phase 1: Install Packages (15 minutes)
1. Navigate to `chartsmith-app` directory
2. Install `ai` and `@ai-sdk/react` packages
3. Verify installation in `package.json`
4. Run build to ensure no breaking changes
5. Run tests to ensure nothing broke

#### Phase 2: Create Feature Flag Infrastructure (30 minutes)
1. Create `lib/config/feature-flags.ts`
2. Export `isAISDKChatEnabled()` function
3. Read from `process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT`
4. Default to `false` (old implementation)
5. Add TypeScript types
6. Add JSDoc comments

#### Phase 3: Create Hook Abstraction (45 minutes)
1. Create `hooks/useAIChat.ts`
2. Define interface matching expected chat behavior
3. Implement shell that checks feature flag
4. Return old implementation path (for now)
5. Add TypeScript types
6. Add JSDoc comments
7. Export hook

#### Phase 4: Verification (30 minutes)
1. Run TypeScript type check
2. Run build
3. Run all tests
4. Start dev server and verify app loads
5. Check browser console for errors
6. Verify feature flag defaults to false

### Code Examples

**Example 1: Feature Flag Utility**
```typescript
// lib/config/feature-flags.ts
/**
 * Feature flag configuration for AI SDK migration.
 * 
 * Controls whether the new Vercel AI SDK chat implementation
 * is enabled or the legacy Centrifugo-based implementation is used.
 */

/**
 * Checks if AI SDK chat is enabled via environment variable.
 * 
 * @returns {boolean} True if AI SDK chat should be used, false otherwise
 * @default false - Defaults to legacy implementation for safety
 */
export function isAISDKChatEnabled(): boolean {
  // Read from environment variable, defaulting to false
  const flag = process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT;
  
  // Explicitly check for 'true' string to avoid truthy issues
  return flag === 'true';
}
```

**Example 2: Hook Abstraction Shell**
```typescript
// hooks/useAIChat.ts
/**
 * Abstraction layer for chat functionality.
 * 
 * This hook provides a consistent interface for chat operations,
 * allowing us to swap implementations without changing components.
 * Currently returns the legacy implementation; will be updated in
 * future PRs to use Vercel AI SDK's useChat hook.
 */

import { isAISDKChatEnabled } from '@/lib/config/feature-flags';

// TODO: Import actual chat types from existing implementation
// For now, using placeholder types
interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
}

interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  // ... other expected properties
}

/**
 * Chat hook abstraction.
 * 
 * @returns Chat state and handlers
 */
export function useAIChat(): UseAIChatReturn {
  const isEnabled = isAISDKChatEnabled();
  
  if (isEnabled) {
    // TODO: Return useChat implementation (PR#6)
    throw new Error('AI SDK chat not yet implemented');
  }
  
  // Return legacy implementation
  // TODO: Import and return actual legacy hook/atoms
  // For now, return empty shell
  return {
    messages: [],
    isLoading: false,
    error: null,
  };
}
```

**Example 3: Package.json Changes**
```json
{
  "dependencies": {
    "ai": "^3.0.0",
    "@ai-sdk/react": "^3.0.0",
    // ... existing dependencies
  }
}
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- Feature flag utility: Test default value, test 'true' string, test other values
- Hook abstraction: Test feature flag check, test return structure

**Integration Tests:**
- Build process: Verify packages install correctly
- Type checking: Verify TypeScript compiles
- Runtime: Verify app starts without errors

**Regression Tests:**
- Existing functionality: All existing tests pass
- No console errors: Browser console clean
- No visual changes: UI looks identical

### Edge Cases

- Environment variable not set (should default to false)
- Environment variable set to non-boolean (should default to false)
- Environment variable set to 'true' (should enable new path, but will throw error until implemented)
- Package installation fails (should be caught by npm)

### Performance Tests

- Bundle size: Check that new packages don't significantly increase bundle size
- Build time: Verify build time hasn't increased significantly
- Runtime: No performance impact (packages not used yet)

---

## Success Criteria

**Feature is complete when:**
- [ ] `ai` package is installed and in `package.json`
- [ ] `@ai-sdk/react` package is installed and in `package.json`
- [ ] `useAIChat.ts` hook exists with proper TypeScript types
- [ ] `feature-flags.ts` utility exists and works correctly
- [ ] Feature flag defaults to `false` (old implementation)
- [ ] All existing tests pass
- [ ] Build succeeds without errors
- [ ] TypeScript compiles without errors
- [ ] Dev server starts without errors
- [ ] No console errors in browser
- [ ] No visual changes to UI
- [ ] Bundle size increase is reasonable (<100KB gzipped)

**Performance Targets:**
- Build time: Same or better
- Bundle size: <100KB increase (AI SDK is ~50KB gzipped)
- Runtime: No impact (not used yet)

**Quality Gates:**
- Zero breaking changes
- Zero console errors
- All tests passing
- TypeScript strict mode passes

---

## Risk Assessment

### Risk 1: Package Version Conflicts
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:** 
- Use caret ranges (^) to allow patch updates
- Lock file pins exact versions
- Test build immediately after installation
- Can rollback with `npm uninstall`

**Status:** 🟢 LOW RISK

### Risk 2: Bundle Size Increase
**Likelihood:** MEDIUM  
**Impact:** LOW  
**Mitigation:**
- AI SDK is well-optimized (~50KB gzipped)
- Tree-shaking will remove unused code
- Can analyze bundle size before/after
- Acceptable trade-off for migration benefits

**Status:** 🟢 LOW RISK

### Risk 3: TypeScript Type Conflicts
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:**
- AI SDK has excellent TypeScript support
- Run `tsc --noEmit` after installation
- Can adjust types if needed
- Well-documented types

**Status:** 🟢 LOW RISK

### Risk 4: Breaking Changes in Dependencies
**Likelihood:** LOW  
**Impact:** HIGH  
**Mitigation:**
- Use stable versions (^3.0.0)
- Lock file prevents unexpected updates
- Test thoroughly before merging
- Can pin exact version if needed

**Status:** 🟢 LOW RISK

---

## Open Questions

1. **Question 1:** Should we also install `@ai-sdk/anthropic` now or wait?
   - **Option A:** Install now - Consistent with PRD, ready for future use
   - **Option B:** Wait - Not needed until later PRs
   - **Decision:** Install now (mentioned in PRD US-1.1)
   - **Decision needed by:** Implementation start

2. **Question 2:** Should feature flag be in `.env.local` or `.env.example`?
   - **Option A:** `.env.local` only - Keeps it out of repo
   - **Option B:** `.env.example` with comment - Documents the flag
   - **Decision:** Both - `.env.example` documents, `.env.local` enables
   - **Decision needed by:** Phase 2

---

## Timeline

**Total Estimate:** 2-3 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Install Packages | 15 min | ⏳ |
| 2 | Feature Flag Infrastructure | 30 min | ⏳ |
| 3 | Hook Abstraction | 45 min | ⏳ |
| 4 | Verification | 30 min | ⏳ |
| 5 | Documentation | 30 min | ⏳ |

**Buffer:** 30 minutes for unexpected issues

---

## Dependencies

**Requires:**
- [ ] Access to `chartsmith-app` directory
- [ ] Ability to run `npm install`
- [ ] Node.js and npm installed

**Blocks:**
- PR#6 (useChat hook implementation) - Needs this foundation
- PR#7 (Chat UI migration) - Needs hook abstraction

**Parallel With:**
- PR#2 (Go AI SDK library integration) - Independent
- PR#3 (Feature flag infrastructure) - Actually part of this PR

---

## References

- Related PR: [PRD: Vercel AI SDK Migration](../../PRD-vercel-ai-sdk-migration.md)
- AI SDK Docs: https://sdk.vercel.ai/docs
- React Package: https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
- Package: https://www.npmjs.com/package/ai
- Package: https://www.npmjs.com/package/@ai-sdk/react

---

## Appendix

### A. Package Details

**`ai` package:**
- Version: ^3.0.0
- Purpose: Core AI SDK functionality
- Size: ~30KB gzipped
- Dependencies: Minimal

**`@ai-sdk/react` package:**
- Version: ^3.0.0
- Purpose: React hooks (`useChat`, etc.)
- Size: ~20KB gzipped
- Dependencies: `ai` (peer dependency)

**`@ai-sdk/anthropic` package:**
- Version: ^3.0.0
- Purpose: Anthropic provider (for future use)
- Size: ~5KB gzipped
- Dependencies: `ai` (peer dependency)

### B. Feature Flag Environment Variable

```bash
# .env.local (for local development)
NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false

# .env.example (documentation)
# Enable Vercel AI SDK chat implementation
# Set to 'true' to use new implementation, 'false' for legacy
NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false
```

### C. TypeScript Types Reference

```typescript
// From @ai-sdk/react
import type { UseChatHelpers, Message } from '@ai-sdk/react';

// From ai
import type { CoreMessage, CoreTool } from 'ai';
```

---

*This is a living document. Updates should be made as implementation progresses and learnings emerge.*

