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

## Chat & LLM Integration

Chartsmith uses the Vercel AI SDK for all chat functionality:

- **Frontend**: `useChat` hook from `@ai-sdk/react` manages chat state
- **API Route**: `/api/chat` Next.js route proxies to Go worker
- **Backend**: Go worker outputs AI SDK Data Stream Protocol (HTTP SSE)
- **Streaming**: Server-Sent Events (SSE) instead of WebSocket
- **State**: Managed by AI SDK hook, integrated with Jotai for workspace state

### Flow
```
User Input → ChatContainer → useAIChat → /api/chat → Go Worker → AI SDK Protocol → useChat → UI
```

### Key Components
- `useAIChat`: Wraps `useChat` with Chartsmith-specific logic
- `/api/chat`: Next.js API route that proxies to Go worker
- `pkg/llm/aisdk.go`: Go adapter for AI SDK protocol
- `pkg/api/chat.go`: HTTP endpoint for chat streaming

### Note on Centrifugo
Centrifugo is still used for non-chat events (plans, renders, artifacts).
Chat messages flow exclusively through the AI SDK HTTP SSE protocol.
