# PR-07: useAIChat Hook Implementation

**Branch:** `feat/use-ai-chat-hook`
**Dependencies:** PR-01 (AI SDK packages), PR-03 (Feature flags), PR-06 (API route)
**Parallel With:** PR-08 (can start together after deps merge)
**Estimated Complexity:** Medium
**Success Criteria:** G1 (Replace chat UI), N3 (Simplify state management)

---

## Overview

Create a custom `useAIChat` hook that wraps the AI SDK's `useChat` hook. This abstraction allows us to add workspace-specific logic and provide a consistent interface for chat components.

## Prerequisites

- PR-01 merged (AI SDK packages)
- PR-03 merged (Feature flags)
- PR-06 merged (API route)

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hook name | `useAIChat` | Clear distinction from useChat |
| Abstraction level | Thin wrapper | Minimal overhead, easy maintenance |
| State persistence | On message complete | Reduce DB writes |

---

## Step-by-Step Instructions

### Step 1: Create the Hook File

```typescript
// chartsmith-app/hooks/useAIChat.ts

'use client';

import { useChat, Message } from '@ai-sdk/react';
import { useCallback, useEffect, useRef } from 'react';
import { Session } from '@/lib/types/session';
import { featureFlags } from '@/lib/config/feature-flags';

/**
 * Options for the useAIChat hook
 */
export interface UseAIChatOptions {
  /** Current user session */
  session: Session;
  /** Workspace ID for the chat */
  workspaceId: string;
  /** Initial messages to load */
  initialMessages?: Message[];
  /** Callback when a message is completed */
  onMessageComplete?: (message: Message) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useAIChat hook
 */
export interface UseAIChatReturn {
  /** Current messages in the conversation */
  messages: Message[];
  /** Current input value */
  input: string;
  /** Handle input change */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Handle form submission */
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Whether a request is in progress */
  isLoading: boolean;
  /** Current error, if any */
  error: Error | undefined;
  /** Stop the current stream */
  stop: () => void;
  /** Reload the last message */
  reload: () => void;
  /** Set messages directly (for loading history) */
  setMessages: (messages: Message[]) => void;
  /** Append a message */
  append: (message: Message) => void;
  /** Whether AI SDK chat is enabled */
  isAISDKEnabled: boolean;
}

/**
 * Custom hook for AI SDK chat integration with Chartsmith.
 *
 * Wraps the useChat hook from @ai-sdk/react with workspace-specific
 * configuration and callbacks.
 *
 * @example
 * ```tsx
 * const { messages, input, handleSubmit, isLoading } = useAIChat({
 *   session,
 *   workspaceId: 'abc123',
 * });
 * ```
 */
export function useAIChat({
  session,
  workspaceId,
  initialMessages = [],
  onMessageComplete,
  onError,
}: UseAIChatOptions): UseAIChatReturn {
  // Track whether we're using AI SDK or legacy
  const isAISDKEnabled = featureFlags.enableAISDKChat;

  // Ref to track the last completed message
  const lastCompletedMessageRef = useRef<string | null>(null);

  // Initialize the AI SDK useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    error,
    stop,
    reload,
    setMessages,
    append,
  } = useChat({
    // API endpoint
    api: '/api/chat',

    // Include workspace ID in every request
    body: {
      workspaceId,
    },

    // Load initial messages
    initialMessages,

    // Handle completion
    onFinish: (message) => {
      // Avoid duplicate calls for the same message
      if (lastCompletedMessageRef.current === message.id) {
        return;
      }
      lastCompletedMessageRef.current = message.id;

      // Call the completion callback
      if (onMessageComplete) {
        onMessageComplete(message);
      }
    },

    // Handle errors
    onError: (err) => {
      console.error('AI Chat error:', err);
      if (onError) {
        onError(err);
      }
    },
  });

  // Custom submit handler that validates before submission
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Don't submit if input is empty
      if (!input.trim()) {
        return;
      }

      // Don't submit if already loading
      if (isLoading) {
        return;
      }

      // Don't submit if feature flag is disabled
      if (!isAISDKEnabled) {
        console.warn('AI SDK chat is disabled');
        return;
      }

      // Call the original submit
      originalHandleSubmit(e);
    },
    [input, isLoading, isAISDKEnabled, originalHandleSubmit]
  );

  // Reset last completed message when workspace changes
  useEffect(() => {
    lastCompletedMessageRef.current = null;
  }, [workspaceId]);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
    setMessages,
    append,
    isAISDKEnabled,
  };
}

/**
 * Convert our internal message format to AI SDK format
 */
export function toAISDKMessage(msg: {
  id: string;
  prompt?: string;
  response?: string;
  createdAt?: Date;
}): Message | null {
  if (msg.prompt) {
    return {
      id: `${msg.id}-user`,
      role: 'user',
      content: msg.prompt,
      createdAt: msg.createdAt,
    };
  }

  if (msg.response) {
    return {
      id: `${msg.id}-assistant`,
      role: 'assistant',
      content: msg.response,
      createdAt: msg.createdAt,
    };
  }

  return null;
}

/**
 * Convert AI SDK message to our internal format for persistence
 */
export function fromAISDKMessage(
  msg: Message,
  workspaceId: string
): {
  prompt: string | null;
  response: string | null;
  workspaceId: string;
} {
  return {
    prompt: msg.role === 'user' ? msg.content : null,
    response: msg.role === 'assistant' ? msg.content : null,
    workspaceId,
  };
}
```

### Step 2: Create Hook Tests

```typescript
// chartsmith-app/hooks/__tests__/useAIChat.test.ts

import { renderHook, act } from '@testing-library/react';
import { useAIChat, toAISDKMessage, fromAISDKMessage } from '../useAIChat';

// Mock the AI SDK useChat hook
jest.mock('@ai-sdk/react', () => ({
  useChat: jest.fn(() => ({
    messages: [],
    input: '',
    handleInputChange: jest.fn(),
    handleSubmit: jest.fn(),
    isLoading: false,
    error: undefined,
    stop: jest.fn(),
    reload: jest.fn(),
    setMessages: jest.fn(),
    append: jest.fn(),
  })),
}));

// Mock feature flags
jest.mock('@/lib/config/feature-flags', () => ({
  featureFlags: {
    enableAISDKChat: true,
  },
}));

import { useChat } from '@ai-sdk/react';

describe('useAIChat', () => {
  const mockSession = {
    user: { id: 'user123', name: 'Test User' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct API endpoint', () => {
    renderHook(() =>
      useAIChat({
        session: mockSession as any,
        workspaceId: 'workspace123',
      })
    );

    expect(useChat).toHaveBeenCalledWith(
      expect.objectContaining({
        api: '/api/chat',
        body: { workspaceId: 'workspace123' },
      })
    );
  });

  it('passes initial messages to useChat', () => {
    const initialMessages = [
      { id: '1', role: 'user' as const, content: 'Hello' },
    ];

    renderHook(() =>
      useAIChat({
        session: mockSession as any,
        workspaceId: 'workspace123',
        initialMessages,
      })
    );

    expect(useChat).toHaveBeenCalledWith(
      expect.objectContaining({
        initialMessages,
      })
    );
  });

  it('returns isAISDKEnabled flag', () => {
    const { result } = renderHook(() =>
      useAIChat({
        session: mockSession as any,
        workspaceId: 'workspace123',
      })
    );

    expect(result.current.isAISDKEnabled).toBe(true);
  });
});

describe('toAISDKMessage', () => {
  it('converts user message', () => {
    const internal = {
      id: 'msg1',
      prompt: 'Hello',
      createdAt: new Date('2024-01-01'),
    };

    const result = toAISDKMessage(internal);

    expect(result).toEqual({
      id: 'msg1-user',
      role: 'user',
      content: 'Hello',
      createdAt: internal.createdAt,
    });
  });

  it('converts assistant message', () => {
    const internal = {
      id: 'msg1',
      response: 'Hi there',
      createdAt: new Date('2024-01-01'),
    };

    const result = toAISDKMessage(internal);

    expect(result).toEqual({
      id: 'msg1-assistant',
      role: 'assistant',
      content: 'Hi there',
      createdAt: internal.createdAt,
    });
  });

  it('returns null for empty message', () => {
    const internal = { id: 'msg1' };
    const result = toAISDKMessage(internal);
    expect(result).toBeNull();
  });
});

describe('fromAISDKMessage', () => {
  it('converts user message', () => {
    const aiMsg = {
      id: 'msg1',
      role: 'user' as const,
      content: 'Hello',
    };

    const result = fromAISDKMessage(aiMsg, 'ws123');

    expect(result).toEqual({
      prompt: 'Hello',
      response: null,
      workspaceId: 'ws123',
    });
  });

  it('converts assistant message', () => {
    const aiMsg = {
      id: 'msg1',
      role: 'assistant' as const,
      content: 'Hi there',
    };

    const result = fromAISDKMessage(aiMsg, 'ws123');

    expect(result).toEqual({
      prompt: null,
      response: 'Hi there',
      workspaceId: 'ws123',
    });
  });
});
```

### Step 3: Create Type Definitions

```typescript
// chartsmith-app/lib/types/ai-chat.ts

import { Message } from '@ai-sdk/react';

/**
 * Extended message type with tool invocations
 */
export interface ExtendedMessage extends Message {
  toolInvocations?: ToolInvocation[];
}

/**
 * Tool invocation from AI SDK
 */
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

/**
 * Chat message for persistence
 */
export interface ChatMessageForPersistence {
  id?: string;
  workspaceId: string;
  prompt: string | null;
  response: string | null;
  revisionNumber?: number;
}
```

### Step 4: Run Tests

```bash
cd chartsmith-app
npm test -- --testPathPattern=useAIChat
```

### Step 5: Verify Types

```bash
npm run type-check
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `chartsmith-app/hooks/useAIChat.ts` | Added | Main hook implementation |
| `chartsmith-app/hooks/__tests__/useAIChat.test.ts` | Added | Unit tests |
| `chartsmith-app/lib/types/ai-chat.ts` | Added | Type definitions |

---

## Acceptance Criteria

- [ ] `useAIChat` hook created and exported
- [ ] Hook wraps `useChat` from `@ai-sdk/react`
- [ ] Hook includes `workspaceId` in requests
- [ ] Hook handles `onFinish` callback
- [ ] Hook handles `onError` callback
- [ ] Message conversion functions work correctly
- [ ] `isAISDKEnabled` flag is exposed
- [ ] Unit tests pass
- [ ] TypeScript types are correct
- [ ] Build succeeds

---

## Usage Example

```typescript
// In a component:
import { useAIChat, toAISDKMessage } from '@/hooks/useAIChat';

function ChatComponent({ session, workspaceId, existingMessages }) {
  // Convert existing messages to AI SDK format
  const initialMessages = existingMessages
    .map(toAISDKMessage)
    .filter(Boolean);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    isAISDKEnabled,
  } = useAIChat({
    session,
    workspaceId,
    initialMessages,
    onMessageComplete: async (message) => {
      // Persist to database
      await saveMessage(message);
    },
    onError: (error) => {
      // Show error toast
      toast.error(error.message);
    },
  });

  if (!isAISDKEnabled) {
    return <LegacyChat />;
  }

  return (
    <form onSubmit={handleSubmit}>
      <MessageList messages={messages} />
      <input
        value={input}
        onChange={handleInputChange}
        disabled={isLoading}
        placeholder="Ask about your Helm chart..."
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send'}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}
```

---

## Testing Instructions

1. Unit tests:
   ```bash
   npm test -- --testPathPattern=useAIChat
   ```

2. Type checking:
   ```bash
   npm run type-check
   ```

3. Manual testing (after PR-08 merged):
   - Enable feature flag
   - Navigate to a workspace
   - Send a message
   - Verify streaming works

---

## Rollback Plan

This PR adds new files without modifying existing code. To rollback:

```bash
rm chartsmith-app/hooks/useAIChat.ts
rm -rf chartsmith-app/hooks/__tests__
rm chartsmith-app/lib/types/ai-chat.ts
```

---

## PR Checklist

- [ ] Branch created from `main` (after deps merged)
- [ ] Hook file created
- [ ] Tests created and passing
- [ ] Type definitions added
- [ ] TypeScript compiles
- [ ] Build passes
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Hook is a thin wrapper, minimal logic
- Message conversion functions handle both directions
- `isAISDKEnabled` allows components to fall back gracefully
- `onFinish` callback is debounced to prevent duplicate saves
