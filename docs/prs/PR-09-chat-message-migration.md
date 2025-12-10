# PR-09: ChatMessage Component Migration

**Branch:** `feat/chat-message-ai-sdk`
**Dependencies:** PR-03 (Feature flags), PR-07 (useAIChat hook)
**Parallel With:** PR-08, PR-11 (after deps merge)
**Estimated Complexity:** Medium
**Success Criteria:** G1 (Replace chat UI), G3 (Maintain functionality)

---

## Overview

Migrate the `ChatMessage` component to render AI SDK message format. This component displays individual chat messages including user prompts and AI responses with streaming support.

## Prerequisites

- PR-03 merged (Feature flags)
- PR-07 merged (useAIChat hook)
- Understanding of existing `ChatMessage.tsx`

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | New component + conditional | Safe migration |
| Streaming | Use AI SDK's built-in | Better performance |
| Markdown | Keep existing renderer | Preserve formatting |

---

## Step-by-Step Instructions

### Step 1: Study Existing ChatMessage

```bash
cat chartsmith-app/components/ChatMessage.tsx
```

Note:
- Message structure (prompt, response)
- Streaming text handling
- Markdown rendering
- Plan/render embeds
- Timestamps and metadata

### Step 2: Create AI SDK Message Component

```typescript
// chartsmith-app/components/ChatMessageAISDK.tsx

'use client';

import React from 'react';
import { Message } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface ChatMessageAISDKProps {
  /** AI SDK message to render */
  message: Message;
  /** Whether this message is currently streaming */
  isStreaming?: boolean;
  /** Optional className for styling */
  className?: string;
}

/**
 * AI SDK version of ChatMessage
 *
 * Renders a single chat message in AI SDK format.
 * Supports streaming text display.
 */
export function ChatMessageAISDK({
  message,
  isStreaming = false,
  className,
}: ChatMessageAISDKProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'chat-message',
        isUser && 'chat-message-user',
        isAssistant && 'chat-message-assistant',
        className
      )}
    >
      {/* Message header */}
      <div className="chat-message-header flex items-center gap-2 mb-2">
        <span className="font-medium">
          {isUser ? 'You' : 'ChartSmith'}
        </span>
        {message.createdAt && (
          <span className="text-xs text-gray-500">
            {formatTime(message.createdAt)}
          </span>
        )}
        {isStreaming && (
          <span className="text-xs text-blue-500 animate-pulse">
            Streaming...
          </span>
        )}
      </div>

      {/* Message content */}
      <div className="chat-message-content">
        {isUser ? (
          // User messages: plain text
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          // Assistant messages: markdown
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Tool invocations (if any) */}
      {message.toolInvocations && message.toolInvocations.length > 0 && (
        <div className="chat-message-tools mt-2">
          {message.toolInvocations.map((tool) => (
            <ToolInvocationDisplay
              key={tool.toolCallId}
              toolInvocation={tool}
            />
          ))}
        </div>
      )}

      {/* Streaming cursor */}
      {isStreaming && isAssistant && (
        <span className="streaming-cursor inline-block w-2 h-4 bg-current animate-blink" />
      )}
    </div>
  );
}

/**
 * Display a tool invocation
 */
function ToolInvocationDisplay({
  toolInvocation,
}: {
  toolInvocation: NonNullable<Message['toolInvocations']>[number];
}) {
  return (
    <div className="tool-invocation bg-gray-100 dark:bg-gray-800 rounded p-2 mt-1 text-sm">
      <div className="font-medium text-gray-700 dark:text-gray-300">
        🔧 {formatToolName(toolInvocation.toolName)}
      </div>
      {toolInvocation.result && (
        <div className="text-gray-600 dark:text-gray-400 mt-1">
          Result: {JSON.stringify(toolInvocation.result)}
        </div>
      )}
    </div>
  );
}

/**
 * Format tool name for display
 */
function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format timestamp for display
 */
function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
```

### Step 3: Create Message List Component

```typescript
// chartsmith-app/components/ChatMessageListAISDK.tsx

'use client';

import React, { useRef, useEffect } from 'react';
import { Message } from '@ai-sdk/react';
import { ChatMessageAISDK } from './ChatMessageAISDK';

interface ChatMessageListAISDKProps {
  /** Messages to display */
  messages: Message[];
  /** Whether currently streaming the last message */
  isStreaming?: boolean;
}

/**
 * AI SDK version of message list
 *
 * Renders a list of chat messages with auto-scroll.
 */
export function ChatMessageListAISDK({
  messages,
  isStreaming = false,
}: ChatMessageListAISDKProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or content streams
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messages[messages.length - 1]?.content]);

  if (messages.length === 0) {
    return (
      <div className="chat-messages-empty text-center text-gray-500 py-8">
        No messages yet. Start a conversation!
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chat-messages-list space-y-4 p-4">
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;
        const isStreamingThis = isStreaming && isLastMessage && message.role === 'assistant';

        return (
          <div
            key={message.id}
            ref={isLastMessage ? lastMessageRef : undefined}
          >
            <ChatMessageAISDK
              message={message}
              isStreaming={isStreamingThis}
            />
          </div>
        );
      })}
    </div>
  );
}
```

### Step 4: Add Styling

Add CSS for the streaming cursor animation:

```css
/* chartsmith-app/styles/chat.css (or wherever your global styles are) */

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.animate-blink {
  animation: blink 1s infinite;
}

.chat-message-user {
  @apply bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4;
}

.chat-message-assistant {
  @apply bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4;
}
```

### Step 5: Update Parent Component to Use New Message List

In the component that renders messages (likely `ChatContainer` or a chat page):

```typescript
// Example integration in a chat view component

import { featureFlags } from '@/lib/config/feature-flags';
import { ChatMessageListAISDK } from './ChatMessageListAISDK';
import { ChatMessageList } from './ChatMessageList'; // Original

function ChatView({ messages, isLoading }) {
  if (featureFlags.enableAISDKChat) {
    return (
      <ChatMessageListAISDK
        messages={messages}
        isStreaming={isLoading}
      />
    );
  }

  return <ChatMessageList messages={messages} />;
}
```

### Step 6: Add Tests

```typescript
// chartsmith-app/components/__tests__/ChatMessageAISDK.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChatMessageAISDK } from '../ChatMessageAISDK';

// Mock ReactMarkdown
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

describe('ChatMessageAISDK', () => {
  it('renders user message', () => {
    const message = {
      id: 'msg1',
      role: 'user' as const,
      content: 'Hello, how are you?',
    };

    render(<ChatMessageAISDK message={message} />);

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
  });

  it('renders assistant message', () => {
    const message = {
      id: 'msg2',
      role: 'assistant' as const,
      content: 'I am doing well, thank you!',
    };

    render(<ChatMessageAISDK message={message} />);

    expect(screen.getByText('ChartSmith')).toBeInTheDocument();
    expect(screen.getByText('I am doing well, thank you!')).toBeInTheDocument();
  });

  it('shows streaming indicator when streaming', () => {
    const message = {
      id: 'msg2',
      role: 'assistant' as const,
      content: 'Thinking...',
    };

    render(<ChatMessageAISDK message={message} isStreaming />);

    expect(screen.getByText('Streaming...')).toBeInTheDocument();
  });

  it('formats timestamp when provided', () => {
    const message = {
      id: 'msg1',
      role: 'user' as const,
      content: 'Test',
      createdAt: new Date('2024-01-01T14:30:00'),
    };

    render(<ChatMessageAISDK message={message} />);

    // Time format depends on locale, just check it renders
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('renders tool invocations', () => {
    const message = {
      id: 'msg2',
      role: 'assistant' as const,
      content: 'Let me check that for you.',
      toolInvocations: [
        {
          toolCallId: 'tool1',
          toolName: 'latest_subchart_version',
          args: { chart_name: 'nginx' },
          result: '1.24.0',
        },
      ],
    };

    render(<ChatMessageAISDK message={message} />);

    expect(screen.getByText(/Latest Subchart Version/i)).toBeInTheDocument();
    expect(screen.getByText(/1.24.0/)).toBeInTheDocument();
  });
});

describe('ChatMessageListAISDK', () => {
  // Import here to avoid hoisting issues
  const { ChatMessageListAISDK } = require('../ChatMessageListAISDK');

  it('renders empty state', () => {
    render(<ChatMessageListAISDK messages={[]} />);

    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });

  it('renders multiple messages', () => {
    const messages = [
      { id: 'msg1', role: 'user' as const, content: 'Hello' },
      { id: 'msg2', role: 'assistant' as const, content: 'Hi there!' },
    ];

    render(<ChatMessageListAISDK messages={messages} />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });
});
```

### Step 7: Run Tests

```bash
npm test -- --testPathPattern=ChatMessage
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `chartsmith-app/components/ChatMessageAISDK.tsx` | Added | New message component |
| `chartsmith-app/components/ChatMessageListAISDK.tsx` | Added | New message list |
| `chartsmith-app/components/__tests__/ChatMessageAISDK.test.tsx` | Added | Unit tests |
| `chartsmith-app/styles/chat.css` | Modified | Add animation styles |

---

## Acceptance Criteria

- [ ] ChatMessageAISDK renders user messages
- [ ] ChatMessageAISDK renders assistant messages
- [ ] Markdown rendering works
- [ ] Streaming indicator shows
- [ ] Tool invocations display
- [ ] Timestamps display correctly
- [ ] Auto-scroll works on new messages
- [ ] Empty state displays
- [ ] Unit tests pass
- [ ] Build succeeds

---

## UI Preservation Checklist (G3)

Verify visual parity with original:

- [ ] User message styling matches
- [ ] Assistant message styling matches
- [ ] Markdown formatting correct
- [ ] Code blocks render correctly
- [ ] Links are clickable
- [ ] Lists render correctly
- [ ] Streaming cursor visible

---

## Testing Instructions

1. Unit tests:
   ```bash
   npm test -- --testPathPattern=ChatMessage
   ```

2. Manual testing:
   - Enable feature flag
   - Send a message
   - Verify streaming display
   - Verify markdown rendering
   - Verify tool invocations (if any)

---

## Rollback Plan

1. Feature flag controls rendering
2. Original components unchanged
3. Set `NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false` to revert

---

## PR Checklist

- [ ] Branch created from `main`
- [ ] ChatMessageAISDK created
- [ ] ChatMessageListAISDK created
- [ ] Styles added
- [ ] Tests created and passing
- [ ] Build passes
- [ ] Visual testing complete
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Component is self-contained
- Markdown uses existing ReactMarkdown
- Tool display is simplified (can enhance later)
- Streaming cursor is CSS-only (no JS timer)
