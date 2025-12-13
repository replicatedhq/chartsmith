# Vercel AI SDK Implementation Guide

This guide shows how to complete the migration from the current Go worker implementation to Vercel AI SDK in Next.js.

## What's Been Completed ✅

### Phase 1: Foundation
- [x] Installed Vercel AI SDK packages (`ai`, `@ai-sdk/anthropic`, `zod`)
- [x] Created database helper functions ([lib/workspace/chat-helpers.ts](chartsmith-app/lib/workspace/chat-helpers.ts))
- [x] Created Centrifugo publishing helpers ([lib/realtime/centrifugo-publish.ts](chartsmith-app/lib/realtime/centrifugo-publish.ts))
- [x] Created comprehensive API route with all features ([app/api/chat/conversational/route.ts](chartsmith-app/app/api/chat/conversational/route.ts))
- [x] Migrated system prompts from Go
- [x] Implemented tool calling pattern (latest_subchart_version, latest_kubernetes_version)
- [x] Set up streaming with database persistence
- [x] Set up real-time Centrifugo publishing

## What Needs Completion 🔨

### 1. Context Retrieval Functions

The API route has TODOs for context functions. You need to port these from Go:

**From `pkg/llm/conversational.go`:**

```typescript
// chartsmith-app/lib/workspace/context.ts
import { Workspace } from '../types/workspace';

export async function getChartStructure(workspace: Workspace): Promise<string> {
  // Port from pkg/llm/conversational.go:236-242
  let structure = '';
  for (const chart of workspace.charts) {
    for (const file of chart.files) {
      structure += `File: ${file.filePath}\n`;
    }
  }
  return structure;
}

export async function chooseRelevantFiles(
  workspace: Workspace,
  prompt: string,
  maxFiles: number = 10
): Promise<WorkspaceFile[]> {
  // Port from pkg/workspace/workspace.go - ChooseRelevantFilesForChatMessage
  // This uses embeddings/vector search to find relevant files
  // Simplified version:
  const allFiles = workspace.charts.flatMap(c => c.files);
  return allFiles.slice(0, maxFiles);
}

export async function getPreviousChatHistory(
  workspaceId: string,
  currentMessageId: string
): Promise<Array<{ role: 'user' | 'assistant', content: string }>> {
  // Port from pkg/llm/conversational.go:75-94
  // Get most recent plan
  // Get all chat messages after that plan
  // Format as message array
  return [];
}
```

### 2. Wire Up the API Route

**Modify `lib/workspace/workspace.ts`:**

Find the `createChatMessage` function and change the work queue to call your new API route:

```typescript
// Around line 240 in createChatMessage function
// BEFORE:
await enqueueWork("new_intent", { chatMessageId: id });

// AFTER - for conversational messages:
await enqueueWork("new_ai_sdk_chat", { chatMessageId: id });
```

**Create new work queue handler** in a server action:

```typescript
// chartsmith-app/lib/workspace/actions/process-chat.ts
'use server';

export async function processChatWithAI SDK(chatMessageId: string) {
  // Call the API route
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chat/conversational`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getServerToken()}`,
    },
    body: JSON.stringify({ chatMessageId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to process chat: ${response.statusText}`);
  }
}
```

### 3. Environment Variables

Add to `.env.local`:

```env
# Centrifugo
CENTRIFUGO_API_URL=http://localhost:8000/api
CENTRIFUGO_API_KEY=your-api-key-here

# For server-to-server auth
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Update Go Worker (Optional)

If you want to **completely remove** Go worker conversational chat:

**In `pkg/listener/listener.go`:**

```go
// Comment out or remove the conversational listener
// case "new_nonplan_chat_message":
//   go listener.ConversationalChatMessage(ctx, work)
```

This way, the Go worker still handles other tasks (rendering, plans, conversions) but chat goes through Next.js.

### 5. Testing

**Test the full flow:**

```bash
# 1. Start Next.js
cd chartsmith-app
npm run dev

# 2. Start Go worker (for other tasks)
cd ..
make run-worker

# 3. Start Centrifugo
# (Follow existing setup)

# 4. Create a new workspace and send a message
# The message should stream through Next.js + Vercel AI SDK
```

**Verify:**
- ✅ Message appears in database (`workspace_chat` table)
- ✅ Response streams incrementally
- ✅ Centrifugo publishes real-time updates
- ✅ Frontend receives updates via WebSocket
- ✅ Tool calling works (try asking about Kubernetes versions)

### 6. Common Issues & Solutions

**Issue: "Centrifugo publish failed"**
- Solution: Check `CENTRIFUGO_API_KEY` is set correctly
- Solution: Verify Centrifugo is running on port 8000

**Issue: "Chat message not found"**
- Solution: Ensure `createChatMessage` completes before calling API
- Solution: Check database connection

**Issue: Streaming doesn't update UI**
- Solution: Verify Centrifugo channel format: `${workspaceId}#{userId}`
- Solution: Check `useCentrifugo` hook is subscribed

**Issue: Tool calling doesn't work**
- Solution: Implement `getLatestSubchartVersion` from `pkg/recommendations`
- Solution: Check tool parameters match schema

### 7. Performance Optimization

**After it works, optimize:**

1. **Caching:** Cache chart structure and relevant files
2. **Batching:** Batch Centrifugo publishes (send every 100ms instead of every chunk)
3. **Connection pooling:** Reuse database connections
4. **Streaming improvements:** Use `streamText().pipeDataStreamToResponse()` if switching to SSE

### 8. Migration Checklist

- [ ] Port context retrieval functions
- [ ] Wire up API route to work queue
- [ ] Set environment variables
- [ ] Test basic chat flow
- [ ] Test tool calling
- [ ] Test with multiple messages
- [ ] Test conversation history
- [ ] Update Go worker to skip conversational chat
- [ ] Performance testing
- [ ] Update documentation

## Estimated Time to Complete

- **Context functions:** 2-3 hours
- **Wiring & integration:** 2-3 hours
- **Testing & debugging:** 3-4 hours
- **Total:** 7-10 hours

## Architecture After Migration

```
User sends message
    ↓
Next.js (createChatMessage)
    ↓
PostgreSQL (workspace_chat table)
    ↓
Work Queue (new_ai_sdk_chat)
    ↓
Next.js API Route (/api/chat/conversational)
    ↓
Vercel AI SDK (streamText)
    ↓
Anthropic API
    ↓
Chunks → Database + Centrifugo
    ↓
Frontend (Jotai + useCentrifugo)
```

## Benefits of This Approach

1. **TypeScript end-to-end** - Easier to maintain
2. **Unified codebase** - Frontend and backend in same repo
3. **Better tooling** - Vercel AI SDK handles streaming, tool calling
4. **Flexibility** - Easy to swap LLM providers
5. **Modern patterns** - Uses latest AI SDK features

## Next Steps

1. Start with completing context retrieval functions
2. Wire up one test message end-to-end
3. Gradually migrate all conversational chat
4. Keep Go worker for other tasks (rendering, plans, etc.)
5. Consider migrating other LLM operations later

---

**Need help?** Check:
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [Anthropic SDK Reference](https://docs.anthropic.com/en/api/client-sdks)
- Original Go implementation in `pkg/llm/conversational.go`
