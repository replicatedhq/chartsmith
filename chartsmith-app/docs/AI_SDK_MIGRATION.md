# Vercel AI SDK Migration Guide

This document describes the migration from direct `@anthropic-ai/sdk` usage to the Vercel AI SDK for Chartsmith's chat functionality.

## Overview

Chartsmith now uses the [Vercel AI SDK](https://ai-sdk.dev/docs) for:
- **AI SDK Core**: Server-side LLM calls with streaming
- **AI SDK UI**: Client-side `useChat` hook for chat interfaces
- **Provider abstraction**: Easy switching between Anthropic, OpenAI, and other providers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├──────────────────────────┬──────────────────────────────────┤
│   AIChatContainer        │       Existing Components        │
│   (AI SDK useChat)       │   (Centrifugo for plans/renders) │
└──────────────────────────┴──────────────────────────────────┘
              │                           │
              ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│     /api/chat            │   │     Go Worker                │
│   (AI SDK streamText)    │   │   (Anthropic SDK directly)   │
└──────────────────────────┘   └──────────────────────────────┘
              │                           │
              ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│   Anthropic Claude API   │   │   Anthropic/Groq APIs        │
└──────────────────────────┘   └──────────────────────────────┘
```

### What Uses AI SDK (New)
- Conversational chat messages
- Simple Q&A interactions
- Tool calls for chart lookups

### What Still Uses Centrifugo (Existing)
- Plan creation and execution
- Helm renders
- K8s to Helm conversions
- Complex multi-step workflows

## New Files

| File | Description |
|------|-------------|
| `app/api/chat/route.ts` | API route using `streamText` for streaming responses |
| `lib/llm/provider.ts` | Provider configuration for easy LLM switching |
| `lib/llm/system-prompts.ts` | TypeScript port of Go system prompts |
| `lib/llm/index.ts` | Module exports |
| `hooks/useChartsmithChat.ts` | Custom hook wrapping `useChat` |
| `components/AIChatContainer.tsx` | New chat UI using AI SDK |

## Enabling AI SDK Chat

The AI SDK chat is behind a feature flag. Add to `.env.local`:

```bash
# Enable AI SDK chat (required)
USE_AI_SDK_CHAT=true
```

When enabled, workspace pages use `AIChatContainer` instead of the Centrifugo-based `ChatContainer`.

## Provider Switching

The AI SDK makes it trivial to switch between LLM providers. Set environment variables:

```bash
# Use Anthropic (default)
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...

# Use OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=sk-...

# Use a specific model
LLM_MODEL=claude-3-opus-20240229
```

### Code Example

```typescript
import { getModel, getModelForProvider } from '@/lib/llm';

// Use default provider from environment
const model = getModel();

// Or explicitly choose a provider
const anthropicModel = getModelForProvider('anthropic', 'claude-3-5-sonnet-20241022');
const openaiModel = getModelForProvider('openai', 'gpt-4o');
```

## Using the New Components

### AIChatContainer

For simple chat interfaces with streaming:

```tsx
import { AIChatContainer } from '@/components/AIChatContainer';

function MyPage({ session }) {
  return (
    <AIChatContainer
      session={session}
      onMessageComplete={(userMsg, assistantMsg) => {
        // Persist to database
        saveChatMessage(userMsg, assistantMsg);
      }}
    />
  );
}
```

### useChartsmithChat Hook

For custom chat UI:

```tsx
import { useChartsmithChat } from '@/hooks/useChartsmithChat';

function CustomChat() {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
  } = useChartsmithChat({ role: 'developer' });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button type="submit" disabled={isLoading}>Send</button>
    </form>
  );
}
```

## System Prompts

System prompts are now defined in TypeScript (`lib/llm/system-prompts.ts`) and match the Go prompts in `pkg/llm/system.go`:

- `commonSystemPrompt`: Base prompt for developer interactions
- `chatOnlySystemPrompt`: For Q&A conversations
- `endUserSystemPrompt`: For operator/end-user perspective
- `buildSystemPrompt(role, context)`: Builds complete prompt with chart context

## Tools

The `/api/chat` route includes tools that the LLM can use:

| Tool | Description |
|------|-------------|
| `getLatestSubchartVersion` | Looks up chart versions on ArtifactHub |
| `getLatestKubernetesVersion` | Returns current Kubernetes version info |

## Migration Notes

1. **Backward Compatibility**: The original `@anthropic-ai/sdk` is still in `package.json` for the `prompt-type.ts` migration, but can be removed once fully migrated.

2. **Centrifugo Integration**: The existing Centrifugo-based chat (plans, renders) continues to work unchanged. The AI SDK streaming is additive.

3. **Message Format**: AI SDK uses a different message format than the existing Jotai atoms. The `message-adapter.ts` utility handles conversion between formats.

4. **Authentication**: The `/api/chat` route uses cookie-based session authentication.

5. **Auto-Response**: When a workspace is created with an initial prompt (via the home page), the `AIChatContainer` automatically detects the unanswered user message and triggers an AI response. This bridges the gap between the old workspace creation flow and the new AI SDK chat.

## Testing

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Build to check for TypeScript errors
npm run build
```

## Troubleshooting

### "Unauthorized" errors
Ensure you're logged in and have a valid session cookie.

### Provider not working
Check environment variables:
```bash
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
echo $LLM_PROVIDER
```

### Streaming not working
The `/api/chat` route returns a `DataStreamResponse`. Ensure the client is using `useChat` from `@ai-sdk/react`.

