# PR#5: Testing Guide

---

## Test Categories

### 1. Unit Tests

**File:** `chartsmith-app/app/api/chat/__tests__/route.test.ts`

#### Test 1.1: Authentication Failure
**Description:** Route should return 401 when user is not authenticated

**Test Case:**
```typescript
it('returns 401 when not authenticated', async () => {
  // Mock getServerSession to return null
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
```

**Expected:** 401 status, "Unauthorized" error message  
**Actual:** [Record result]

---

#### Test 1.2: Feature Flag Disabled
**Description:** Route should return 404 when feature flag is disabled

**Test Case:**
```typescript
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
```

**Expected:** 404 status, "AI SDK chat not enabled" error message  
**Actual:** [Record result]

---

#### Test 1.3: Invalid Request Body
**Description:** Route should return 400 for invalid JSON

**Test Case:**
```typescript
it('returns 400 for invalid JSON', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123' },
  });

  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: 'invalid json',
  });

  const response = await POST(req);
  const data = await response.json();

  expect(response.status).toBe(400);
  expect(data.error).toBe('Invalid request body');
});
```

**Expected:** 400 status, "Invalid request body" error message  
**Actual:** [Record result]

---

#### Test 1.4: Missing Messages Array
**Description:** Route should return 400 when messages array is missing

**Test Case:**
```typescript
it('returns 400 for missing messages', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123' },
  });

  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({ workspaceId: 'workspace-123' }),
  });

  const response = await POST(req);
  const data = await response.json();

  expect(response.status).toBe(400);
  expect(data.error).toBe('Messages array is required');
});
```

**Expected:** 400 status, "Messages array is required" error message  
**Actual:** [Record result]

---

#### Test 1.5: Empty Messages Array
**Description:** Route should return 400 when messages array is empty

**Test Case:**
```typescript
it('returns 400 for empty messages array', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123' },
  });

  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [],
      workspaceId: 'workspace-123',
    }),
  });

  const response = await POST(req);
  const data = await response.json();

  expect(response.status).toBe(400);
  expect(data.error).toBe('Messages array is required');
});
```

**Expected:** 400 status, "Messages array is required" error message  
**Actual:** [Record result]

---

#### Test 1.6: Missing Workspace ID
**Description:** Route should return 400 when workspaceId is missing

**Test Case:**
```typescript
it('returns 400 for missing workspaceId', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123' },
  });

  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  });

  const response = await POST(req);
  const data = await response.json();

  expect(response.status).toBe(400);
  expect(data.error).toBe('workspaceId is required');
});
```

**Expected:** 400 status, "workspaceId is required" error message  
**Actual:** [Record result]

---

#### Test 1.7: Successful Proxy (Mock)
**Description:** Route should proxy request to Go backend correctly

**Test Case:**
```typescript
it('proxies request to Go backend', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123' },
  });

  const mockStream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('data: {"type":"text-delta","textDelta":"Hello"}\n\n')
      );
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('user-123'),
    })
  );
});
```

**Expected:** 200 status, correct headers, fetch called correctly  
**Actual:** [Record result]

---

#### Test 1.8: Go Backend Error
**Description:** Route should handle Go backend errors correctly

**Test Case:**
```typescript
it('handles Go backend errors', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123' },
  });

  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => 'Internal server error',
  });

  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId: 'workspace-123',
    }),
  });

  const response = await POST(req);
  const data = await response.json();

  expect(response.status).toBe(500);
  expect(data.error).toBe('Backend error');
});
```

**Expected:** 500 status, "Backend error" message  
**Actual:** [Record result]

---

#### Test 1.9: Network Error
**Description:** Route should handle network errors gracefully

**Test Case:**
```typescript
it('handles network errors', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123' },
  });

  (global.fetch as jest.Mock).mockRejectedValue(
    new Error('Network error')
  );

  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId: 'workspace-123',
    }),
  });

  const response = await POST(req);
  const data = await response.json();

  expect(response.status).toBe(500);
  expect(data.error).toBe('Internal server error');
});
```

**Expected:** 500 status, "Internal server error" message  
**Actual:** [Record result]

---

#### Test 1.10: Empty Response Body
**Description:** Route should handle empty response body from Go backend

**Test Case:**
```typescript
it('handles empty response body', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123' },
  });

  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    body: null,
  });

  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId: 'workspace-123',
    }),
  });

  const response = await POST(req);
  const data = await response.json();

  expect(response.status).toBe(500);
  expect(data.error).toBe('No response body from backend');
});
```

**Expected:** 500 status, "No response body from backend" message  
**Actual:** [Record result]

---

### 2. Integration Tests

**File:** `chartsmith-app/app/api/chat/__tests__/route.integration.test.ts`

#### Test 2.1: End-to-End Streaming
**Description:** Test streaming works end-to-end with real Go backend

**Prerequisites:**
- Go worker running with `ENABLE_AI_SDK_CHAT=true`
- Valid workspace ID
- Valid user session

**Test Case:**
```typescript
it('streams response from Go backend', async () => {
  // This test requires real Go backend
  // Skip if not available
  if (!process.env.GO_WORKER_URL) {
    return;
  }

  // Create authenticated request
  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Cookie': 'session=valid-session-cookie',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId: 'test-workspace-id',
    }),
  });

  const response = await POST(req);

  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('text/event-stream');

  // Read stream
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let chunks = '';

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    chunks += decoder.decode(value);
  }

  // Verify SSE format
  expect(chunks).toContain('data:');
  expect(chunks).toMatch(/{"type":"text-delta"/);
});
```

**Expected:** 200 status, SSE format response  
**Actual:** [Record result]

---

#### Test 2.2: Error Propagation
**Description:** Test that Go backend errors propagate correctly

**Test Case:**
```typescript
it('propagates Go backend errors', async () => {
  // Mock Go backend returning 400
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 400,
    text: async () => 'Invalid request',
  });

  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId: 'workspace-123',
    }),
  });

  const response = await POST(req);

  expect(response.status).toBe(400);
});
```

**Expected:** 400 status propagated from Go backend  
**Actual:** [Record result]

---

### 3. Manual Tests

#### Test 3.1: Basic Functionality
**Steps:**
1. Start Next.js dev server: `npm run dev`
2. Start Go worker: `ENABLE_AI_SDK_CHAT=true make run-worker`
3. Open browser dev tools
4. Navigate to chat page
5. Send a message

**Expected:**
- [ ] Request sent to `/api/chat`
- [ ] Response streams correctly
- [ ] No console errors
- [ ] Message appears in chat

**Actual:** [Record result]

---

#### Test 3.2: Authentication
**Steps:**
1. Log out
2. Try to send a message
3. Check network tab

**Expected:**
- [ ] Request returns 401
- [ ] Error message displayed
- [ ] No request sent to Go backend

**Actual:** [Record result]

---

#### Test 3.3: Feature Flag
**Steps:**
1. Set `ENABLE_AI_SDK_CHAT=false`
2. Restart Next.js server
3. Try to send a message

**Expected:**
- [ ] Request returns 404
- [ ] Error message: "AI SDK chat not enabled"
- [ ] No request sent to Go backend

**Actual:** [Record result]

---

#### Test 3.4: Error Handling
**Steps:**
1. Stop Go worker
2. Try to send a message
3. Check error handling

**Expected:**
- [ ] Request returns 500
- [ ] Error message displayed
- [ ] Error logged in server console

**Actual:** [Record result]

---

#### Test 3.5: Streaming Performance
**Steps:**
1. Send a message
2. Measure time to first token
3. Check streaming smoothness

**Expected:**
- [ ] First token appears quickly (< 1 second)
- [ ] Streaming is smooth (no jank)
- [ ] No buffering delays

**Actual:** [Record result]

---

### 4. Edge Cases

#### Test 4.1: Very Long Messages Array
**Description:** Test with 100+ messages

**Test Case:**
```typescript
it('handles very long messages array', async () => {
  const messages = Array.from({ length: 100 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}`,
  }));

  // ... test implementation
});
```

**Expected:** Request handled correctly, no timeout  
**Actual:** [Record result]

---

#### Test 4.2: Special Characters in Messages
**Description:** Test with special characters, emojis, etc.

**Test Case:**
```typescript
it('handles special characters in messages', async () => {
  const messages = [{
    role: 'user',
    content: 'Hello 👋! Test: <>&"\'',
  }];

  // ... test implementation
});
```

**Expected:** Special characters handled correctly  
**Actual:** [Record result]

---

#### Test 4.3: Concurrent Requests
**Description:** Test multiple concurrent requests

**Test Case:**
```typescript
it('handles concurrent requests', async () => {
  const requests = Array.from({ length: 5 }, () =>
    POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        workspaceId: 'workspace-123',
      }),
    }))
  );

  const responses = await Promise.all(requests);
  expect(responses.every(r => r.status === 200)).toBe(true);
});
```

**Expected:** All requests handled correctly  
**Actual:** [Record result]

---

### 5. Performance Tests

#### Test 5.1: Proxy Overhead
**Description:** Measure proxy overhead

**Test Case:**
```typescript
it('proxy overhead is < 100ms', async () => {
  const start = Date.now();
  await POST(req);
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(100);
});
```

**Expected:** Overhead < 100ms  
**Actual:** [Record result]

---

#### Test 5.2: Streaming Latency
**Description:** Measure first token latency

**Test Case:**
```typescript
it('first token latency is < 50ms', async () => {
  const start = Date.now();
  const response = await POST(req);
  const reader = response.body?.getReader();
  const { value } = await reader!.read();
  const latency = Date.now() - start;

  expect(latency).toBeLessThan(50);
});
```

**Expected:** Latency < 50ms  
**Actual:** [Record result]

---

## Acceptance Criteria

Feature is complete when:
- [ ] All unit tests pass
- [ ] Integration tests pass (if Go backend available)
- [ ] Manual tests pass
- [ ] Edge cases handled
- [ ] Performance targets met
- [ ] No console errors
- [ ] Error handling works for all scenarios
- [ ] Code reviewed and approved

---

## Test Execution

### Run All Tests
```bash
# Unit tests
npm test app/api/chat

# Integration tests (if Go backend available)
GO_WORKER_URL=http://localhost:8080 npm test app/api/chat -- --testPathPattern=integration

# All tests
npm test
```

### Run Specific Test
```bash
npm test -- route.test.ts -t "authentication"
```

### Coverage
```bash
npm test -- --coverage app/api/chat
```

---

## Test Results Template

| Test | Status | Notes |
|------|--------|-------|
| Authentication Failure | ✅/❌ | |
| Feature Flag Disabled | ✅/❌ | |
| Invalid Request Body | ✅/❌ | |
| Missing Messages | ✅/❌ | |
| Missing Workspace ID | ✅/❌ | |
| Successful Proxy | ✅/❌ | |
| Go Backend Error | ✅/❌ | |
| Network Error | ✅/❌ | |
| Empty Response Body | ✅/❌ | |
| End-to-End Streaming | ✅/❌ | |
| Error Propagation | ✅/❌ | |

---

**Status:** Ready to test! 🧪

