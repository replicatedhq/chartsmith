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

## AI Integration (Vercel AI SDK)

### Overview
Chartsmith uses Vercel AI SDK for LLM integration, providing:
- Unified API across multiple providers (currently Anthropic)
- Built-in streaming with React hooks
- Type-safe tool definitions with Zod schemas
- Clean separation between chat-only interactions and plan execution

The system supports two interaction modes:
1. **Chat-only mode**: Uses Vercel AI SDK for simple Q&A without file modifications
2. **Plan execution mode**: Uses Go backend + realtime events for complex operations requiring file edits and tool execution

### Architecture Components

#### Backend: Chat API Route
**File**: `app/api/chat/route.ts`

The chat endpoint uses AI SDK's `streamText` function to handle streaming responses:
- Model: `claude-sonnet-4-20250514` (Anthropic)
- Accepts messages array and optional context (chart structure, file contents)
- Returns streaming text responses via `toTextStreamResponse()`
- Supports GET health checks for monitoring

Configuration:
```typescript
streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: systemPrompt,  // ChartSmith-specific instructions
  messages: allMessages,
  temperature: 0.7,
  maxOutputTokens: 4096,
})
```

#### Tool Definitions
**File**: `lib/tools.ts`

Defines available tools using Zod schemas for type safety:

1. **textEditor** - View, create, or modify Helm chart files
   - Commands: `view`, `str_replace`, `create`
   - Parameters: `path`, `old_str`, `new_str`

2. **latestKubernetesVersion** - Get current Kubernetes version
   - Parameters: `semver_field` (major/minor/patch)
   - Returns version string (e.g., "1.32.1")

3. **latestSubchartVersion** - Lookup subchart versions from ArtifactHub
   - Parameters: `chart_name`

Tool execution is handled by the Go backend via the existing realtime infrastructure. The Zod schemas provide type safety and are compatible with both Vercel AI SDK and Anthropic formats.

#### Frontend: Custom React Hook
**File**: `hooks/useAIChat.ts`

The `useAIChat` hook provides a clean interface for streaming chat:

```typescript
const {
  messages,        // ChatMessage[]
  sendMessage,     // (content: string) => Promise<void>
  isLoading,       // boolean
  status,          // 'submitted' | 'streaming' | 'ready' | 'error'
  error,           // Error | undefined
  stop,            // () => void - abort current request
  setMessages,     // Manual message control
  clearMessages,   // Reset conversation
  input,           // Controlled input value
  setInput,        // Set input value
  handleInputChange, // Input change handler
  handleSubmit,    // Form submit handler
} = useAIChat({
  workspaceId: 'workspace-123',
  context: 'Chart structure: ...',
  onFinish: (message) => {},
  onError: (error) => {},
});
```

Features:
- Automatic streaming with chunk accumulation
- AbortController support for cancellation
- Message state management
- Error handling and recovery
- Form helpers for controlled inputs

#### Frontend: Chat Component
**File**: `components/ChatContainer.tsx`

Main chat UI component that integrates the `useAIChat` hook:

Key responsibilities:
- Renders chat messages with streaming support
- Builds context from workspace files (chart structure, file contents)
- Handles role selection (auto/developer/operator)
- Provides send/stop controls
- Integrates with Jotai atoms for workspace state
- Supports both AI SDK messages and legacy database messages

Message rendering:
- User messages: Right-aligned with primary color background
- Assistant messages: Left-aligned, parsed with `AIMessageParts` for markdown/code
- Streaming messages: Update in real-time as chunks arrive
- Error messages: Displayed with error styling

### Streaming Architecture

The streaming flow works as follows:

1. **User submits message**:
   - User types in `ChatContainer` textarea
   - Form submit triggers `handleSubmit` from `useAIChat`
   - User message added to messages array
   - Empty assistant message created as placeholder

2. **Request to API**:
   - `POST /api/chat` with messages + context
   - AbortController created for cancellation support
   - State set to 'streaming'

3. **Server-side streaming**:
   - AI SDK's `streamText` calls Anthropic API
   - Response streamed back via `toTextStreamResponse()`
   - Returns ReadableStream with text chunks

4. **Client-side streaming**:
   - `useAIChat` reads stream with ReadableStream API
   - Decoder processes chunks as they arrive
   - Each chunk appended to accumulated content
   - Assistant message updated with latest content
   - React re-renders to show streaming text

5. **Completion**:
   - Stream completes, final message set
   - `onFinish` callback fired
   - Status set to 'ready'

### Provider Configuration

Current provider: **Anthropic** via `@ai-sdk/anthropic`

Environment variables required:
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

The provider is configured in `app/api/chat/route.ts`:
```typescript
import { anthropic } from '@ai-sdk/anthropic';
const model = anthropic('claude-sonnet-4-20250514');
```

To switch providers, update the import and model initialization:
```typescript
// Example: OpenAI
import { openai } from '@ai-sdk/openai';
const model = openai('gpt-4-turbo');
```

### Integration with Existing System

The AI SDK integration coexists with the existing Go backend:

- **Chat-only questions**: Use AI SDK for fast, streaming responses
- **File modifications**: Continue using Go backend with plan execution and realtime events
- **Tool calls**: Defined in `lib/tools.ts` but executed by Go backend
- **State management**: Jotai atoms (`workspaceAtom`, `messagesAtom`) shared between both systems
- **Message history**: AI SDK messages displayed alongside database messages in `ChatContainer`

### Key Files Reference

- `app/api/chat/route.ts` - Streaming chat API endpoint
- `lib/tools.ts` - Tool definitions with Zod schemas (AI SDK and Anthropic formats)
- `hooks/useAIChat.ts` - Custom React hook for AI chat with streaming
- `components/ChatContainer.tsx` - Main chat UI component
- `components/AIMessageParts.tsx` - Markdown/code rendering for assistant messages
- `components/NewChartContent.tsx` - New chart creation flow using AI SDK
- `atoms/workspace.ts` - Jotai atoms for workspace state
