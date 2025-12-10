# PR-06: Next.js API Route Proxy

**Branch:** `feat/nextjs-chat-api-route`
**Dependencies:** PR-01 (AI SDK packages), PR-03 (Feature flags), PR-05 (Go endpoint)
**Parallel With:** PR-07 (can start together after deps merge)
**Estimated Complexity:** Low
**Success Criteria:** G1, G3 (Frontend connects to backend)

---

## Overview

Create a Next.js API route at `/api/chat` that proxies requests to the Go backend chat endpoint. This route acts as a bridge between the frontend `useChat` hook and the Go worker.

## Prerequisites

- PR-01 merged (AI SDK packages available)
- PR-03 merged (Feature flags available)
- PR-05 merged (Go endpoint available)

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Route path | `/api/chat` | Standard AI SDK convention |
| Proxy method | Fetch + stream | Simple, no extra deps |
| Auth forwarding | Pass session in body | Simpler than header forwarding |

---

## Step-by-Step Instructions

### Step 1: Create the API Route Directory

```bash
mkdir -p chartsmith-app/app/api/chat
```

### Step 2: Create the Route Handler

```typescript
// chartsmith-app/app/api/chat/route.ts

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { featureFlags } from '@/lib/config/feature-flags';
import { getParam } from '@/lib/data/param';

// Disable body parsing - we'll stream the response
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat
 *
 * Proxies chat requests to the Go backend and streams the response.
 * Used by the useChat hook from @ai-sdk/react.
 */
export async function POST(req: NextRequest) {
  // Check feature flag
  if (!featureFlags.enableAISDKChat) {
    return new Response('AI SDK chat not enabled', { status: 404 });
  }

  try {
    // Get session for authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse the request body
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response('Messages array is required', { status: 400 });
    }

    // Get workspace ID from the request
    // The useChat hook should include this in the body
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return new Response('workspaceId is required', { status: 400 });
    }

    // Get the Go worker URL
    const goWorkerUrl = await getGoWorkerUrl();

    // Forward to Go backend
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
      return new Response(errorText || 'Backend error', {
        status: response.status,
      });
    }

    // Check if response body exists
    if (!response.body) {
      return new Response('No response body from backend', { status: 500 });
    }

    // Stream the response back to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API route error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}

/**
 * Get the Go worker URL from configuration
 */
async function getGoWorkerUrl(): Promise<string> {
  // Try environment variable first
  const envUrl = process.env.GO_WORKER_URL;
  if (envUrl) {
    return envUrl;
  }

  // Fall back to param (database config)
  try {
    const paramUrl = await getParam('GO_WORKER_URL');
    if (paramUrl) {
      return paramUrl;
    }
  } catch (e) {
    // Ignore param errors, use default
  }

  // Default for local development
  return 'http://localhost:8080';
}
```

### Step 3: Add Environment Variable

Update `.env.example`:

```bash
# chartsmith-app/.env.example

# ... existing variables ...

# Go Worker URL for API proxying
# Default: http://localhost:8080 (for local development)
GO_WORKER_URL=http://localhost:8080
```

### Step 4: Update Environment Types

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

### Step 5: Create Tests

```typescript
// chartsmith-app/app/api/chat/__tests__/route.test.ts

import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/config/feature-flags', () => ({
  featureFlags: {
    enableAISDKChat: true,
  },
}));

jest.mock('@/lib/data/param', () => ({
  getParam: jest.fn().mockResolvedValue('http://localhost:8080'),
}));

import { getServerSession } from 'next-auth';

describe('POST /api/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [], workspaceId: 'test' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 when messages missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user123' },
    });

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'test' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when workspaceId missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user123' },
    });

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe('POST /api/chat with feature flag disabled', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 404 when feature flag is disabled', async () => {
    jest.doMock('@/lib/config/feature-flags', () => ({
      featureFlags: {
        enableAISDKChat: false,
      },
    }));

    const { POST: POST_disabled } = await import('../route');

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        workspaceId: 'test',
      }),
    });

    const response = await POST_disabled(request);

    expect(response.status).toBe(404);
  });
});
```

### Step 6: Verify Route Works

1. Start the Go worker (with feature flag):
   ```bash
   cd /path/to/chartsmith
   ENABLE_AI_SDK_CHAT=true make run-worker
   ```

2. Start the Next.js dev server (with feature flag):
   ```bash
   cd chartsmith-app
   NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true npm run dev
   ```

3. Test the endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -H "Cookie: <your-session-cookie>" \
     -d '{
       "messages": [{"role": "user", "content": "Hello"}],
       "workspaceId": "<your-workspace-id>"
     }'
   ```

### Step 7: Run Tests

```bash
npm test -- --testPathPattern=api/chat
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `chartsmith-app/app/api/chat/route.ts` | Added | API route handler |
| `chartsmith-app/app/api/chat/__tests__/route.test.ts` | Added | Unit tests |
| `chartsmith-app/.env.example` | Modified | Added GO_WORKER_URL |
| `chartsmith-app/types/env.d.ts` | Modified | Added env type |

---

## Acceptance Criteria

- [ ] `POST /api/chat` endpoint exists
- [ ] Returns 404 when feature flag disabled
- [ ] Returns 401 when not authenticated
- [ ] Returns 400 for missing required fields
- [ ] Successfully proxies to Go backend
- [ ] Streams SSE response back to client
- [ ] Content-Type header is `text/event-stream`
- [ ] Unit tests pass
- [ ] Build succeeds

---

## Testing Instructions

1. Unit tests:
   ```bash
   npm test -- --testPathPattern=api/chat
   ```

2. Integration test:
   - Start Go worker with feature flag
   - Start Next.js with feature flag
   - Use curl or Postman to test endpoint

---

## Important Notes

### CORS

This route runs on the same origin as the frontend, so CORS is not needed. If you need to call this from a different origin, add CORS headers.

### Streaming

The route uses `response.body` directly to stream. This works in Node.js 18+ and Edge runtime. Make sure your Next.js version supports this.

### Timeout

Long responses may timeout. Consider:
- Increasing timeout in production config
- Adding keep-alive pings in Go backend

---

## Rollback Plan

1. Delete `app/api/chat/route.ts`
2. Feature flag already prevents usage

---

## PR Checklist

- [ ] Branch created from `main` (after deps merged)
- [ ] Route file created
- [ ] Tests created and passing
- [ ] Environment variable documented
- [ ] Build passes
- [ ] Manually tested end-to-end
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Route is gated by feature flag
- Auth uses existing session mechanism
- Streaming uses native fetch, no additional packages
- Error handling includes logging for debugging
