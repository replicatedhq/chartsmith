# PR-08: ChatContainer Component Migration

**Branch:** `feat/chat-container-ai-sdk`
**Dependencies:** PR-03 (Feature flags), PR-07 (useAIChat hook)
**Parallel With:** PR-09, PR-11 (after deps merge)
**Estimated Complexity:** Medium
**Success Criteria:** G1 (Replace chat UI), G3 (Maintain functionality), G4 (Keep behavior)

---

## Overview

Migrate the `ChatContainer` component to use the new `useAIChat` hook when the feature flag is enabled. This component handles the chat input, role selection, and message submission.

## Prerequisites

- PR-03 merged (Feature flags)
- PR-07 merged (useAIChat hook)
- Understanding of existing `ChatContainer.tsx`

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Migration approach | Conditional rendering | Feature flag controls old vs new |
| Role selector | Keep existing UI | Preserve UX |
| Submit behavior | Match existing | No regression |

---

## Step-by-Step Instructions

### Step 1: Read Existing ChatContainer

First, understand the current implementation:

```bash
cat chartsmith-app/components/ChatContainer.tsx
```

Note:
- Current state management (useState, atoms)
- Event handlers (onSubmit, onChange)
- Role selector logic
- Disabled states

### Step 2: Create AI SDK Version of ChatContainer

Create a new component that uses the AI SDK:

```typescript
// chartsmith-app/components/ChatContainerAISDK.tsx

'use client';

import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { Session } from '@/lib/types/session';
import { Workspace } from '@/lib/types/workspace';
import { useAIChat, toAISDKMessage } from '@/hooks/useAIChat';
import { messagesAtom } from '@/atoms/workspace';
import { ChatMessageFromPersona } from '@/lib/workspace/workspace';

// Import your existing UI components
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ChatContainerAISDKProps {
  session: Session;
  workspace: Workspace;
}

/**
 * AI SDK version of ChatContainer
 *
 * Uses the useChat hook from @ai-sdk/react for message handling
 * while preserving the existing UI and role selection.
 */
export function ChatContainerAISDK({
  session,
  workspace,
}: ChatContainerAISDKProps) {
  // Get existing messages from Jotai (for loading history)
  const [existingMessages] = useAtom(messagesAtom);

  // Role selection state (preserved from original)
  const [selectedRole, setSelectedRole] = React.useState<ChatMessageFromPersona>(
    ChatMessageFromPersona.AUTO
  );

  // Convert existing messages to AI SDK format for initial state
  const initialMessages = React.useMemo(() => {
    return existingMessages
      .map((msg) => toAISDKMessage({
        id: msg.id,
        prompt: msg.prompt,
        response: msg.response,
        createdAt: msg.createdAt,
      }))
      .filter((msg): msg is NonNullable<typeof msg> => msg !== null);
  }, []); // Only compute on mount

  // Use the AI SDK chat hook
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
    initialMessages,
    onMessageComplete: async (message) => {
      // Message completed - could persist to DB here
      // For now, let PR-11 handle persistence
      console.log('Message completed:', message.id);
    },
    onError: (err) => {
      console.error('Chat error:', err);
      // Could show toast notification here
    },
  });

  // Handle keyboard submit (Enter without Shift)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form && !isLoading && input.trim()) {
        form.requestSubmit();
      }
    }
  };

  // Cancel ongoing stream
  const handleCancel = () => {
    if (isLoading) {
      stop();
    }
  };

  return (
    <div className="chat-container">
      {/* Error display */}
      {error && (
        <div className="chat-error bg-red-100 text-red-700 p-2 rounded mb-2">
          Error: {error.message}
        </div>
      )}

      {/* Chat form */}
      <form onSubmit={handleSubmit} className="chat-form">
        {/* Role selector - preserved from original */}
        <div className="role-selector mb-2">
          <Select
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as ChatMessageFromPersona)}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ChatMessageFromPersona.AUTO}>Auto</SelectItem>
              <SelectItem value={ChatMessageFromPersona.DEVELOPER}>Developer</SelectItem>
              <SelectItem value={ChatMessageFromPersona.OPERATOR}>Operator</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Input textarea */}
        <div className="input-container flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your Helm chart..."
            disabled={isLoading}
            className="flex-1"
            rows={3}
          />

          {/* Submit/Cancel button */}
          {isLoading ? (
            <Button
              type="button"
              onClick={handleCancel}
              variant="destructive"
            >
              Cancel
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
            >
              Send
            </Button>
          )}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="loading-indicator mt-2 text-sm text-gray-500">
            AI is thinking...
          </div>
        )}
      </form>
    </div>
  );
}
```

### Step 3: Update Original ChatContainer with Feature Flag

Modify the existing `ChatContainer.tsx` to conditionally use the new component:

```typescript
// chartsmith-app/components/ChatContainer.tsx

'use client';

import React from 'react';
import { featureFlags } from '@/lib/config/feature-flags';
import { ChatContainerAISDK } from './ChatContainerAISDK';

// ... existing imports and code ...

interface ChatContainerProps {
  session: Session;
  workspace: Workspace;
  // ... other existing props
}

export function ChatContainer(props: ChatContainerProps) {
  // Feature flag check - use new implementation when enabled
  if (featureFlags.enableAISDKChat) {
    return <ChatContainerAISDK {...props} />;
  }

  // Original implementation below
  // ... keep all existing code unchanged ...
}
```

### Step 4: Add Tests for AI SDK Component

```typescript
// chartsmith-app/components/__tests__/ChatContainerAISDK.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'jotai';
import { ChatContainerAISDK } from '../ChatContainerAISDK';

// Mock the useAIChat hook
jest.mock('@/hooks/useAIChat', () => ({
  useAIChat: jest.fn(() => ({
    messages: [],
    input: '',
    handleInputChange: jest.fn(),
    handleSubmit: jest.fn((e) => e.preventDefault()),
    isLoading: false,
    error: undefined,
    stop: jest.fn(),
    isAISDKEnabled: true,
  })),
  toAISDKMessage: jest.fn(() => null),
}));

// Mock UI components
jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea data-testid="chat-input" {...props} />,
}));

jest.mock('@/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span>Select role</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

import { useAIChat } from '@/hooks/useAIChat';

describe('ChatContainerAISDK', () => {
  const mockSession = {
    user: { id: 'user123', name: 'Test User' },
  } as any;

  const mockWorkspace = {
    id: 'workspace123',
    name: 'Test Workspace',
    charts: [],
    files: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders chat input', () => {
    render(
      <Provider>
        <ChatContainerAISDK
          session={mockSession}
          workspace={mockWorkspace}
        />
      </Provider>
    );

    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('renders send button', () => {
    render(
      <Provider>
        <ChatContainerAISDK
          session={mockSession}
          workspace={mockWorkspace}
        />
      </Provider>
    );

    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(
      <Provider>
        <ChatContainerAISDK
          session={mockSession}
          workspace={mockWorkspace}
        />
      </Provider>
    );

    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
  });

  it('shows cancel button when loading', () => {
    (useAIChat as jest.Mock).mockReturnValue({
      messages: [],
      input: 'test',
      handleInputChange: jest.fn(),
      handleSubmit: jest.fn(),
      isLoading: true,
      error: undefined,
      stop: jest.fn(),
      isAISDKEnabled: true,
    });

    render(
      <Provider>
        <ChatContainerAISDK
          session={mockSession}
          workspace={mockWorkspace}
        />
      </Provider>
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows error message when error occurs', () => {
    (useAIChat as jest.Mock).mockReturnValue({
      messages: [],
      input: '',
      handleInputChange: jest.fn(),
      handleSubmit: jest.fn(),
      isLoading: false,
      error: new Error('Test error'),
      stop: jest.fn(),
      isAISDKEnabled: true,
    });

    render(
      <Provider>
        <ChatContainerAISDK
          session={mockSession}
          workspace={mockWorkspace}
        />
      </Provider>
    );

    expect(screen.getByText('Error: Test error')).toBeInTheDocument();
  });

  it('shows loading indicator when loading', () => {
    (useAIChat as jest.Mock).mockReturnValue({
      messages: [],
      input: '',
      handleInputChange: jest.fn(),
      handleSubmit: jest.fn(),
      isLoading: true,
      error: undefined,
      stop: jest.fn(),
      isAISDKEnabled: true,
    });

    render(
      <Provider>
        <ChatContainerAISDK
          session={mockSession}
          workspace={mockWorkspace}
        />
      </Provider>
    );

    expect(screen.getByText('AI is thinking...')).toBeInTheDocument();
  });
});
```

### Step 5: Run Tests

```bash
npm test -- --testPathPattern=ChatContainer
```

### Step 6: Visual Verification

1. Enable feature flag:
   ```bash
   # In .env.local
   NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true
   ```

2. Start dev server:
   ```bash
   npm run dev
   ```

3. Navigate to a workspace and verify:
   - Chat input appears
   - Role selector works
   - Submit button works
   - Loading state shows
   - Cancel button appears during loading

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `chartsmith-app/components/ChatContainerAISDK.tsx` | Added | New AI SDK component |
| `chartsmith-app/components/ChatContainer.tsx` | Modified | Added feature flag conditional |
| `chartsmith-app/components/__tests__/ChatContainerAISDK.test.tsx` | Added | Unit tests |

---

## Acceptance Criteria

- [ ] `ChatContainerAISDK` component created
- [ ] Feature flag controls which component renders
- [ ] Chat input works
- [ ] Role selector preserved and works
- [ ] Submit button works
- [ ] Enter key submits (without Shift)
- [ ] Cancel button appears during loading
- [ ] Error messages display
- [ ] Loading indicator shows
- [ ] Unit tests pass
- [ ] Build succeeds

---

## UI Preservation Checklist (G4)

Verify these behaviors match the original:

- [ ] Chat input appearance matches
- [ ] Role selector appearance matches
- [ ] Submit button appearance matches
- [ ] Placeholder text matches
- [ ] Keyboard shortcuts work (Enter to submit)
- [ ] Disabled states match
- [ ] Error display matches

---

## Testing Instructions

1. Unit tests:
   ```bash
   npm test -- --testPathPattern=ChatContainer
   ```

2. Manual testing with feature flag OFF:
   - Verify original ChatContainer renders
   - Verify all existing functionality works

3. Manual testing with feature flag ON:
   - Verify ChatContainerAISDK renders
   - Verify input, role selector, submit work
   - Verify loading and error states

---

## Rollback Plan

1. Set `NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false`
2. Original ChatContainer immediately used
3. Can also revert the feature flag check in ChatContainer.tsx

---

## PR Checklist

- [ ] Branch created from `main` (after deps merged)
- [ ] ChatContainerAISDK created
- [ ] ChatContainer updated with feature flag
- [ ] Tests created and passing
- [ ] Build passes
- [ ] Manual testing complete (both flag states)
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- Original ChatContainer code is unchanged (except feature flag check)
- New component mirrors original UI
- Role selector behavior preserved
- Tests verify key functionality
- Visual testing recommended
