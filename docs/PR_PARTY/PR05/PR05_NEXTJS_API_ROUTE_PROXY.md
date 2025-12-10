# PR#5: Next.js API Route Proxy

**Estimated Time:** 2-3 hours  
**Complexity:** LOW-MEDIUM  
**Dependencies:** PR#4 (Go Chat HTTP Endpoint must be complete)  
**Parallel With:** None (blocks PR#6)  
**Success Criteria:** G1, G3 (Frontend connects to backend via proxy)

---

## Overview

### What We're Building

This PR creates a Next.js API route at `/api/chat` that acts as a proxy between the frontend `useChat` hook and the Go worker's streaming endpoint. The route:

1. **Receives requests** from `useChat` hook (AI SDK format)
2. **Validates authentication** using Next.js session
3. **Forwards requests** to Go worker at `/api/v1/chat/stream`
4. **Streams responses** back to the frontend in AI SDK Data Stream Protocol format
5. **Handles errors** gracefully with proper HTTP status codes

### Why It Matters

This API route is the critical bridge that enables the frontend to communicate with the Go backend using the standard AI SDK protocol. Without this proxy:

- `useChat` hook cannot connect to our Go backend
- Frontend and backend cannot communicate using AI SDK format
- The migration cannot proceed to UI components

### Success in One Sentence

"This PR is successful when the `/api/chat` route proxies requests to the Go worker, streams responses correctly, handles authentication, and all existing functionality continues to work."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Route Path
**Options Considered:**
1. `/api/chat` - Standard AI SDK convention, simple
2. `/api/v1/chat` - Versioned, more explicit
3. `/api/chat/stream` - More descriptive, but redundant

**Chosen:** `/api/chat`

**Rationale:**
- Matches AI SDK's default expectation (`useChat({ api: '/api/chat' })`)
- Standard convention in AI SDK examples
- Simple and clear
- Versioning not needed (we control the frontend)

**Trade-offs:**
- Gain: Standard pattern, matches AI SDK docs
- Lose: Less explicit versioning (acceptable for internal API)

#### Decision 2: Proxy Method
**Options Considered:**
1. Native `fetch` + stream - Simple, built-in, no extra deps
2. `http-proxy-middleware` - More features, but adds dependency
3. Custom proxy library - Overkill for this use case

**Chosen:** Native `fetch` + stream

**Rationale:**
- No additional dependencies
- Next.js 14+ supports streaming natively
- Simple and maintainable
- Performance is sufficient

**Trade-offs:**
- Gain: Simplicity, no extra dependencies, native support
- Lose: Less advanced features (not needed here)

#### Decision 3: Authentication Strategy
**Options Considered:**
1. Forward session token in Authorization header - Standard, secure
2. Pass session in request body - Simpler, but less standard
3. Extract user ID from session, pass in body - Clear separation

**Chosen:** Extract user ID from session, pass in body

**Rationale:**
- Go backend expects `userId` in request body (per PR#4 design)
- Session validation happens in Next.js (where it belongs)
- Clear separation: Next.js handles auth, Go handles LLM
- Simpler than header forwarding

**Trade-offs:**
- Gain: Clear separation of concerns, simpler implementation
- Lose: Less standard (but acceptable for internal API)

#### Decision 4: Error Handling
**Options Considered:**
1. Return Go backend errors as-is - Simple, but may leak internals
2. Transform errors to generic messages - Safer, but loses detail
3. Log errors, return generic to client - Best practice

**Chosen:** Log errors, return generic to client

**Rationale:**
- Prevents leaking internal details to frontend
- Logs provide debugging information
- Consistent with security best practices
- Error details available in server logs

**Trade-offs:**
- Gain: Security, consistent error handling
- Lose: Less detailed error messages (acceptable trade-off)

#### Decision 5: Feature Flag Integration
**Options Considered:**
1. Check feature flag in route - Early exit, clear
2. Check in useChat hook - Later exit, less clear
3. Check in both - Redundant but safe

**Chosen:** Check feature flag in route

**Rationale:**
- Early exit prevents unnecessary processing
- Clear error message (404 when disabled)
- Consistent with Go backend pattern
- Single source of truth

**Trade-offs:**
- Gain: Early exit, clear error, consistent pattern
- Lose: None (this is the right approach)

### Data Model

**No database changes** - This PR only creates a proxy route.

### API Design

**New Endpoint:** `POST /api/chat`

**Request Format:**
```typescript
{
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: string;
    toolInvocations?: Array<{
      toolCallId: string;
      toolName: string;
      args: Record<string, any>;
      result?: any;
    }>;
  }>;
  workspaceId?: string;  // Optional, can be in body or extracted from context
  userId?: string;       // Optional, extracted from session if not provided
}
```

**Response Format:**
- **Success:** `200 OK` with `text/event-stream` content type
- **Error:** `400/401/404/500` with error message

**Response Body (Streaming):**
```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"text-delta","textDelta":" world"}

data: {"type":"finish","finishReason":"stop"}
```

### Component Hierarchy

```
Frontend (useChat hook)
    ↓ POST /api/chat
Next.js API Route (route.ts)
    ↓ POST /api/v1/chat/stream
Go Worker Endpoint
    ↓ Streams AI SDK protocol
Next.js API Route
    ↓ Streams to client
Frontend (useChat receives stream)
```

---

## Implementation Details

### File Structure

**New Files:**
```
chartsmith-app/
└── app/
    └── api/
        └── chat/
            └── route.ts (~150 lines) - Main proxy route handler
```

**Modified Files:**
- `chartsmith-app/.env.example` (+1 line) - Add `GO_WORKER_URL` example
- `chartsmith-app/types/env.d.ts` (+2 lines) - Add `GO_WORKER_URL` type

### Key Implementation Steps

#### Phase 1: Create Route File (30 minutes)

1. **Create directory structure**
   ```bash
   mkdir -p chartsmith-app/app/api/chat
   ```

2. **Create route handler**
   - Import Next.js server utilities
   - Import authentication utilities
   - Import feature flag utilities
   - Import Go worker URL helper

3. **Implement POST handler**
   - Check feature flag (early exit if disabled)
   - Validate session (return 401 if not authenticated)
   - Parse request body
   - Validate required fields (messages array)
   - Extract workspaceId and userId
   - Forward to Go worker
   - Stream response back

#### Phase 2: Go Worker URL Configuration (15 minutes)

1. **Create helper function**
   - Check `GO_WORKER_URL` environment variable
   - Fall back to database param if available
   - Default to `http://localhost:8080` for development

2. **Update environment types**
   - Add `GO_WORKER_URL` to TypeScript env types

3. **Update .env.example**
   - Add `GO_WORKER_URL` with default value

#### Phase 3: Error Handling (30 minutes)

1. **Implement error handling**
   - Try/catch around fetch call
   - Handle network errors
   - Handle Go backend errors
   - Log errors appropriately
   - Return appropriate HTTP status codes

2. **Test error scenarios**
   - Go worker down
   - Invalid request body
   - Missing authentication
   - Feature flag disabled

#### Phase 4: Streaming Implementation (30 minutes)

1. **Verify streaming works**
   - Ensure response body is streamed (not buffered)
   - Set correct headers (`text/event-stream`, `no-cache`)
   - Test with real Go backend (if available)

2. **Handle edge cases**
   - Empty response body
   - Connection errors during stream
   - Timeout handling

#### Phase 5: Testing (45 minutes)

1. **Unit tests**
   - Test authentication failure
   - Test feature flag disabled
   - Test invalid request body
   - Test missing required fields
   - Test successful proxy (mock Go backend)

2. **Integration tests**
   - Test with real Go backend (if available)
   - Test streaming works end-to-end
   - Test error propagation

### Code Examples

**Example 1: Basic Route Handler**

```typescript
// chartsmith-app/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { featureFlags } from '@/lib/config/feature-flags';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Check feature flag
  if (!featureFlags.enableAISDKChat) {
    return NextResponse.json(
      { error: 'AI SDK chat not enabled' },
      { status: 404 }
    );
  }

  // Validate authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { messages, workspaceId } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'Messages array is required' },
      { status: 400 }
    );
  }

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 }
    );
  }

  // Get Go worker URL
  const goWorkerUrl = await getGoWorkerUrl();

  // Forward to Go backend
  try {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Go backend error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Backend error' },
        { status: response.status }
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { error: 'No response body from backend' },
        { status: 500 }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

**Example 2: Environment Configuration**

```typescript
// chartsmith-app/types/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    // ... existing vars ...

    /** Go worker URL for API proxying */
    GO_WORKER_URL?: string;
  }
}
```

**Example 3: Unit Test**

```typescript
// chartsmith-app/app/api/chat/__tests__/route.test.ts
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/config/feature-flags', () => ({
  featureFlags: {
    enableAISDKChat: true,
  },
}));

global.fetch = jest.fn();

describe('POST /api/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when feature flag disabled', async () => {
    // Mock feature flag as disabled
    jest.resetModules();
    jest.doMock('@/lib/config/feature-flags', () => ({
      featureFlags: {
        enableAISDKChat: false,
      },
    }));

    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('AI SDK chat not enabled');
  });

  it('proxies request to Go backend', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-123' },
    });

    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"text-delta","textDelta":"Hello"}\n\n'));
        controller.close();
      },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: mockStream,
    });

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        workspaceId: 'workspace-123',
      }),
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/chat/stream'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('user-123'),
      })
    );
  });
});
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- Authentication validation
- Feature flag check
- Request body validation
- Error handling
- Go worker URL resolution

**Integration Tests:**
- End-to-end streaming (if Go backend available)
- Error propagation from Go backend
- Network error handling

**Manual Tests:**
- Test with real Go backend
- Verify streaming works
- Test error scenarios
- Test with feature flag disabled

### Edge Cases

- Go worker down (network error)
- Go worker returns error status
- Empty response body from Go backend
- Invalid JSON in request body
- Missing required fields
- Feature flag disabled
- Session expired
- Very long messages array
- Timeout scenarios

### Performance Tests

- Response time < 100ms (proxy overhead)
- Streaming latency < 50ms (first token)
- Memory usage (no buffering)

---

## Success Criteria

**Feature is complete when:**
- [ ] `/api/chat` route exists and responds to POST
- [ ] Route validates authentication (returns 401 if not authenticated)
- [ ] Route checks feature flag (returns 404 if disabled)
- [ ] Route validates request body (returns 400 if invalid)
- [ ] Route forwards requests to Go backend correctly
- [ ] Route streams responses back to client correctly
- [ ] Error handling works for all scenarios
- [ ] Unit tests pass
- [ ] Integration tests pass (if Go backend available)
- [ ] No breaking changes to existing functionality
- [ ] Documentation updated

**Performance Targets:**
- Proxy overhead: < 100ms
- First token latency: < 50ms additional overhead
- Memory: No buffering (stream directly)

**Quality Gates:**
- Zero critical bugs
- Test coverage > 80%
- No console errors
- TypeScript strict mode passes

---

## Risk Assessment

### Risk 1: Go Worker URL Configuration
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:** 
- Support multiple configuration methods (env var, param, default)
- Clear error messages if Go worker unreachable
- Default to localhost for development
**Status:** 🟡

### Risk 2: Streaming Protocol Mismatch
**Likelihood:** LOW  
**Impact:** HIGH  
**Mitigation:**
- Verify Go backend outputs correct AI SDK format (PR#4)
- Test streaming end-to-end
- Validate response headers
**Status:** 🟢

### Risk 3: Authentication Bypass
**Likelihood:** LOW  
**Impact:** CRITICAL  
**Mitigation:**
- Always validate session in route
- Never trust client-provided userId
- Use server-side session validation only
**Status:** 🟢

### Risk 4: Error Information Leakage
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Log detailed errors server-side
- Return generic error messages to client
- Never expose internal paths or stack traces
**Status:** 🟢

### Risk 5: Performance Issues
**Likelihood:** LOW  
**Impact:** LOW  
**Mitigation:**
- Stream directly (no buffering)
- Use native fetch (no extra overhead)
- Monitor response times
**Status:** 🟢

---

## Open Questions

1. **Question:** Should we support CORS for this endpoint?
   - **Answer:** No - same-origin only (Next.js handles this)
   - **Decision needed by:** Implementation start

2. **Question:** Should we add request timeout?
   - **Answer:** Yes - use Next.js default timeout (or 30s for streaming)
   - **Decision needed by:** Implementation start

3. **Question:** Should we add rate limiting?
   - **Answer:** Not in this PR - can add later if needed
   - **Decision needed by:** Post-migration

---

## Timeline

**Total Estimate:** 2-3 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Create route file | 30 min | ⏳ |
| 2 | Go worker URL config | 15 min | ⏳ |
| 3 | Error handling | 30 min | ⏳ |
| 4 | Streaming implementation | 30 min | ⏳ |
| 5 | Testing | 45 min | ⏳ |

---

## Dependencies

**Requires:**
- [ ] PR#4 complete (Go chat endpoint exists)
- [ ] Feature flag infrastructure (PR#1)
- [ ] Authentication utilities available
- [ ] Go worker running (for integration testing)

**Blocks:**
- PR#6 (useChat hook implementation)

---

## References

- Related PR: PR#4 (Go Chat HTTP Endpoint)
- AI SDK docs: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
- Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Architecture comparison: `docs/architecture-comparison.md`
- PRD: `docs/PRD-vercel-ai-sdk-migration.md`

