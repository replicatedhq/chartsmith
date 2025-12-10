# PR-14: Documentation Updates

**Branch:** `docs/ai-sdk-migration`
**Dependencies:** PR-12, PR-13 (Migration complete)
**Parallel With:** Can start earlier, finalize after cleanup
**Estimated Complexity:** Low
**Success Criteria:** Complete migration documentation

---

## Overview

Update all project documentation to reflect the Vercel AI SDK migration. This includes architecture docs, READMEs, contributing guides, and inline code documentation.

## Prerequisites

- PR-12 and PR-13 merged (or nearly complete)
- Migration validated in production
- Clear understanding of final architecture

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Doc location | Existing files | Maintain structure |
| Diagrams | Mermaid in markdown | Easy to maintain |
| Migration guide | Separate doc | Historical reference |

---

## Step-by-Step Instructions

### Step 1: Update ARCHITECTURE.md

```markdown
<!-- ARCHITECTURE.md -->

## LLM Integration

### Overview

Chartsmith uses the Vercel AI SDK for all chat functionality. The AI SDK Data Stream Protocol
enables efficient streaming between the Go backend and React frontend.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                          │
│  ┌──────────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │  ChatContainer   │───▶│   useAIChat     │───▶│   /api/chat   │  │
│  │  ChatMessage     │    │   (AI SDK)      │    │   (proxy)     │  │
│  └──────────────────┘    └─────────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP SSE
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend (Go Worker)                         │
│  ┌──────────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │  /api/v1/chat/   │───▶│  AISDKStream    │───▶│   Anthropic   │  │
│  │    stream        │    │    Writer       │    │     API       │  │
│  └──────────────────┘    └─────────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `useAIChat` | `chartsmith-app/hooks/` | React hook wrapping AI SDK |
| `ChatContainer` | `chartsmith-app/components/` | Chat input UI |
| `ChatMessage` | `chartsmith-app/components/` | Message display |
| `AISDKStreamWriter` | `pkg/llm/aisdk.go` | SSE stream writer |
| Chat Handler | `pkg/api/handlers/chat_stream.go` | HTTP endpoint |

### Streaming Protocol

We use the [AI SDK Data Stream Protocol](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol):

```
0:"text chunk"           # text-delta
9:{"toolCallId":"..."}   # tool-call
a:{"toolCallId":"..."}   # tool-result
e:{"finishReason":"..."}  # finish
d:{"finishReason":"..."}  # data (finish message)
```

### Tool Calling

Tools are defined in Go and executed server-side:

| Tool | Purpose | Location |
|------|---------|----------|
| `latest_subchart_version` | Get latest Helm chart version | `pkg/llm/tools.go` |
| `latest_kubernetes_version` | Get latest K8s version | `pkg/llm/tools.go` |
| `text_editor` | File editing for plans | `pkg/llm/tools.go` |

### Message Persistence

Messages are persisted to PostgreSQL via the existing schema:

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  prompt TEXT,
  response TEXT,
  revision_number INTEGER,
  created_at TIMESTAMP
);
```

### Non-Chat Realtime (Centrifugo)

Centrifugo WebSocket is still used for:
- Plan execution updates
- Chart render progress
- Workspace collaboration

Chat no longer uses Centrifugo - it uses HTTP SSE via AI SDK.
```

### Step 2: Update chartsmith-app/ARCHITECTURE.md

```markdown
<!-- chartsmith-app/ARCHITECTURE.md -->

## Chat Implementation

### AI SDK Integration

Chat uses the Vercel AI SDK (`@ai-sdk/react`):

```typescript
import { useAIChat } from '@/hooks/useAIChat';

function Chat({ workspace }) {
  const { messages, input, handleSubmit, isLoading } = useAIChat({
    workspaceId: workspace.id,
  });

  return (
    <form onSubmit={handleSubmit}>
      <MessageList messages={messages} />
      <input value={input} onChange={handleInputChange} />
    </form>
  );
}
```

### Key Files

| File | Purpose |
|------|---------|
| `hooks/useAIChat.ts` | Wrapper around AI SDK useChat |
| `components/ChatContainer.tsx` | Chat input form |
| `components/ChatMessage.tsx` | Message rendering |
| `app/api/chat/route.ts` | Proxy to Go backend |
| `lib/services/chat-persistence.ts` | Message persistence |

### State Management

Chat state is managed by the AI SDK's `useChat` hook:
- Messages array (automatic)
- Input value (automatic)
- Loading state (automatic)
- Error handling (automatic)

No Jotai atoms needed for chat messages (simplification from previous implementation).

### Streaming

Streaming is handled automatically by the AI SDK:
1. User submits message
2. `useChat` sends POST to `/api/chat`
3. Next.js proxies to Go backend
4. Go streams AI SDK protocol events
5. `useChat` updates messages reactively
```

### Step 3: Update CONTRIBUTING.md

```markdown
<!-- CONTRIBUTING.md -->

## Chat Development

### Running Chat Locally

1. Start the Go worker:
   ```bash
   make run-worker
   ```

2. Start the frontend:
   ```bash
   cd chartsmith-app
   npm run dev
   ```

3. Chat is available at any workspace page.

### Chat Architecture

Chat uses the Vercel AI SDK:
- Frontend: `@ai-sdk/react` with `useChat` hook
- Backend: Custom `AISDKStreamWriter` implementing AI SDK protocol
- Transport: HTTP Server-Sent Events (SSE)

### Adding New Chat Tools

1. Define tool in Go (`pkg/llm/tools.go`):
   ```go
   var MyNewTool = anthropic.ToolParam{
     Name: "my_new_tool",
     Description: "Does something useful",
     InputSchema: anthropic.F(map[string]interface{}{...}),
   }
   ```

2. Add execution handler (`pkg/llm/aisdk_tools.go`):
   ```go
   case "my_new_tool":
     result, err = executeMyNewTool(input)
   ```

3. Tool will automatically stream to frontend via AI SDK protocol.

### Testing Chat

```bash
# Backend tests
go test ./pkg/llm/... -v

# Frontend tests
cd chartsmith-app
npm test -- --testPathPattern=chat

# E2E tests
npm run test:e2e
```
```

### Step 4: Create Migration Summary Doc

```markdown
<!-- docs/MIGRATION-AI-SDK.md -->

# AI SDK Migration Summary

## Overview

In [date], we migrated Chartsmith's chat implementation from a custom Anthropic SDK
integration with Centrifugo WebSocket streaming to the Vercel AI SDK.

## What Changed

### Before (Legacy)

```
Frontend                    Backend
┌────────────┐             ┌────────────┐
│ Anthropic  │             │ Anthropic  │
│ SDK Client │             │ Streaming  │
│ (browser)  │             │   + Pub    │
└─────┬──────┘             └─────┬──────┘
      │                          │
      └────┐                ┌────┘
           │                │
           ▼                ▼
      ┌─────────────────────────┐
      │      Centrifugo         │
      │    (WebSocket pub/sub)  │
      └─────────────────────────┘
```

Issues:
- Anthropic API key exposed in browser
- Complex state management with Jotai atoms
- Custom streaming protocol
- Duplicate SDK dependencies

### After (AI SDK)

```
Frontend                    Backend
┌────────────┐             ┌────────────┐
│  useChat   │────HTTP────▶│  AISDK     │───▶ Anthropic
│ (AI SDK)   │◀───SSE──────│  Writer    │     API
└────────────┘             └────────────┘
```

Benefits:
- No browser API keys
- Simplified state management (AI SDK handles it)
- Standard streaming protocol
- Single source of truth

## Migration PRs

| PR | Description | Status |
|----|-------------|--------|
| PR-01 | Frontend AI SDK packages | Merged |
| PR-02 | Go aisdk-go library | Merged |
| PR-03 | Feature flag infrastructure | Merged |
| PR-04 | Go streaming adapter | Merged |
| PR-05 | Go chat endpoint | Merged |
| PR-06 | Next.js API route | Merged |
| PR-07 | useAIChat hook | Merged |
| PR-08 | ChatContainer migration | Merged |
| PR-09 | ChatMessage migration | Merged |
| PR-10 | Tool calling support | Merged |
| PR-11 | Message persistence | Merged |
| PR-12 | Remove legacy streaming | Merged |
| PR-13 | Remove frontend Anthropic SDK | Merged |
| PR-14 | Documentation updates | Merged |

## Rollback (Historical)

During migration, feature flag `ENABLE_AI_SDK_CHAT` allowed toggling.
Feature flag has been removed post-migration.

## Future Considerations

- Provider switching (OpenAI, etc.) is now easier
- Multi-provider chat is architecturally possible
- Streaming performance improved
```

### Step 5: Update README.md

Add a brief mention in the main README:

```markdown
<!-- README.md -->

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

### Chat

Chat uses the [Vercel AI SDK](https://sdk.vercel.ai) for streaming:
- Frontend: `@ai-sdk/react` hooks
- Backend: Go with AI SDK Data Stream Protocol
- No browser-side API keys required
```

### Step 6: Update Inline Code Documentation

Ensure key files have updated comments:

```go
// pkg/llm/aisdk.go

// Package llm provides LLM integration for Chartsmith.
//
// Chat streaming uses the AI SDK Data Stream Protocol, implemented by
// AISDKStreamWriter. This enables compatibility with the @ai-sdk/react
// useChat hook on the frontend.
//
// Reference: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
```

```typescript
// chartsmith-app/hooks/useAIChat.ts

/**
 * Custom hook for AI SDK chat integration with Chartsmith.
 *
 * This hook wraps @ai-sdk/react's useChat with workspace-specific
 * configuration. It handles:
 * - Workspace ID in requests
 * - Message persistence callbacks
 * - Error handling
 *
 * @see https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
 *
 * @example
 * const { messages, input, handleSubmit } = useAIChat({
 *   session,
 *   workspaceId: 'abc123',
 * });
 */
```

### Step 7: Archive Migration Docs

After migration is complete:

```bash
# Create archive directory
mkdir -p docs/archive/ai-sdk-migration-2024

# Move PR docs to archive (keep for reference)
mv docs/prs/PR-*.md docs/archive/ai-sdk-migration-2024/

# Keep the migration summary in main docs
# docs/MIGRATION-AI-SDK.md stays in place
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `ARCHITECTURE.md` | Modified | Update LLM section |
| `chartsmith-app/ARCHITECTURE.md` | Modified | Update chat section |
| `CONTRIBUTING.md` | Modified | Update dev instructions |
| `README.md` | Modified | Brief mention |
| `docs/MIGRATION-AI-SDK.md` | Added | Migration summary |
| `pkg/llm/aisdk.go` | Modified | Updated comments |
| `chartsmith-app/hooks/useAIChat.ts` | Modified | Updated JSDoc |

---

## Acceptance Criteria

- [ ] ARCHITECTURE.md updated with AI SDK details
- [ ] chartsmith-app/ARCHITECTURE.md updated
- [ ] CONTRIBUTING.md has chat dev instructions
- [ ] README.md mentions AI SDK
- [ ] Migration summary doc created
- [ ] Code comments updated
- [ ] Diagrams are accurate
- [ ] All docs build/render correctly

---

## Documentation Checklist

- [ ] Architecture diagrams match implementation
- [ ] All file paths are correct
- [ ] Code examples work
- [ ] Links are valid
- [ ] No references to legacy implementation
- [ ] No "TODO" or placeholder text

---

## Testing Instructions

1. Review all changed docs
2. Verify code examples compile/run
3. Check diagrams render in GitHub
4. Verify internal links work
5. Have someone unfamiliar with migration read and validate

---

## Rollback Plan

Documentation changes are low-risk. If issues:
1. Git revert documentation commit
2. Re-apply with corrections

---

## PR Checklist

- [ ] ARCHITECTURE.md updated
- [ ] chartsmith-app/ARCHITECTURE.md updated
- [ ] CONTRIBUTING.md updated
- [ ] README.md updated
- [ ] Migration summary created
- [ ] Code comments updated
- [ ] All docs reviewed for accuracy
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Focus on accuracy of architecture diagrams
- Verify code examples are current
- Check for any legacy references that should be removed
- Consider: is anything missing that a new developer would need?
