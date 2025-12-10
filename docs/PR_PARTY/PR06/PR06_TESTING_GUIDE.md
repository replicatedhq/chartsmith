# PR#6: Testing Guide

## Quick Start Testing

### Prerequisites

1. **Feature Flag Enabled**
   ```bash
   # In chartsmith-app/.env.local
   NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true
   ```

2. **Go Backend Running**
   - Go worker should be running on `http://localhost:8080`
   - Endpoint `/api/v1/chat/stream` should be implemented (PR#4)

3. **Next.js Dev Server Running**
   ```bash
   cd chartsmith-app
   npm run dev
   ```

## Testing Methods

### Method 1: Unit Tests (Recommended First Step)

Run the unit tests for message conversion functions:

```bash
cd chartsmith-app
npm test -- lib/types/__tests__/chat.test.ts
```

**What This Tests:**
- ✅ Message format conversion (AI SDK ↔ Message)
- ✅ Metadata preservation
- ✅ Edge cases (empty messages, array content, etc.)

**Expected Result:** All tests pass

### Method 2: Test Component (Manual Testing)

1. **Create a test page** (or add to existing page):

```tsx
// app/test-chat/page.tsx
'use client';

import { TestAIChat } from '@/components/TestAIChat';
import { useSession } from '@/lib/auth/session'; // Adjust import based on your auth setup

export default function TestChatPage() {
  // Get session - adjust based on your auth implementation
  const session = getSession(); // Replace with your session retrieval
  
  // Get workspaceId - you can hardcode for testing
  const workspaceId = 'your-workspace-id';

  if (!session) {
    return <div>Please log in to test</div>;
  }

  return <TestAIChat workspaceId={workspaceId} session={session} />;
}
```

2. **Navigate to** `/test-chat` in your browser

3. **Test Scenarios:**
   - ✅ Send a message and see it appear
   - ✅ See streaming response appear incrementally
   - ✅ Change role selector and verify it's sent
   - ✅ Test stop button during streaming
   - ✅ Test reload button
   - ✅ Verify messages persist in atom
   - ✅ Check browser console for errors

### Method 3: Integration Test with Mock Endpoint

If Go backend isn't ready, you can mock the endpoint:

```typescript
// Create a mock API route for testing
// app/api/chat-mock/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  
  // Return mock streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const messages = ['Hello', ' ', 'world', '!'];
      messages.forEach((chunk, i) => {
        setTimeout(() => {
          controller.enqueue(
            encoder.encode(`data: {"type":"text-delta","textDelta":"${chunk}"}\n\n`)
          );
          if (i === messages.length - 1) {
            controller.enqueue(
              encoder.encode(`data: {"type":"finish","finishReason":"stop"}\n\n`)
            );
            controller.close();
          }
        }, i * 100);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

Then temporarily change the hook to use `/api/chat-mock`:

```typescript
// In useAIChat.ts, change:
api: '/api/chat-mock', // Temporarily use mock
```

### Method 4: Browser DevTools Testing

1. **Open Browser DevTools** (F12)
2. **Network Tab**: Watch for `/api/chat` requests
3. **Console Tab**: Check for errors or warnings
4. **React DevTools**: Inspect hook state

**What to Check:**
- ✅ Request includes `workspaceId` and `role` in body
- ✅ Response streams correctly (SSE format)
- ✅ No CORS errors
- ✅ No authentication errors
- ✅ Messages update in real-time

## Test Scenarios

### Scenario 1: Basic Message Flow
1. Type a message: "Hello"
2. Click Send
3. **Expected:**
   - Message appears in UI immediately
   - Loading indicator shows
   - Response streams in incrementally
   - Loading indicator disappears when complete

### Scenario 2: Role Selection
1. Select "developer" role
2. Send message
3. **Expected:**
   - Request body includes `role: "developer"`
   - Backend receives correct role

### Scenario 3: Historical Messages
1. Load page with existing workspace
2. **Expected:**
   - Previous messages load automatically
   - Messages appear in correct format
   - No duplicate messages

### Scenario 4: Error Handling
1. Stop Go backend
2. Try to send message
3. **Expected:**
   - Error message displays
   - UI doesn't crash
   - Can retry after fixing backend

### Scenario 5: Stop During Streaming
1. Send a long message
2. Click Stop while streaming
3. **Expected:**
   - Streaming stops immediately
   - Partial response preserved
   - Can send new message

### Scenario 6: Reload
1. Send a message and get response
2. Click Reload
3. **Expected:**
   - Last message regenerates
   - Previous response replaced

## Debugging Tips

### Issue: Hook throws "AI SDK chat is not enabled"
**Solution:** Check feature flag:
```bash
echo $NEXT_PUBLIC_ENABLE_AI_SDK_CHAT
# Should output: true
```

### Issue: Messages not appearing
**Check:**
1. Browser console for errors
2. Network tab for failed requests
3. React DevTools - check `messagesAtom` state
4. Verify `useAIChat` is being called

### Issue: Streaming not working
**Check:**
1. Go backend endpoint exists and responds
2. Response headers include `Content-Type: text/event-stream`
3. Response format matches AI SDK protocol
4. Browser supports SSE (all modern browsers do)

### Issue: Messages not syncing to atom
**Check:**
1. Feature flag is enabled
2. `useEffect` dependencies are correct
3. `setMessages` is being called
4. Check React DevTools for atom updates

## Performance Testing

### Measure Conversion Time
```typescript
// Add to chat.test.ts
it('should convert messages quickly', () => {
  const start = performance.now();
  const messages = Array(100).fill(null).map((_, i) => ({
    id: `msg-${i}`,
    prompt: `Message ${i}`,
    response: `Response ${i}`,
    isComplete: true,
  }));
  messagesToAIMessages(messages);
  const end = performance.now();
  
  expect(end - start).toBeLessThan(10); // Should be < 10ms
});
```

### Measure Hook Initialization
```typescript
// In TestAIChat component
useEffect(() => {
  const start = performance.now();
  // Hook initialization happens here
  const end = performance.now();
  console.log(`Hook init: ${end - start}ms`);
}, []);
```

## Success Criteria Checklist

- [ ] Unit tests pass (all conversion functions)
- [ ] Test component renders without errors
- [ ] Can send message and receive response
- [ ] Streaming works (text appears incrementally)
- [ ] Role selector works
- [ ] Historical messages load
- [ ] Messages sync to Jotai atom
- [ ] Stop button works
- [ ] Reload button works
- [ ] Error handling works
- [ ] No console errors
- [ ] Performance acceptable (<100ms init, <10ms conversion)

## Next Steps After Testing

Once PR#6 is verified working:
1. ✅ PR#7: Migrate ChatContainer to use useAIChat
2. ✅ PR#8: Tool Call Protocol Support
3. ✅ Full E2E testing with real chat flow
