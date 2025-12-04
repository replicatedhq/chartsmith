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
GO_BACKEND_URL=http://localhost:8080  # Go HTTP server for tools (PR1.5)
```

### Testing

- Unit tests: `lib/ai/__tests__/`, `app/api/chat/__tests__/`
- Mock utilities: `lib/__tests__/ai-mock-utils.ts`
- No real API calls in tests - all mocked for speed and determinism

## AI SDK Tool Integration (PR1.5)

PR1.5 adds tool support to the AI SDK chat, enabling the AI to perform chart operations.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NODE / AI SDK CORE                            │
│                    (All LLM "thinking")                          │
│                                                                  │
│  lib/ai/llmClient.ts     - Shared LLM client, runChat wrapper   │
│  lib/ai/prompts.ts       - System prompts with tool docs        │
│  lib/ai/tools/*.ts       - Tool definitions (4 total)           │
│  lib/ai/tools/utils.ts   - callGoEndpoint helper                │
│                                                                  │
│  Tools (4 total):                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ TYPESCRIPT-ONLY TOOLS (no Go endpoint):                      ││
│  │ - getChartContext         → Direct getWorkspace() call       ││
│  │                                                              ││
│  │ GO BACKEND TOOLS (need HTTP endpoints):                      ││
│  │ - textEditor              → POST /api/tools/editor           ││
│  │ - latestSubchartVersion   → POST /api/tools/versions/subchart││
│  │ - latestKubernetesVersion → POST /api/tools/versions/k8s     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP (JSON, non-streaming)
┌─────────────────────────────────────────────────────────────────┐
│                    GO BACKEND (port 8080)                        │
│                    (Pure application logic)                      │
│                                                                  │
│  pkg/api/server.go            - HTTP server startup              │
│  pkg/api/errors.go            - Standardized error responses     │
│  pkg/api/handlers/editor.go   - File operations (textEditor)     │
│  pkg/api/handlers/versions.go - Version lookups (both tools)     │
│                                                                  │
│  NO LLM CALLS - Go is pure application logic                     │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Descriptions

| Tool | Purpose | Implementation |
|------|---------|----------------|
| `getChartContext` | Load workspace files and metadata | TypeScript-only (calls `getWorkspace()`) |
| `textEditor` | View, create, edit files | Go HTTP (`/api/tools/editor`) |
| `latestSubchartVersion` | ArtifactHub subchart lookup | Go HTTP (`/api/tools/versions/subchart`) |
| `latestKubernetesVersion` | K8s version info | Go HTTP (`/api/tools/versions/kubernetes`) |

### Key Files (PR1.5)

| File | Purpose |
|------|---------|
| `lib/ai/tools/index.ts` | Tool exports and `createTools()` factory |
| `lib/ai/tools/utils.ts` | `callGoEndpoint()` for Go HTTP calls |
| `lib/ai/tools/getChartContext.ts` | Workspace context tool (TypeScript-only) |
| `lib/ai/tools/textEditor.ts` | File operations tool |
| `lib/ai/tools/latestSubchartVersion.ts` | Subchart version lookup tool |
| `lib/ai/tools/latestKubernetesVersion.ts` | K8s version info tool |
| `lib/ai/llmClient.ts` | `runChat()` wrapper with tools support |
| `lib/ai/prompts.ts` | System prompts with tool documentation |
| `pkg/api/server.go` | Go HTTP server for tool endpoints |
| `pkg/api/handlers/editor.go` | textEditor Go handler |
| `pkg/api/handlers/versions.go` | Version lookup Go handlers |

### Request Flow

1. User sends message to `/api/chat` with `workspaceId` and `revisionNumber`
2. Route handler extracts auth header and creates tools via `createTools()`
3. `streamText()` is called with model, messages, system prompt, and tools
4. AI decides to use a tool based on user's request
5. Tool's `execute()` function runs:
   - For `getChartContext`: Calls TypeScript `getWorkspace()` directly
   - For Go-backed tools: Calls `callGoEndpoint()` → Go HTTP server
6. Tool result is returned to the AI
7. AI incorporates result into its response

### Error Response Format

All Go endpoints return standardized JSON errors:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

Error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `EXTERNAL_API_ERROR`

### Auth Pattern

- Auth header is extracted from the incoming request in `route.ts`
- Passed to tool factories via closure: `createTools(authHeader, workspaceId, revisionNumber)`
- Tools forward auth header to Go endpoints via `callGoEndpoint()`
- Go handlers validate tokens against `extension_token` table
