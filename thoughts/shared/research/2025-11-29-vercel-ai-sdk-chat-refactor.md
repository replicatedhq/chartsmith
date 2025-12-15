---
date: 2025-11-29T20:26:10-0600
researcher: Claude
git_commit: 732e6d7eabf64e5da0fe42c82f483908d74db1c4
branch: main
repository: chartsmith
topic: "Chat Functionality for Vercel AI SDK Migration"
tags: [research, codebase, chat, llm, anthropic, vercel-ai-sdk, refactor]
status: complete
last_updated: 2025-11-29
last_updated_by: Claude
last_updated_note: "Added migration decision and complexity assessment"
---

# Research: Chat Functionality for Vercel AI SDK Migration

**Date**: 2025-11-29T20:26:10-0600
**Researcher**: Claude
**Git Commit**: 732e6d7eabf64e5da0fe42c82f483908d74db1c4
**Branch**: main
**Repository**: chartsmith

## Research Question

Understand the current chat implementation and identify all files relevant to migrating from direct Anthropic SDK usage to Vercel AI SDK. Specifically: Can the refactor be isolated to just the chat-related functions in the backend and frontend?

## Summary

**Yes, the refactor can be isolated to specific chat-related functions.** The chat functionality uses a clear separation:

1. **Frontend**: Chat UI components that receive streamed updates via Centrifugo (WebSocket) - no direct LLM calls
2. **Backend Go**: LLM integration layer in `pkg/llm/` that makes Anthropic API calls and streams responses

The frontend does NOT call Anthropic directly (except one intent classification function). All LLM calls happen in the Go backend worker. The migration involves:
- **Frontend**: Replace custom streaming handling with Vercel AI SDK hooks (if desired)
- **Backend**: Replace direct Anthropic SDK calls in `pkg/llm/` with Vercel AI SDK Core (or keep Go backend and adjust API format)

---

## Detailed Findings

### Frontend Chat Components

#### Entry Points

| File | Lines | Description |
|------|-------|-------------|
| `chartsmith-app/components/ChatContainer.tsx` | 18-222 | Primary chat UI container |
| `chartsmith-app/components/ChatMessage.tsx` | 72-398 | Standard chat message display |
| `chartsmith-app/components/PlanChatMessage.tsx` | 38-393 | Plan proposal message display |
| `chartsmith-app/components/NewChartChatMessage.tsx` | 69-360 | New chart creation flow |

#### State Management (Jotai Atoms)

| File | Lines | Description |
|------|-------|-------------|
| `chartsmith-app/atoms/workspace.ts` | 10 | `messagesAtom` - Array of chat messages |
| `chartsmith-app/atoms/workspace.ts` | 11-14 | `messageByIdAtom` - Message getter |
| `chartsmith-app/atoms/workspace.ts` | 132-147 | `handlePlanUpdatedAtom` - Plan update handler |
| `chartsmith-app/atoms/workspace.ts` | 256-261 | `activeRenderIdsAtom`, `isRenderingAtom` |

#### Real-Time Updates (Centrifugo Hook)

| File | Lines | Description |
|------|-------|-------------|
| `chartsmith-app/hooks/useCentrifugo.ts` | 42-607 | Main Centrifugo hook |
| `chartsmith-app/hooks/useCentrifugo.ts` | 89-141 | `handleChatMessageUpdated` - Updates messages atom |
| `chartsmith-app/hooks/useCentrifugo.ts` | 443-482 | `handleCentrifugoMessage` - Event routing |
| `chartsmith-app/hooks/useCentrifugo.ts` | 499-603 | Connection setup and subscription |

#### Server Actions

| File | Lines | Description |
|------|-------|-------------|
| `chartsmith-app/lib/workspace/actions/create-chat-message.ts` | 7-9 | `createChatMessageAction` - Creates chat message |
| `chartsmith-app/lib/workspace/workspace.ts` | 164-258 | `createChatMessage` - Database insert + queue |
| `chartsmith-app/lib/workspace/chat.ts` | 31-96 | `listMessagesForWorkspace` - Fetches messages |

#### Only Anthropic SDK Usage in Frontend

| File | Lines | Description |
|------|-------|-------------|
| `chartsmith-app/lib/llm/prompt-type.ts` | 1, 19-50 | Intent classification (uses Claude to classify "plan" vs "chat") |
| `chartsmith-app/package.json` | 21 | `@anthropic-ai/sdk": "^0.39.0"` |

**Key Finding**: The frontend only uses Anthropic SDK for a single intent classification function. All streaming responses come via Centrifugo events, not direct LLM streaming.

---

### Backend Go LLM Integration

#### Client Initialization

| File | Lines | Description |
|------|-------|-------------|
| `pkg/llm/client.go` | 12-21 | `newAnthropicClient()` - Creates Anthropic client |
| `pkg/param/param.go` | 17-26 | API key from env or AWS SSM |

#### Model Constants

| File | Lines | Description |
|------|-------|-------------|
| `pkg/llm/execute-action.go` | 23 | `Model_Sonnet37 = "claude-3-7-sonnet-20250219"` |
| `pkg/llm/execute-action.go` | 24 | `Model_Sonnet35 = "claude-3-5-sonnet-20241022"` |

#### Core LLM Functions (Primary Refactor Targets)

| File | Lines | Description |
|------|-------|-------------|
| `pkg/llm/conversational.go` | 14-234 | **Conversational chat** - Q&A with streaming |
| `pkg/llm/plan.go` | 21-116 | **Plan generation** - Streams plan descriptions |
| `pkg/llm/initial-plan.go` | 21-85 | **Initial plan** - First plan for new workspace |
| `pkg/llm/execute-action.go` | 437-676 | **Action execution** - Text editor tool calling |
| `pkg/llm/execute-plan.go` | 14-105 | **Execute plan** - Generates file actions |
| `pkg/llm/intent.go` | 15-143 | **Intent classification** - Uses Groq/Llama (not Anthropic) |
| `pkg/llm/expand.go` | 10-54 | **Prompt expansion** - Expands queries for vector search |
| `pkg/llm/summarize.go` | 35-125 | **Summarization** - Summarizes content (cached) |

#### Streaming Implementation Pattern

```go
// pkg/llm/conversational.go:136-158
stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
    Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
    MaxTokens: anthropic.F(int64(8192)),
    Messages:  anthropic.F(messages),
    Tools:     anthropic.F(toolUnionParams),
})

for stream.Next() {
    event := stream.Current()
    message.Accumulate(event)
    switch event := event.AsUnion().(type) {
    case anthropic.ContentBlockDeltaEvent:
        if event.Delta.Text != "" {
            streamCh <- event.Delta.Text  // Send to Go channel
        }
    }
}
```

#### Tool Definitions

| File | Lines | Tools |
|------|-------|-------|
| `pkg/llm/conversational.go` | 99-128 | `latest_subchart_version`, `latest_kubernetes_version` |
| `pkg/llm/execute-action.go` | 510-532 | `text_editor_20241022` (view, str_replace, create) |

#### System Prompts

| File | Lines | Description |
|------|-------|-------------|
| `pkg/llm/system.go` | 3-18 | `endUserSystemPrompt` - For operators |
| `pkg/llm/system.go` | 20-55 | `commonSystemPrompt` - For developers |
| `pkg/llm/system.go` | 57-65 | `chatOnlySystemPrompt` - Conversational |
| `pkg/llm/system.go` | 67-76 | `initialPlanSystemPrompt` |
| `pkg/llm/system.go` | 78-87 | `updatePlanSystemPrompt` |
| `pkg/llm/system.go` | 89-98 | `detailedPlanSystemPrompt` |
| `pkg/llm/system.go` | 111-120 | `executePlanSystemPrompt` |

---

### Worker/Listener Layer (Connects LLM to Chat)

| File | Lines | Description |
|------|-------|-------------|
| `pkg/listener/start.go` | 13-119 | `StartListeners()` - Registers all handlers |
| `pkg/listener/new_intent.go` | 24-349 | Intent classification handler |
| `pkg/listener/conversational.go` | 22-104 | Conversational chat handler |
| `pkg/listener/new-plan.go` | 23-124 | Plan generation handler |

#### Streaming to Database + Centrifugo

```go
// pkg/listener/conversational.go:53-100
streamCh := make(chan string, 1)
doneCh := make(chan error, 1)
go func() {
    llm.ConversationalChatMessage(ctx, streamCh, doneCh, w, chatMessage)
}()

for !done {
    select {
    case stream := <-streamCh:
        buffer.WriteString(stream)
        // Send realtime update via Centrifugo
        // Append to database
    case err := <-doneCh:
        // Mark complete
        done = true
    }
}
```

---

### API Endpoints

| File | Lines | Description |
|------|-------|-------------|
| `chartsmith-app/app/api/workspace/[workspaceId]/message/route.ts` | 6-42 | POST - Create chat message |
| `chartsmith-app/app/api/workspace/[workspaceId]/messages/route.ts` | 5-38 | GET - List messages |

---

### Database Schema

| Table | File | Key Fields |
|-------|------|------------|
| `workspace_chat` | `db/schema/tables/workspace-chat.yaml` | id, workspace_id, prompt, response, intent flags, response_plan_id, response_render_id |
| `work_queue` | (referenced in code) | channel, payload, created_at, completed_at |

---

## Architecture Documentation

### Current Data Flow

```
User Input (ChatContainer)
    │
    ▼
createChatMessageAction() ──► Database Insert (workspace_chat)
    │
    ▼
pg_notify('new_intent') ──► Go Worker (pkg/listener/new_intent.go)
    │
    ▼
llm.GetChatMessageIntent() ──► Groq/Llama (intent classification)
    │
    ├── Plan Intent ──► pg_notify('new_plan') ──► llm.CreatePlan()
    │
    ├── Conversational ──► pg_notify('new_conversational') ──► llm.ConversationalChatMessage()
    │
    └── Render/Other ──► respective handlers
    │
    ▼
Anthropic Streaming ──► Go Channel ──► Centrifugo Publish
    │
    ▼
Frontend (useCentrifugo) ──► Jotai Atoms ──► React Re-render
```

### Key Patterns

1. **Async Job Queue**: PostgreSQL LISTEN/NOTIFY with `work_queue` table
2. **Streaming**: Anthropic SDK streaming → Go channels → Centrifugo WebSocket
3. **State Management**: Jotai atoms (not Redux/Context)
4. **Real-time**: Centrifugo pub/sub with per-user channels (`{workspaceId}#{userId}`)

---

## Code References

### Files to Modify for Refactor

**Frontend (Optional - can keep current Centrifugo approach):**
- `chartsmith-app/lib/llm/prompt-type.ts:19-50` - Only direct Anthropic usage
- `chartsmith-app/hooks/useCentrifugo.ts` - If switching to Vercel AI SDK streaming

**Backend Go (Primary):**
- `pkg/llm/client.go:12-21` - Anthropic client initialization
- `pkg/llm/conversational.go:14-234` - Main chat streaming
- `pkg/llm/plan.go:21-116` - Plan generation streaming
- `pkg/llm/initial-plan.go:21-85` - Initial plan streaming
- `pkg/llm/execute-action.go:437-676` - Tool-calling execution
- `pkg/llm/execute-plan.go:14-105` - Plan execution streaming
- `pkg/llm/expand.go:10-54` - Prompt expansion
- `pkg/llm/summarize.go:100-125` - Claude summarization

**Supporting Files (may need type adjustments):**
- `pkg/llm/types/types.go:3-26` - Action plan types
- `pkg/llm/parser.go:16-141` - XML artifact parser
- `pkg/llm/system.go` - System prompts (keep as-is)

---

## Migration Decision

**Decision: Option 1 - Port all LLM code from Go to Next.js API routes**

After evaluating three migration options, we decided to fully port the Go LLM code to TypeScript/Next.js:

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **1. Move to Next.js (CHOSEN)** | Create Next.js API routes using Vercel AI SDK, retire Go `pkg/llm/` | Cleanest integration, `useChat` handles streaming, easier provider switching | Significant architecture change |
| **2. Keep Go, adapt protocol** | Go formats responses to match Vercel AI SDK Data Stream Protocol | Smallest change, keeps Go architecture | Manual protocol implementation, no real AI SDK benefits |
| **3. Hybrid** | Go orchestrates, delegates LLM calls to Next.js | Keeps Go for queues/files, gets AI SDK benefits | Most complex, extra network hop |

### Rationale

- **Vercel AI SDK has no Go support** - It's JavaScript/TypeScript only
- Option 2 would require manually implementing the AI SDK streaming protocol in Go, which defeats the purpose of using the SDK
- Option 1 aligns with refactor doc goals: "simplify the codebase", "reduced maintenance burden"
- The Go LLM files are not overly complex (see complexity assessment below)

---

## Go LLM File Complexity Assessment

| File | Lines | Complexity | Migration Effort |
|------|-------|------------|------------------|
| `pkg/llm/expand.go` | 55 | **Very Low** | ~1 hour |
| `pkg/llm/plan.go` | 117 | **Low** | ~2-3 hours |
| `pkg/llm/initial-plan.go` | 107 | **Low** | ~2-3 hours |
| `pkg/llm/execute-plan.go` | 106 | **Low** | ~2-3 hours |
| `pkg/llm/summarize.go` | 177 | **Low** | ~2-3 hours |
| `pkg/llm/conversational.go` | 243 | **Medium** | ~4-6 hours |
| `pkg/llm/intent.go` | 275 | **Medium** | ~4-6 hours |
| `pkg/llm/execute-action.go` | 677 | **High** | ~1-2 days |

**Total estimated effort: ~3-5 days**

### Complexity Notes

**Low complexity files** (`plan.go`, `initial-plan.go`, `execute-plan.go`, `expand.go`):
- Straightforward message construction + streaming
- Direct mapping to Vercel AI SDK `streamText()`

**Medium complexity** (`conversational.go`):
- Has 2 simple tools (`latest_subchart_version`, `latest_kubernetes_version`)
- Tool result loop continues until no more tool calls
- Maps well to Vercel AI SDK `tool()` helper

**Medium complexity** (`intent.go`):
- Uses Groq with `llama-3.3-70b-versatile` (not Anthropic)
- Vercel AI SDK supports Groq via `@ai-sdk/groq`

**High complexity** (`execute-action.go`):
- Text editor tool with `view`, `str_replace`, `create` commands
- Fuzzy string matching algorithm (lines 319-435) with timeout
- Activity monitoring goroutine to detect stalled LLM
- Database logging of str_replace operations
- **Note**: The complex parts (fuzzy matching, monitoring, logging) are business logic, not LLM-specific

---

## Questions Resolved

### 1. Go vs Node.js Backend

**Answer**: Vercel AI SDK is JavaScript/TypeScript only. No Go SDK exists.

**Decision**: Port LLM code to Next.js API routes. The Go backend will remain for non-LLM work (helm rendering, file operations, etc.) but chat/LLM functionality moves to Next.js.

### 2. Centrifugo Integration

**Answer**: Vercel AI SDK uses Server-Sent Events (SSE) for streaming via HTTP.

**Decision**: Replace Centrifugo for chat streaming with Vercel AI SDK's native streaming. The frontend will use `useChat` hook which handles SSE streaming automatically. Centrifugo may still be used for other real-time events (render progress, file updates).

### 3. Intent Classification (Groq/Llama)

**Answer**: Vercel AI SDK fully supports Groq via `@ai-sdk/groq` package.

**Decision**: Port intent classification to use Vercel AI SDK with Groq provider:
```typescript
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const { text } = await generateText({
  model: groq('llama-3.3-70b-versatile'),
  prompt: 'Classify this intent...',
});
```

### 4. Tool Calling

**Answer**: Vercel AI SDK has its own tool abstraction that works across providers.

**Decision**: Redefine tools using Vercel AI SDK format:
```typescript
import { tool } from 'ai';
import { z } from 'zod';

const textEditorTool = tool({
  description: 'Edit files using view, str_replace, or create commands',
  parameters: z.object({
    command: z.enum(['view', 'str_replace', 'create']),
    path: z.string(),
    old_str: z.string().optional(),
    new_str: z.string().optional(),
  }),
  execute: async ({ command, path, old_str, new_str }) => {
    // Port logic from execute-action.go
  },
});
```

---

## New Architecture (Post-Migration)

```
User Input (ChatContainer)
    │
    ▼
useChat() hook ──► POST /api/chat (Next.js API Route)
    │
    ▼
Vercel AI SDK ──► streamText() / generateText()
    │
    ├── anthropic('claude-sonnet-4-5') for chat/plans
    │
    └── groq('llama-3.3-70b-versatile') for intent
    │
    ▼
SSE Stream ──► useChat() state ──► React Re-render
```

### Key Changes

| Before | After |
|--------|-------|
| Go `pkg/llm/*.go` | Next.js `app/api/chat/route.ts` |
| Anthropic Go SDK | `@ai-sdk/anthropic` |
| Groq Go SDK | `@ai-sdk/groq` |
| PostgreSQL LISTEN/NOTIFY for chat | Direct API route calls |
| Centrifugo for chat streaming | Vercel AI SDK SSE |
| Custom streaming via channels | `useChat` hook |
| Jotai atoms for messages | `useChat` manages state |

### Files to Create

| New File | Replaces |
|----------|----------|
| `app/api/chat/route.ts` | `pkg/llm/conversational.go`, `pkg/listener/conversational.go` |
| `app/api/chat/intent/route.ts` | `pkg/llm/intent.go`, `pkg/listener/new_intent.go` |
| `app/api/chat/plan/route.ts` | `pkg/llm/plan.go`, `pkg/llm/initial-plan.go`, `pkg/listener/new-plan.go` |
| `app/api/chat/execute/route.ts` | `pkg/llm/execute-plan.go`, `pkg/llm/execute-action.go` |
| `lib/llm/tools.ts` | Tool definitions from Go |
| `lib/llm/prompts.ts` | `pkg/llm/system.go` |
| `lib/llm/fuzzy-match.ts` | Fuzzy matching from `execute-action.go` |

### Go Code to Retire (Chat-Related)

```
pkg/llm/
├── client.go          # Remove (replaced by AI SDK)
├── conversational.go  # Remove
├── plan.go            # Remove
├── initial-plan.go    # Remove
├── execute-plan.go    # Remove
├── execute-action.go  # Remove (port fuzzy logic to TS)
├── intent.go          # Remove
├── expand.go          # Remove
├── summarize.go       # Remove
├── system.go          # Port to TS
├── parser.go          # Port to TS
└── types/types.go     # Port to TS

pkg/listener/
├── conversational.go  # Remove
├── new_intent.go      # Remove
└── new-plan.go        # Remove
```
