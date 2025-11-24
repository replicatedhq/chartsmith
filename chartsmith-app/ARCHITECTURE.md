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

## AI Chat System

### Overview

The chat system uses a custom streaming implementation built on top of the Vercel AI SDK server-side components, but with a custom client-side hook instead of `useChat` from `@ai-sdk/react`.

### Why Custom Hook Instead of AI SDK's useChat

We chose to implement a custom `useStreamingChat` hook for several reasons:

1. **Stop Button Support**: The AI SDK's `useChat` hook had limited support for canceling in-progress requests. Our custom implementation uses `AbortController` for reliable request cancellation.

2. **Streaming Format Control**: Direct control over SSE parsing allows us to handle the AI SDK's specific streaming format (`0:` prefixed text chunks).

3. **Workspace Context Integration**: Seamless integration with Jotai atoms for workspace state, allowing automatic chart context injection.

4. **Reduced Dependencies**: Removing `@ai-sdk/react` reduces bundle size and potential version conflicts.

5. **Error Handling**: Custom error handling with graceful degradation for abort errors vs. network errors.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        ChatContainer                             │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │ useStreamingChat│───▶│ /api/chat (AI SDK streamText)       │ │
│  │ (custom hook)   │◀───│ + Anthropic Claude 3 Haiku          │ │
│  └────────┬────────┘    └─────────────────────────────────────┘ │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ messagesAtom    │ ◀── Syncs streaming messages to Jotai     │
│  │ (Jotai)         │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ ChatMessage     │ ◀── Renders individual messages            │
│  │ (component)     │                                            │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Streaming Protocol

The backend uses AI SDK's `streamText` which outputs Server-Sent Events in a specific format:

```
0:"Hello"        # Text chunk
0:" world"       # Another text chunk
0:"!"            # Final text chunk
```

The custom hook parses these chunks and accumulates them into the assistant message content.

### Chart Context Injection

When a user sends a message, the following context is automatically included:

1. **Workspace ID and Name**: For tool operations
2. **Current Revision Number**: For versioning
3. **Chart Files**: All files in each chart (truncated if > 5000 chars)
4. **Loose Files**: Files not in any chart

This context is injected into the system prompt, allowing the AI to reference and modify specific files.

### Key Files

| File | Purpose |
|------|---------|
| `hooks/useStreamingChat.ts` | Custom React hook for streaming chat |
| `app/api/chat/route.ts` | API endpoint with AI SDK + Anthropic |
| `components/ChatContainer.tsx` | Main chat UI with workspace integration |
| `components/ChatMessage.tsx` | Individual message rendering with markdown |
| `atoms/workspace.ts` | Jotai atoms for workspace state |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | API key for Claude AI |

### Adding New Features

To add new AI capabilities:

1. **New Tools**: Add to `lib/tools/index.ts` using AI SDK's `tool` function
2. **System Prompt Changes**: Modify `CHARTSMITH_SYSTEM_PROMPT` in `app/api/chat/route.ts`
3. **Context Data**: Add to `body` in `ChatContainer.tsx` and handle in `route.ts`
