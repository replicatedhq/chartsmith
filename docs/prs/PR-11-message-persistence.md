# PR-11: Message Persistence Adapter

**Branch:** `feat/ai-sdk-message-persistence`
**Dependencies:** PR-07 (useAIChat hook), PR-08 (ChatContainer)
**Parallel With:** Can work with PR-09, PR-10 after PR-07/08 merge
**Estimated Complexity:** Medium
**Success Criteria:** G3 (Maintain functionality), G4 (Keep behavior)

---

## Overview

Create an adapter layer that persists AI SDK messages to the existing database schema. This ensures chat history is saved and can be restored when users return to a workspace.

## Prerequisites

- PR-07 merged (useAIChat hook)
- PR-08 merged (ChatContainer)
- Understanding of existing message persistence in `pkg/api/handlers/`
- Understanding of workspace atoms in `chartsmith-app/atoms/`

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Persistence timing | On message complete | Reduce DB writes |
| Message format | Convert AI SDK → existing schema | No DB migration |
| History loading | Convert existing → AI SDK format | Seamless UX |

---

## Background: Existing Message Schema

Current messages are stored with:
- `id`: UUID
- `workspace_id`: UUID
- `prompt`: User message (nullable)
- `response`: Assistant message (nullable)
- `revision_number`: Workspace revision
- `created_at`: Timestamp

AI SDK messages use:
- `id`: string
- `role`: 'user' | 'assistant' | 'system' | 'tool'
- `content`: string
- `createdAt`: Date
- `toolInvocations`: optional array

---

## Step-by-Step Instructions

### Step 1: Create Message Persistence Service

```typescript
// chartsmith-app/lib/services/chat-persistence.ts

import { Message } from '@ai-sdk/react';
import { fromAISDKMessage, toAISDKMessage } from '@/hooks/useAIChat';

/**
 * Service for persisting AI SDK chat messages
 */
export class ChatPersistenceService {
  private workspaceId: string;
  private apiBase: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.apiBase = '/api/workspace';
  }

  /**
   * Save a completed message pair to the database
   *
   * AI SDK sends user and assistant messages separately.
   * We need to pair them for our schema.
   */
  async saveMessagePair(
    userMessage: Message,
    assistantMessage: Message
  ): Promise<{ id: string }> {
    const response = await fetch(
      `${this.apiBase}/${this.workspaceId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          response: assistantMessage.content,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save message: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Save a single message (for streaming in-progress saves)
   */
  async savePartialMessage(message: Message): Promise<{ id: string }> {
    const data = fromAISDKMessage(message, this.workspaceId);

    const response = await fetch(
      `${this.apiBase}/${this.workspaceId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save message: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Load chat history and convert to AI SDK format
   */
  async loadHistory(): Promise<Message[]> {
    const response = await fetch(
      `${this.apiBase}/${this.workspaceId}/messages`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return []; // No history yet
      }
      throw new Error(`Failed to load history: ${response.status}`);
    }

    const data = await response.json();
    const messages: Message[] = [];

    // Convert each stored message to AI SDK format
    // Each stored message may have prompt and/or response
    for (const msg of data.messages || []) {
      if (msg.prompt) {
        messages.push({
          id: `${msg.id}-user`,
          role: 'user',
          content: msg.prompt,
          createdAt: new Date(msg.created_at),
        });
      }
      if (msg.response) {
        messages.push({
          id: `${msg.id}-assistant`,
          role: 'assistant',
          content: msg.response,
          createdAt: new Date(msg.created_at),
        });
      }
    }

    return messages;
  }

  /**
   * Update an existing message (for when streaming completes)
   */
  async updateMessage(
    messageId: string,
    content: string
  ): Promise<void> {
    const response = await fetch(
      `${this.apiBase}/${this.workspaceId}/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: content }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update message: ${response.status}`);
    }
  }
}
```

### Step 2: Create Persistence Hook

```typescript
// chartsmith-app/hooks/useChatPersistence.ts

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Message } from '@ai-sdk/react';
import { ChatPersistenceService } from '@/lib/services/chat-persistence';

interface UseChatPersistenceOptions {
  workspaceId: string;
  enabled?: boolean;
}

interface UseChatPersistenceReturn {
  /** Load chat history */
  loadHistory: () => Promise<Message[]>;
  /** Save completed message */
  saveMessage: (userMsg: Message, assistantMsg: Message) => Promise<void>;
  /** Whether history is loading */
  isLoadingHistory: boolean;
  /** Initial messages loaded from history */
  initialMessages: Message[];
  /** Error from persistence operations */
  error: Error | null;
}

/**
 * Hook for managing chat message persistence
 */
export function useChatPersistence({
  workspaceId,
  enabled = true,
}: UseChatPersistenceOptions): UseChatPersistenceReturn {
  const serviceRef = useRef<ChatPersistenceService | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Initialize service
  useEffect(() => {
    if (enabled && workspaceId) {
      serviceRef.current = new ChatPersistenceService(workspaceId);
    }
  }, [workspaceId, enabled]);

  // Load history on mount
  useEffect(() => {
    if (!enabled || !workspaceId) {
      setIsLoadingHistory(false);
      return;
    }

    const loadInitialHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const service = new ChatPersistenceService(workspaceId);
        const history = await service.loadHistory();
        setInitialMessages(history);
        setError(null);
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setError(err instanceof Error ? err : new Error('Failed to load history'));
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadInitialHistory();
  }, [workspaceId, enabled]);

  const loadHistory = useCallback(async (): Promise<Message[]> => {
    if (!serviceRef.current) {
      return [];
    }
    try {
      const history = await serviceRef.current.loadHistory();
      setInitialMessages(history);
      return history;
    } catch (err) {
      console.error('Failed to load chat history:', err);
      throw err;
    }
  }, []);

  const saveMessage = useCallback(
    async (userMsg: Message, assistantMsg: Message): Promise<void> => {
      if (!serviceRef.current || !enabled) {
        return;
      }
      try {
        await serviceRef.current.saveMessagePair(userMsg, assistantMsg);
      } catch (err) {
        console.error('Failed to save message:', err);
        // Don't throw - persistence failure shouldn't break chat
        setError(err instanceof Error ? err : new Error('Failed to save'));
      }
    },
    [enabled]
  );

  return {
    loadHistory,
    saveMessage,
    isLoadingHistory,
    initialMessages,
    error,
  };
}
```

### Step 3: Update ChatContainerAISDK to Use Persistence

```typescript
// chartsmith-app/components/ChatContainerAISDK.tsx

// Add to imports
import { useChatPersistence } from '@/hooks/useChatPersistence';

// Update the component
export function ChatContainerAISDK({
  session,
  workspace,
}: ChatContainerAISDKProps) {
  // Get persistence hook
  const {
    initialMessages,
    isLoadingHistory,
    saveMessage,
  } = useChatPersistence({
    workspaceId: workspace.id,
    enabled: featureFlags.enableAISDKChat,
  });

  // Track the last user message for pairing
  const lastUserMessageRef = useRef<Message | null>(null);

  // Use the AI SDK chat hook with initial messages from history
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
  } = useAIChat({
    session,
    workspaceId: workspace.id,
    initialMessages: initialMessages,
    onMessageComplete: async (message) => {
      // When assistant message completes, save the pair
      if (message.role === 'assistant' && lastUserMessageRef.current) {
        await saveMessage(lastUserMessageRef.current, message);
        lastUserMessageRef.current = null;
      }
    },
    onError: (err) => {
      console.error('Chat error:', err);
    },
  });

  // Track user messages for pairing
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      lastUserMessageRef.current = lastMessage;
    }
  }, [messages]);

  // Show loading state while history loads
  if (isLoadingHistory) {
    return (
      <div className="chat-container-loading">
        <span>Loading chat history...</span>
      </div>
    );
  }

  // ... rest of component unchanged
}
```

### Step 4: Create API Endpoint for Messages (if not exists)

If the workspace messages endpoint doesn't exist, create it:

```typescript
// chartsmith-app/app/api/workspace/[workspaceId]/messages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * GET /api/workspace/[workspaceId]/messages
 * Load chat history for a workspace
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workspaceId } = params;

  try {
    const messages = await db.query(
      `SELECT id, prompt, response, created_at, revision_number
       FROM chat_messages
       WHERE workspace_id = $1
       ORDER BY created_at ASC`,
      [workspaceId]
    );

    return NextResponse.json({ messages: messages.rows });
  } catch (error) {
    console.error('Failed to load messages:', error);
    return NextResponse.json(
      { error: 'Failed to load messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspace/[workspaceId]/messages
 * Save a new chat message
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workspaceId } = params;
  const body = await req.json();
  const { prompt, response } = body;

  try {
    const result = await db.query(
      `INSERT INTO chat_messages (workspace_id, prompt, response, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [workspaceId, prompt, response]
    );

    return NextResponse.json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Failed to save message:', error);
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}
```

### Step 5: Add Tests

```typescript
// chartsmith-app/lib/services/__tests__/chat-persistence.test.ts

import { ChatPersistenceService } from '../chat-persistence';

describe('ChatPersistenceService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('loadHistory', () => {
    it('loads and converts messages to AI SDK format', async () => {
      const mockData = {
        messages: [
          {
            id: 'msg1',
            prompt: 'Hello',
            response: 'Hi there!',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const service = new ChatPersistenceService('workspace123');
      const messages = await service.loadHistory();

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        id: 'msg1-user',
        role: 'user',
        content: 'Hello',
        createdAt: expect.any(Date),
      });
      expect(messages[1]).toEqual({
        id: 'msg1-assistant',
        role: 'assistant',
        content: 'Hi there!',
        createdAt: expect.any(Date),
      });
    });

    it('returns empty array for 404', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const service = new ChatPersistenceService('workspace123');
      const messages = await service.loadHistory();

      expect(messages).toEqual([]);
    });
  });

  describe('saveMessagePair', () => {
    it('saves user and assistant message together', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'new-msg-id' }),
      });

      const service = new ChatPersistenceService('workspace123');
      const userMsg = { id: 'u1', role: 'user' as const, content: 'Hello' };
      const assistantMsg = { id: 'a1', role: 'assistant' as const, content: 'Hi!' };

      await service.saveMessagePair(userMsg, assistantMsg);

      expect(fetch).toHaveBeenCalledWith(
        '/api/workspace/workspace123/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Hello',
            response: 'Hi!',
          }),
        })
      );
    });
  });
});

// chartsmith-app/hooks/__tests__/useChatPersistence.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { useChatPersistence } from '../useChatPersistence';

jest.mock('@/lib/services/chat-persistence', () => ({
  ChatPersistenceService: jest.fn().mockImplementation(() => ({
    loadHistory: jest.fn().mockResolvedValue([]),
    saveMessagePair: jest.fn().mockResolvedValue({ id: 'msg1' }),
  })),
}));

describe('useChatPersistence', () => {
  it('loads history on mount', async () => {
    const { result } = renderHook(() =>
      useChatPersistence({ workspaceId: 'ws123' })
    );

    expect(result.current.isLoadingHistory).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
    });
  });

  it('provides saveMessage function', () => {
    const { result } = renderHook(() =>
      useChatPersistence({ workspaceId: 'ws123' })
    );

    expect(typeof result.current.saveMessage).toBe('function');
  });

  it('does not load when disabled', () => {
    const { result } = renderHook(() =>
      useChatPersistence({ workspaceId: 'ws123', enabled: false })
    );

    expect(result.current.isLoadingHistory).toBe(false);
  });
});
```

### Step 6: Run Tests

```bash
cd chartsmith-app
npm test -- --testPathPattern="chat-persistence|useChatPersistence"
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `chartsmith-app/lib/services/chat-persistence.ts` | Added | Persistence service |
| `chartsmith-app/hooks/useChatPersistence.ts` | Added | Persistence hook |
| `chartsmith-app/components/ChatContainerAISDK.tsx` | Modified | Integrate persistence |
| `chartsmith-app/app/api/workspace/[workspaceId]/messages/route.ts` | Added/Modified | API endpoint |
| `chartsmith-app/lib/services/__tests__/chat-persistence.test.ts` | Added | Service tests |
| `chartsmith-app/hooks/__tests__/useChatPersistence.test.ts` | Added | Hook tests |

---

## Acceptance Criteria

- [ ] Chat history loads on workspace open
- [ ] New messages are saved after completion
- [ ] User/assistant messages are paired correctly
- [ ] Conversion between formats works
- [ ] Loading state displays during history fetch
- [ ] Errors don't break chat functionality
- [ ] Unit tests pass
- [ ] Build succeeds

---

## Data Flow

```
1. User opens workspace
2. useChatPersistence loads history from DB
3. History converted to AI SDK Message format
4. Messages passed to useAIChat as initialMessages
5. User sends new message
6. AI streams response
7. On message complete, saveMessage called
8. Message pair saved to DB
```

---

## Testing Instructions

1. Unit tests:
   ```bash
   npm test -- --testPathPattern="chat-persistence"
   ```

2. Integration testing:
   - Enable feature flag
   - Open a workspace
   - Verify existing chat history loads
   - Send a new message
   - Refresh page
   - Verify new message persisted

---

## Rollback Plan

1. Feature flag controls integration
2. Remove persistence hook from ChatContainerAISDK
3. Original Jotai atoms still available as fallback

---

## PR Checklist

- [ ] Branch created from `main` (after deps merged)
- [ ] Persistence service created
- [ ] Hook created
- [ ] ChatContainerAISDK updated
- [ ] API endpoint created/updated
- [ ] Tests created and passing
- [ ] Build passes
- [ ] Integration tested
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Persistence is non-blocking (errors logged, not thrown)
- Message pairing assumes alternating user/assistant
- History loading shows skeleton/loading state
- Service is stateless, easily testable
