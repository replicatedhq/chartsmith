# Architecture and Design for Chartsmith-app

This is a next.js project that is the front end for chartsmith.

## Monaco Editor Implementation
- Avoid recreating editor instances
- Use a single editor instance with model swapping for better performance
- Properly clean up models to prevent memory leaks
- We want to make sure that we don't show a "Loading..." state because it causes a lot of UI flashes.

## State Management
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

## AI Chat Systems (PR1)

Chartsmith has **two parallel chat systems** that coexist:

### 1. Existing Go-Based Chat (Workspace Operations)
- **Flow**: `ChatContainer` → `createChatMessageAction` → PostgreSQL queue → Go worker → Centrifugo
- **State**: Managed via Jotai atoms (`messagesAtom`, `plansAtom` in `atoms/workspace.ts`)
- **Components**: `ChatContainer.tsx`, `ChatMessage.tsx`, `PlanChatMessage.tsx`
- **Use case**: Workspace operations, plan generation, file editing, renders
- **LLM**: Go backend calls Anthropic/Groq directly

### 2. NEW AI SDK Chat (Conversational - PR1)
- **Flow**: `AIChat` → `useChat` hook → `/api/chat` → OpenRouter → LLM
- **State**: Managed via AI SDK `useChat` hook
- **Components**: `components/chat/AIChat.tsx`, `AIMessageList.tsx`, `ProviderSelector.tsx`
- **Use case**: Conversational questions, multi-provider chat
- **LLM**: Via OpenRouter (supports Claude Sonnet 4, GPT-4o, etc.)

### AI SDK Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI SDK Chat (PR1)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  components/chat/           lib/ai/                              │
│  ├── AIChat.tsx            ├── provider.ts  (getModel factory)  │
│  ├── AIMessageList.tsx     ├── models.ts    (model definitions) │
│  └── ProviderSelector.tsx  ├── config.ts    (system prompt)     │
│                            └── index.ts     (exports)           │
│                                                                  │
│  app/api/chat/route.ts     ← streamText + OpenRouter             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/ai/provider.ts` | Provider factory - `getModel()` returns OpenRouter models |
| `lib/ai/models.ts` | Available models (Claude Sonnet 4 default, GPT-4o, etc.) |
| `lib/ai/config.ts` | System prompt, defaults, streaming config |
| `app/api/chat/route.ts` | API route using `streamText` from AI SDK |
| `components/chat/AIChat.tsx` | Main chat component with `useChat` hook |
| `components/chat/ProviderSelector.tsx` | Model selection UI (locks after first message) |

### Environment Variables

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx  # Required for AI SDK chat
DEFAULT_AI_PROVIDER=anthropic       # Default: anthropic
DEFAULT_AI_MODEL=anthropic/claude-sonnet-4  # Default model
```

### Testing

- Unit tests: `lib/ai/__tests__/`, `app/api/chat/__tests__/`
- Mock utilities: `lib/__tests__/ai-mock-utils.ts`
- No real API calls in tests - all mocked for speed and determinism
