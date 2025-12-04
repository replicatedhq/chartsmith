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

## Chat System Architecture

The chat system uses the Vercel AI SDK for streaming LLM interactions. This is an **exception** to the "no API routes" rule because the `useChat()` hook requires an HTTP endpoint.

### File Structure

```
lib/chat/
├── providers/           # LLM provider implementations
│   ├── types.ts         # Core interfaces (ChatProvider, StreamResult, etc.)
│   ├── anthropic.ts     # Anthropic Claude provider
│   ├── openai.ts        # OpenAI GPT provider
│   ├── mock.ts          # Mock provider for testing
│   └── index.ts         # Provider factory
├── tools/               # AI tools for function calling
│   ├── registry.ts      # Tool registration and management
│   ├── kubernetes-version.ts
│   ├── subchart-version.ts
│   ├── write-file.ts    # Tool for creating chart files
│   └── index.ts         # Tool set export
├── prompts/
│   └── system.ts        # System prompts and instructions
├── context-builder.ts   # Pure function to build chat context
├── message-builder.ts   # Convert context to AI SDK message format
├── chat-service.ts      # Main orchestrator with dependency injection
└── index.ts

app/api/chat/
└── route.ts             # Thin orchestration layer for streaming

hooks/
└── useChartsmithChat.ts # Custom hook wrapping useChat()
```

### Design Principles

1. **Dependency Injection**: All external dependencies (providers, HTTP clients, tools) are injectable for testability.

2. **Pure Functions**: `context-builder.ts` and `message-builder.ts` are pure functions with no I/O operations.

3. **Provider Abstraction**: Switch between LLM providers via `CHAT_PROVIDER` environment variable:
   - `anthropic` (default) - Claude Sonnet
   - `openai` - GPT-4o

4. **Thin API Route**: `/api/chat` is a thin wrapper that:
   - Authenticates the request
   - Validates input with Zod
   - Delegates to lib/chat functions
   - Returns streaming response

5. **Testable by Design**:
   - `MockProvider` enables unit testing without API calls
   - All business logic is in lib/chat (not in route)
   - Pure functions can be tested in isolation

### Chat Flow

```
Frontend (ChatContainer)
    ↓ useChartsmithChat hook
    ↓ fetch /api/chat
API Route (app/api/chat/route.ts)
    ↓ authenticate
    ↓ validate
    ↓ build context (context-builder.ts)
    ↓ build messages (message-builder.ts)
    ↓ stream response (provider)
    ↓ toTextStreamResponse()
Frontend (streaming response)
```

### Environment Variables

```bash
# Provider selection
CHAT_PROVIDER=anthropic         # or 'openai'

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Feature flag
NEXT_PUBLIC_USE_VERCEL_AI_SDK=true
```

### Testing

- **Unit Tests**: `lib/chat/__tests__/` - Jest tests for all modules
- **Integration Tests**: `app/api/chat/__tests__/` - Route handler tests
- **E2E Tests**: `tests/chat-flow.spec.ts` - Playwright tests for full chat flow

Run tests:
```bash
npm run test:unit           # Jest unit tests
npm run test:e2e            # Playwright E2E tests
```
