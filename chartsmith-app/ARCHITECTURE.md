# Architecture and Design for Chartsmith-app

This is a next.js project that is the front end for chartsmith.

## AI Integration

This application uses Vercel AI SDK for LLM interactions:

- **Provider**: `@ai-sdk/anthropic` - Anthropic Claude models
- **UI Hook**: `useChat` from `@ai-sdk/react` - Manages chat state and streaming
- **Core**: `streamText` from `ai` - Handles streaming in API routes

### Chat Flow
1. User sends message via `ChatContainer` component
2. `useAIChat` hook (wrapping `useChat`) sends request to `/api/chat` endpoint
3. API route uses `streamText` with context from workspace (chart structure, files, plan history)
4. Response streams directly to client via HTTP
5. Completed messages are persisted to database

### Intent Classification
- Uses AI SDK `generateText` to classify user messages as "plan" or "chat"
- Plan intents are routed to Go backend for execution
- Chat intents are handled directly via AI SDK streaming

### Key Files
- `lib/ai/provider.ts` - Anthropic provider and model configuration
- `lib/ai/context.ts` - Builds workspace context for LLM calls
- `app/api/chat/route.ts` - Streaming chat endpoint with tool support
- `hooks/useAIChat.ts` - Chat hook wrapper with workspace-specific logic
- `lib/llm/prompt-type.ts` - Intent classification

### Non-Chat Real-time Events
Centrifugo WebSocket is still used for:
- Render progress updates
- Artifact/file changes
- Plan status updates
- Revision creation notifications

## Monaco Editor Implementation
- Avoid recreating editor instances
- Use a single editor instance with model swapping for better performance
- Properly clean up models to prevent memory leaks
- We want to make sure that we don't show a "Loading..." state because it causes a lot of UI flashes.

## State management
- Do not pass onChange and other callbacks through to child components
- We use jotai for state, each component should be able to get or set the state it needs
- Each component subscribes to the relevant atoms. This is preferred over callbacks.

## SSR
- We use server side rendering to avoid the "loading" state whenever possible.
- Move code that requires "use client" into separate controls.

## Database and functions
- We use Next.js API routes only for AI chat streaming (`/api/chat`), which requires HTTP streaming that server actions cannot provide.
- For all other operations, front end should call server actions, which call lib/* functions.
- Database queries are not allowed in the server action. Server actions are just wrappers for which lib functions we expose.
