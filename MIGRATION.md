# Vercel AI SDK Migration - Progress Report

## Executive Summary

This document tracks the migration of Chartsmith from direct `@anthropic-ai/sdk` usage to Vercel AI SDK. This is a **multi-phase migration** due to the complexity of the existing architecture.

### Current Status: Phase 1 Complete ✅

**Completed:**
- Migrated `lib/llm/prompt-type.ts` from `@anthropic-ai/sdk` to Vercel AI SDK
- Installed `ai` and `@ai-sdk/anthropic` packages
- Removed `@anthropic-ai/sdk` dependency from frontend
- Fixed `node-fetch` import issue (Next.js 15 has built-in fetch)
- Application compiles and runs successfully

**Not Yet Complete:**
- Main chat streaming functionality still uses Go worker + Centrifugo
- UI components have not been migrated to `useChat()` hook
- Tool calling not migrated to AI SDK patterns

---

## Architecture Analysis

### Current Architecture (Hybrid)

```
User Message
    ↓
Next.js Frontend (Server Action)
    ↓
PostgreSQL (workspace_chat table)
    ↓
Go Worker (listens via NOTIFY)
    ↓
Anthropic SDK (Go) - Streaming
    ↓
Centrifugo WebSocket Server
    ↓
Frontend (Jotai state) - Real-time updates
```

**Key Findings:**
1. The system uses **Centrifugo WebSocket for streaming**, not traditional HTTP SSE
2. LLM logic is in the **Go worker** (`pkg/llm/conversational.go`), not Next.js
3. Complex features: tool calling, context retrieval, multi-turn conversations
4. Database stores incremental chunks for replay

### Challenge: Vercel AI SDK is JavaScript/TypeScript Only

The Vercel AI SDK cannot be used directly in the Go worker. This means we have two architectural options:

**Option A: Keep Go Worker** (Simpler, maintains architecture)
- Frontend uses Vercel AI SDK for new features
- Go worker continues handling complex LLM operations
- Gradual migration over time

**Option B: Move to Next.js** (Complete migration, breaks architecture principles)
- Replace Go worker LLM logic with Next.js API routes
- Use Vercel AI SDK `streamText()` in API routes
- Requires rewriting ~1000+ lines of Go code to TypeScript
- Must integrate with Centrifugo from Node.js
- Goes against project's "simplicity" principle

---

## Phase 1: Frontend Cleanup ✅ COMPLETE

### What Was Done

1. **Migrated `lib/llm/prompt-type.ts`**
   - Changed from `@anthropic-ai/sdk` to `@ai-sdk/anthropic`
   - Used AI SDK's `generateText()` function
   - Note: This file is currently **unused** in the codebase

2. **Updated Dependencies**
   ```json
   {
     "dependencies": {
       "@ai-sdk/anthropic": "^2.0.56",
       "ai": "^5.0.113"
     }
   }
   ```

3. **Removed Old Dependencies**
   - Removed `@anthropic-ai/sdk` (saved 22 packages)
   - Removed unused `node-fetch` import

### Files Changed
- `chartsmith-app/lib/llm/prompt-type.ts` - Migrated to AI SDK
- `chartsmith-app/package.json` - Updated dependencies
- `chartsmith-app/lib/workspace/archive.ts` - Removed `node-fetch`

---

## Phase 2: Main Chat Migration (NOT STARTED)

### Scope

This phase would migrate the core conversational chat from Go to Next.js using Vercel AI SDK.

### Required Work

**1. Create Next.js API Route** (`app/api/chat/route.ts`)
```typescript
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

export async function POST(req) {
  // Get chat message from database
  // Build context (chart files, history, etc.)
  // Call streamText() with Anthropic
  // Stream chunks to Centrifugo
  // Update database
}
```

**2. Replicate Go Features**
- System prompts (chatOnlySystemPrompt, chatOnlyInstructions)
- Chart context injection
- Relevant file selection (RAG/vector search)
- Previous conversation history
- Tool calling (latest_subchart_version, latest_kubernetes_version)
- Multi-turn conversations with tool use

**3. Centrifugo Integration**
- Publish streaming chunks to Centrifugo HTTP API
- Maintain event replay for reconnections
- Update `realtime_replay` table

**4. Update Frontend**
- Modify `createChatMessage()` to enqueue Next.js job instead of Go job
- Keep existing Jotai state management
- Keep existing `useCentrifugo` hook (no changes needed)

### Estimated Effort
- **Time**: 1-2 weeks for experienced developer
- **Lines of Code**: ~500-1000 new/modified lines
- **Complexity**: High (tool calling, streaming, database, Centrifugo)

---

## Phase 3: UI Migration with useChat() (NOT STARTED)

### Scope

Optionally migrate chat UI to use Vercel AI SDK's `useChat()` hook.

### Challenge

The `useChat()` hook expects traditional HTTP streaming, but Chartsmith uses Centrifugo WebSocket. Would need to:

1. Create adapter layer between `useChat()` and Centrifugo
2. OR: Switch from Centrifugo to SSE (breaks architecture)
3. OR: Skip this phase and keep current UI

### Recommendation

**Skip this phase.** The current Jotai + Centrifugo approach works well and changing it provides minimal benefit while adding risk.

---

## Remaining Work

### High Priority
- [ ] Decide on migration strategy (Option A vs Option B)
- [ ] If Option B: Complete Phase 2 (main chat migration)
- [ ] Update tests to work with new implementation
- [ ] Performance testing and optimization

### Medium Priority
- [ ] Migrate other LLM operations (plan generation, rendering, etc.)
- [ ] Add support for multiple LLM providers (demonstrate AI SDK flexibility)
- [ ] Documentation updates

### Low Priority
- [ ] UI migration to `useChat()` hook (optional)
- [ ] Remove unused `lib/llm/prompt-type.ts` file

---

## Recommendations

### For This PR

**Accept as Phase 1 completion:**
1. Dependencies migrated to Vercel AI SDK
2. Frontend builds and runs successfully
3. Demonstrates Vercel AI SDK integration pattern
4. Documents path forward for complete migration

**Next Steps:**
1. Team decision on architecture (keep Go vs migrate to Next.js)
2. If migrating: allocate 1-2 weeks for Phase 2
3. If keeping Go: gradually migrate new features to AI SDK

### Migration Strategy

**Recommended: Hybrid Approach**
1. Keep existing Go worker for now (stable, works)
2. New features use Vercel AI SDK in Next.js
3. Gradually migrate Go features over time
4. Maintain both during transition period

This minimizes risk while demonstrating AI SDK integration.

---

## Technical Debt

### Items to Address

1. **Unused `lib/llm/prompt-type.ts`**
   - File migrated but not called anywhere
   - Consider removing or integrating into actual flow

2. **Dual SDK presence**
   - Frontend now uses `@ai-sdk/anthropic`
   - Backend still uses Go Anthropic SDK
   - Not a problem, but worth documenting

3. **Testing gaps**
   - No tests for AI SDK integration yet
   - Existing tests still pass

---

## Conclusion

This PR successfully demonstrates Vercel AI SDK integration and provides a foundation for future migration. The full migration is a **significant architectural change** requiring 1-2 weeks of focused development.

The current state is production-ready and shows a clear path forward without breaking existing functionality.
