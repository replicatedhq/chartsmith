# PR#5: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (~45 min)
  - [ ] Understand architecture decisions
  - [ ] Review code examples
  - [ ] Note error handling patterns
- [ ] Prerequisites verified
  - [ ] PR#4 complete (Go chat endpoint exists)
  - [ ] Feature flag infrastructure available (PR#1)
  - [ ] Authentication utilities available
  - [ ] Go worker running (for testing)
- [ ] Dependencies installed
  ```bash
  # No new dependencies needed - using Next.js built-ins
  ```
- [ ] Environment configured
  ```bash
  # Verify .env.example exists
  # Check GO_WORKER_URL will be set
  ```
- [ ] Git branch created
  ```bash
  git checkout -b feat/ai-sdk-api-route
  ```

---

## Phase 1: Create Route File (30 minutes)

### 1.1: Create Directory Structure (2 minutes)

- [ ] Create API route directory
  ```bash
  mkdir -p chartsmith-app/app/api/chat
  ```

**Checkpoint:** Directory exists ✓

---

### 1.2: Create Route Handler Shell (10 minutes)

- [ ] Create `route.ts` file
- [ ] Add basic imports
  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import { getServerSession } from 'next-auth';
  import { authOptions } from '@/lib/auth/auth-options';
  import { featureFlags } from '@/lib/config/feature-flags';
  ```
- [ ] Add dynamic export
  ```typescript
  export const dynamic = 'force-dynamic';
  ```
- [ ] Create POST function shell
  ```typescript
  export async function POST(req: NextRequest) {
    // TODO: Implement
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
  }
  ```

**Checkpoint:** Route file compiles ✓

**Commit:** `feat(api): create /api/chat route shell`

---

### 1.3: Implement Feature Flag Check (5 minutes)

- [ ] Add feature flag check at start of POST function
  ```typescript
  if (!featureFlags.enableAISDKChat) {
    return NextResponse.json(
      { error: 'AI SDK chat not enabled' },
      { status: 404 }
    );
  }
  ```

**Test:**
- [ ] Test with flag disabled: Returns 404 ✓
- [ ] Test with flag enabled: Continues ✓

**Checkpoint:** Feature flag check works ✓

**Commit:** `feat(api): add feature flag check to /api/chat`

---

### 1.4: Implement Authentication Check (5 minutes)

- [ ] Add session validation
  ```typescript
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  ```

**Test:**
- [ ] Test without session: Returns 401 ✓
- [ ] Test with session: Continues ✓

**Checkpoint:** Authentication check works ✓

**Commit:** `feat(api): add authentication check to /api/chat`

---

### 1.5: Implement Request Body Parsing (8 minutes)

- [ ] Add try/catch for JSON parsing
  ```typescript
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
  ```
- [ ] Extract messages and workspaceId
  ```typescript
  const { messages, workspaceId } = body;
  ```
- [ ] Validate messages array
  ```typescript
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'Messages array is required' },
      { status: 400 }
    );
  }
  ```
- [ ] Validate workspaceId
  ```typescript
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 }
    );
  }
  ```

**Test:**
- [ ] Test with invalid JSON: Returns 400 ✓
- [ ] Test with missing messages: Returns 400 ✓
- [ ] Test with empty messages: Returns 400 ✓
- [ ] Test with missing workspaceId: Returns 400 ✓
- [ ] Test with valid body: Continues ✓

**Checkpoint:** Request validation works ✓

**Commit:** `feat(api): add request validation to /api/chat`

---

## Phase 2: Go Worker URL Configuration (15 minutes)

### 2.1: Create Go Worker URL Helper (10 minutes)

- [ ] Create `getGoWorkerUrl` function
  ```typescript
  async function getGoWorkerUrl(): Promise<string> {
    // Try environment variable first
    if (process.env.GO_WORKER_URL) {
      return process.env.GO_WORKER_URL;
    }

    // Fall back to database param (if helper exists)
    try {
      const { getParam } = await import('@/lib/data/param');
      const paramUrl = await getParam('GO_WORKER_URL');
      if (paramUrl) {
        return paramUrl;
      }
    } catch (e) {
      // Ignore if param helper doesn't exist or fails
    }

    // Default for local development
    return 'http://localhost:8080';
  }
  ```

**Test:**
- [ ] Test with GO_WORKER_URL env var: Uses env var ✓
- [ ] Test without env var: Falls back to default ✓

**Checkpoint:** URL helper works ✓

**Commit:** `feat(api): add Go worker URL helper`

---

### 2.2: Update Environment Types (3 minutes)

- [ ] Update `chartsmith-app/types/env.d.ts`
  ```typescript
  declare namespace NodeJS {
    interface ProcessEnv {
      // ... existing vars ...

      /** Go worker URL for API proxying */
      GO_WORKER_URL?: string;
    }
  }
  ```

**Checkpoint:** Types updated ✓

**Commit:** `feat(types): add GO_WORKER_URL to env types`

---

### 2.3: Update .env.example (2 minutes)

- [ ] Add GO_WORKER_URL to `.env.example`
  ```bash
  # Go Worker URL for API proxying
  # Default: http://localhost:8080 (for local development)
  GO_WORKER_URL=http://localhost:8080
  ```

**Checkpoint:** Example updated ✓

**Commit:** `docs(env): add GO_WORKER_URL to .env.example`

---

## Phase 3: Proxy Implementation (30 minutes)

### 3.1: Implement Fetch to Go Backend (15 minutes)

- [ ] Add fetch call in POST function
  ```typescript
  const goWorkerUrl = await getGoWorkerUrl();

  const response = await fetch(`${goWorkerUrl}/api/v1/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      workspaceId,
      userId: session.user.id,
    }),
  });
  ```

**Test:**
- [ ] Verify fetch is called with correct URL ✓
- [ ] Verify request body includes userId ✓
- [ ] Verify request body includes messages ✓
- [ ] Verify request body includes workspaceId ✓

**Checkpoint:** Fetch call implemented ✓

**Commit:** `feat(api): implement fetch to Go backend`

---

### 3.2: Implement Error Handling (10 minutes)

- [ ] Add error handling for non-OK responses
  ```typescript
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Go backend error:', response.status, errorText);
    return NextResponse.json(
      { error: 'Backend error' },
      { status: response.status }
    );
  }
  ```
- [ ] Add check for empty response body
  ```typescript
  if (!response.body) {
    return NextResponse.json(
      { error: 'No response body from backend' },
      { status: 500 }
    );
  }
  ```
- [ ] Add try/catch around fetch
  ```typescript
  try {
    // ... fetch code ...
  } catch (error) {
    console.error('Chat API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  ```

**Test:**
- [ ] Test with Go backend returning 500: Returns 500 ✓
- [ ] Test with Go backend returning 400: Returns 400 ✓
- [ ] Test with network error: Returns 500 ✓
- [ ] Test with empty response body: Returns 500 ✓

**Checkpoint:** Error handling works ✓

**Commit:** `feat(api): add error handling to /api/chat`

---

### 3.3: Implement Streaming Response (5 minutes)

- [ ] Return streaming response
  ```typescript
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
  ```

**Test:**
- [ ] Verify response headers are set correctly ✓
- [ ] Verify response body is streamed (not buffered) ✓

**Checkpoint:** Streaming works ✓

**Commit:** `feat(api): implement streaming response in /api/chat`

---

## Phase 4: Testing (45 minutes)

### 4.1: Create Unit Tests (30 minutes)

- [ ] Create test file
  ```bash
  mkdir -p chartsmith-app/app/api/chat/__tests__
  touch chartsmith-app/app/api/chat/__tests__/route.test.ts
  ```
- [ ] Test authentication failure
  ```typescript
  it('returns 401 when not authenticated', async () => {
    // Mock getServerSession to return null
    // Call POST
    // Assert 401 response
  });
  ```
- [ ] Test feature flag disabled
  ```typescript
  it('returns 404 when feature flag disabled', async () => {
    // Mock feature flag as false
    // Call POST
    // Assert 404 response
  });
  ```
- [ ] Test invalid request body
  ```typescript
  it('returns 400 for invalid JSON', async () => {
    // Send invalid JSON
    // Assert 400 response
  });
  ```
- [ ] Test missing required fields
  ```typescript
  it('returns 400 for missing messages', async () => {
    // Send request without messages
    // Assert 400 response
  });
  ```
- [ ] Test successful proxy (mock Go backend)
  ```typescript
  it('proxies request to Go backend', async () => {
    // Mock fetch to return success
    // Call POST
    // Assert fetch was called correctly
    // Assert response is streamed
  });
  ```

**Test:**
- [ ] Run tests: `npm test app/api/chat`
- [ ] All tests pass ✓

**Checkpoint:** Unit tests complete ✓

**Commit:** `test(api): add unit tests for /api/chat`

---

### 4.2: Manual Testing (15 minutes)

- [ ] Start Next.js dev server
  ```bash
  cd chartsmith-app
  npm run dev
  ```
- [ ] Start Go worker (if available)
  ```bash
  ENABLE_AI_SDK_CHAT=true make run-worker
  ```
- [ ] Test with curl
  ```bash
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -H "Cookie: [session cookie]" \
    -d '{
      "messages": [{"role": "user", "content": "Hello"}],
      "workspaceId": "test-workspace"
    }'
  ```
- [ ] Verify streaming response
  - [ ] Response headers correct ✓
  - [ ] SSE format correct ✓
  - [ ] Streams data correctly ✓

**Checkpoint:** Manual testing complete ✓

**Commit:** `test(api): manual testing complete for /api/chat`

---

## Phase 5: Documentation & Polish (15 minutes)

### 5.1: Add Code Comments (5 minutes)

- [ ] Add JSDoc comment to POST function
  ```typescript
  /**
   * POST /api/chat
   *
   * Proxies chat requests to the Go backend and streams the response.
   * Used by the useChat hook from @ai-sdk/react.
   *
   * @param req - Next.js request object
   * @returns Streaming response with AI SDK Data Stream Protocol
   */
  ```
- [ ] Add inline comments for complex logic
- [ ] Document error handling approach

**Checkpoint:** Comments added ✓

**Commit:** `docs(api): add code comments to /api/chat`

---

### 5.2: Verify No Breaking Changes (5 minutes)

- [ ] Run existing tests
  ```bash
  npm test
  ```
- [ ] Verify no TypeScript errors
  ```bash
  npm run type-check
  ```
- [ ] Verify build succeeds
  ```bash
  npm run build
  ```

**Checkpoint:** No breaking changes ✓

**Commit:** `chore(api): verify no breaking changes`

---

### 5.3: Final Review (5 minutes)

- [ ] Review code for:
  - [ ] Error handling completeness
  - [ ] Security (no auth bypass)
  - [ ] Performance (streaming, no buffering)
  - [ ] Code quality (clean, readable)
- [ ] Update PR description with checklist completion

**Checkpoint:** Code review complete ✓

**Commit:** `chore(api): final review complete`

---

## Testing Checklist

### Unit Tests
- [ ] Authentication failure test passes
- [ ] Feature flag disabled test passes
- [ ] Invalid request body test passes
- [ ] Missing required fields test passes
- [ ] Successful proxy test passes
- [ ] Error handling tests pass

### Integration Tests
- [ ] End-to-end streaming works (if Go backend available)
- [ ] Error propagation works correctly
- [ ] Network errors handled gracefully

### Manual Testing
- [ ] Route responds to POST requests
- [ ] Authentication works correctly
- [ ] Feature flag works correctly
- [ ] Request validation works correctly
- [ ] Streaming works correctly
- [ ] Error handling works correctly
- [ ] No console errors

### Performance Testing
- [ ] Proxy overhead < 100ms
- [ ] No buffering (streams directly)
- [ ] Memory usage acceptable

---

## Bug Fixing (If needed)

### Bug #1: [Title]
- [ ] Reproduced
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Tested
- [ ] Documented

---

## Documentation Phase (Already done in Phase 5)

- [ ] Code comments added
- [ ] PR description updated
- [ ] No additional docs needed (this is the doc!)

---

## Deployment Phase (Not applicable - dev only)

This PR only adds a new route. No deployment changes needed.

---

## Completion Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] No breaking changes
- [ ] Code reviewed
- [ ] Documentation complete
- [ ] Ready for PR review

---

## Time Tracking

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| Setup | 15 min | ___ | |
| Phase 1 | 30 min | ___ | |
| Phase 2 | 15 min | ___ | |
| Phase 3 | 30 min | ___ | |
| Phase 4 | 45 min | ___ | |
| Phase 5 | 15 min | ___ | |
| **Total** | **2.5 hours** | **___** | |

---

**Status:** Ready to start! 🚀

