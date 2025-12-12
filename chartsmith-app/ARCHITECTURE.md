# Architecture and Design for Chartsmith-app

This is a next.js project that is the front end for chartsmith.

## Monaco Editor Implementation
- Avoid recreating editor instances
- Use a single editor instance with model swapping for better performance
- Properly clean up models to prevent memory leaks
- We want to make sure that we don't show a "Loading..." state because it causes a lot of UI flashes.

## State managemnet
- Do not pass onChange and other callbacks through to child components
- We use jotai for state, each component should be able to get or set the state it needs
- Each component subscribes to the relevant atoms. This is preferred over callbacks.

## SSR
- We use server side rendering to avoid the "loading" state whenever possible. 
- Move code that requires "use client" into separate controls.

## Database and functions
- We aren't using Next.JS API routes, except when absolutely necessary.
- Front end should call server actions, which call lib/* functions.
- Database queries are not allowed in the server action. Server actions are just wrappers for which lib functions we expose.

## AI SDK Integration

We use the [Vercel AI SDK](https://ai-sdk.dev/docs) for LLM integration with a hybrid architecture:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├──────────────────────────┬──────────────────────────────────┤
│   AIChatContainer        │       ChatContainer              │
│   (AI SDK useChat)       │   (Centrifugo for plans/renders) │
└──────────────────────────┴──────────────────────────────────┘
              │                           │
              ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│     /api/chat            │   │     Go Worker                │
│   (AI SDK streamText)    │   │   (Anthropic/Groq SDKs)      │
└──────────────────────────┘   └──────────────────────────────┘
```

### Streaming Chat (AI SDK) - Conversational Q&A
- **API Route**: `/api/chat` uses AI SDK Core's `streamText` for real-time streaming
- **Frontend**: `AIChatContainer` component uses `useChat` hook from `@ai-sdk/react`
- **Provider**: Configurable via `LLM_PROVIDER` env var (anthropic, openai)
- **Tools**: `getLatestSubchartVersion`, `getLatestKubernetesVersion`
- **Auto-response**: Automatically responds to unanswered user messages (e.g., from workspace creation)

### Complex Workflows (Go + Centrifugo) - Plans, Renders, Conversions
- **Plans, Renders, Conversions**: Handled by Go backend worker
- **Realtime updates**: Streamed via Centrifugo pub/sub
- **Intent detection**: Uses Groq in Go backend for speed
- **File modifications**: Go worker handles all chart file changes

### Key Files
| File | Description |
|------|-------------|
| `lib/llm/provider.ts` | LLM provider configuration and model selection |
| `lib/llm/system-prompts.ts` | System prompts (matches Go `pkg/llm/system.go`) |
| `lib/llm/message-adapter.ts` | Converts between DB messages and AI SDK format |
| `app/api/chat/route.ts` | Streaming API endpoint with tool support |
| `components/AIChatContainer.tsx` | AI SDK chat UI with streaming |
| `hooks/useChartsmithChat.ts` | Custom hook wrapping `useChat` |
| `lib/workspace/actions/save-ai-chat-message.ts` | Persists AI chat messages to DB |

### Feature Flag
Set `USE_AI_SDK_CHAT=true` in `.env.local` to enable the new AI SDK chat in workspaces.
When disabled (default), workspaces use the existing Centrifugo-based `ChatContainer`.

### Provider Switching
```bash
# Anthropic (default)
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022

# OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=sk-...
```

### Message Flow
1. User sends message via `AIChatContainer` input
2. `useChat` hook calls `/api/chat` with message history
3. API route builds system prompt based on role (auto/developer/operator)
4. `streamText` streams response from LLM
5. On completion, message is saved to DB via `saveAIChatMessageAction`
6. Tool calls (e.g., chart version lookup) are executed inline

### Testing
```bash
npm run test:unit    # Jest unit tests (message-adapter, etc.)
npm run test:e2e     # Playwright API tests
npm run build        # TypeScript compilation check
```

See `docs/AI_SDK_MIGRATION.md` for full migration details.
