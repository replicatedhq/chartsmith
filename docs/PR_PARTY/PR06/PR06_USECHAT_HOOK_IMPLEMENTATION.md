# PR#6: useChat Hook Implementation

**Estimated Time:** 8-12 hours  
**Complexity:** MEDIUM-HIGH  
**Dependencies:** PR#1 (Frontend AI SDK Setup), PR#5 (Next.js API Route Proxy)  
**Parallel With:** None  
**Success Criteria:** G1 (Replace custom chat UI with Vercel AI SDK), N3 (Simplify state management)

---

## Overview

### What We're Building

This PR implements the core `useChat` hook integration that connects the frontend chat UI to the AI SDK streaming backend. We will:

1. **Implement `useAIChat` hook** - Replace the shell from PR#1 with a real implementation using `useChat` from `@ai-sdk/react`
2. **Message format conversion** - Create adapters to convert between AI SDK Message format and our existing `Message` type
3. **Jotai integration** - Bridge AI SDK's internal state with our existing Jotai atoms for plans, renders, and workspace state
4. **Feature flag support** - Ensure the hook works with feature flags to toggle between old and new implementations
5. **Streaming integration** - Connect to `/api/chat` endpoint and handle streaming responses

### Why It Matters

This PR is the **critical integration point** between the frontend and backend. It:
- Enables the actual chat functionality using AI SDK patterns
- Demonstrates that the hybrid architecture (useChat + Centrifugo) works
- Validates that message format conversion preserves all data
- Proves that state management simplification is achievable
- Sets the foundation for migrating `ChatContainer` and `ChatMessage` components in PR#7

### Success in One Sentence

"This PR is successful when `useAIChat` hook streams messages from `/api/chat`, converts formats correctly, integrates with Jotai atoms, and all existing chat functionality works identically."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Hook Abstraction Strategy
**Options Considered:**
1. **Direct `useChat` usage** - Simple, but tightly couples components to AI SDK
2. **Thin wrapper (`useAIChat`)** - Minimal abstraction, exposes most of `useChat` API
3. **Thick abstraction** - Hides AI SDK completely, custom interface

**Chosen:** Thin wrapper (`useAIChat`)

**Rationale:**
- Allows gradual migration without hiding AI SDK benefits
- Enables feature flag toggling between implementations
- Provides consistent interface for components
- Makes testing easier (can mock the hook)
- Preserves access to AI SDK features (stop, reload, etc.)

**Trade-offs:**
- Gain: Flexibility, testability, feature flag support, access to AI SDK features
- Lose: Slight indirection (minimal overhead, acceptable)

#### Decision 2: Message Format Conversion Strategy
**Options Considered:**
1. **Convert on-the-fly** - Transform AI SDK messages to `Message` type as they arrive
2. **Dual format support** - Store both formats, convert when needed
3. **Adapter functions** - Separate conversion utilities, called explicitly

**Chosen:** Convert on-the-fly with adapter functions

**Rationale:**
- Keeps components using familiar `Message` type
- Single source of truth (AI SDK format)
- Conversion logic centralized in adapter functions
- Easier to test conversion logic separately
- Can optimize conversion if needed

**Trade-offs:**
- Gain: Clean separation, testable, maintainable
- Lose: Small conversion overhead (negligible)

#### Decision 3: State Management Integration
**Options Considered:**
1. **Replace Jotai completely** - Use only AI SDK state, migrate everything
2. **Hybrid approach** - AI SDK for messages, Jotai for plans/renders
3. **Sync both** - Keep Jotai `messagesAtom` in sync with AI SDK state

**Chosen:** Hybrid approach with sync

**Rationale:**
- AI SDK manages chat messages (simplifies state)
- Jotai still needed for plans, renders, workspace (not chat-related)
- Sync `messagesAtom` for components that haven't migrated yet
- Clear separation: chat = AI SDK, everything else = Jotai
- Feature flag allows gradual migration

**Trade-offs:**
- Gain: Best of both worlds, gradual migration, clear boundaries
- Lose: Temporary dual state (removed in PR#9)

#### Decision 4: Historical Messages Loading
**Options Considered:**
1. **Load via AI SDK** - Fetch from `/api/chat` with history parameter
2. **Load via server action** - Use existing `getWorkspaceMessagesAction`
3. **Hybrid** - Load history via server action, convert to AI SDK format

**Chosen:** Hybrid approach

**Rationale:**
- Existing server action already works and is tested
- Convert loaded messages to AI SDK format for `useChat`
- Simpler than modifying backend endpoint
- Can optimize later if needed

**Trade-offs:**
- Gain: Reuse existing code, faster implementation
- Lose: Extra conversion step (acceptable)

### Data Model

**No database changes** - This PR only affects frontend state management and message format conversion.

**Message Format Mapping:**

```typescript
// AI SDK Message format
interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: ToolInvocation[];
}

// Our Message format (from components/types.ts)
interface Message {
  id: string;
  prompt: string;           // Maps to user message content
  response?: string;        // Maps to assistant message content
  isComplete: boolean;
  isApplied?: boolean;
  isApplying?: boolean;
  isIgnored?: boolean;
  isCanceled?: boolean;
  createdAt?: Date;
  workspaceId?: string;
  userId?: string;
  isIntentComplete?: boolean;
  followupActions?: any[];
  responseRenderId?: string;
  responsePlanId?: string;
  responseRollbackToRevisionNumber?: number;
  planId?: string;
  revisionNumber?: number;
}
```

**Conversion Strategy:**
- **AI SDK → Message**: Extract `role` and `content`, map to `prompt`/`response`
- **Message → AI SDK**: Create separate user/assistant messages, preserve metadata
- **Metadata preservation**: Store Chartsmith-specific fields in message metadata or separate state

### API Design

**New Hook Interface:**

```typescript
interface UseAIChatOptions {
  workspaceId: string;
  session: Session;
  initialMessages?: Message[];
  enabled?: boolean; // Feature flag
}

interface UseAIChatReturn {
  // From useChat
  messages: Message[]; // Converted from AI SDK format
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
  reload: () => void;
  
  // Chartsmith-specific
  selectedRole: 'auto' | 'developer' | 'operator';
  setSelectedRole: (role: 'auto' | 'developer' | 'operator') => void;
}
```

**Adapter Functions:**

```typescript
// Convert AI SDK message to our Message format
function aiMessageToMessage(aiMessage: AIMessage, metadata?: MessageMetadata): Message

// Convert our Message format to AI SDK messages (user + assistant pair)
function messageToAIMessages(message: Message): AIMessage[]

// Convert array of Messages to AI SDK format for initial messages
function messagesToAIMessages(messages: Message[]): AIMessage[]
```

### Component Hierarchy

```
useAIChat Hook
├── useChat (from @ai-sdk/react)
│   ├── Fetches from /api/chat
│   ├── Manages streaming state
│   └── Handles errors/loading
├── Message Format Adapters
│   ├── aiMessageToMessage()
│   └── messageToAIMessages()
└── Jotai Integration
    ├── Syncs messagesAtom
    └── Preserves plans/renders atoms
```

---

## Implementation Details

### File Structure

**New Files:**
```
chartsmith-app/
├── hooks/
│   └── useAIChat.ts (~300-400 lines) - Main hook implementation
├── lib/
│   └── types/
│       └── chat.ts (~100-150 lines) - Chat types and adapters
```

**Modified Files:**
```
chartsmith-app/
├── atoms/
│   └── workspace.ts (+50-100 lines) - Adapter functions for message sync
├── lib/
│   └── config/
│       └── feature-flags.ts (modified) - Ensure flag works with hook
```

### Key Implementation Steps

#### Phase 1: Message Format Adapters (2-3 hours)

1. **Create `lib/types/chat.ts`**
   - Define `AIMessage` type (or import from AI SDK)
   - Define `MessageMetadata` type for Chartsmith-specific fields
   - Implement `aiMessageToMessage()` function
   - Implement `messageToAIMessages()` function
   - Implement `messagesToAIMessages()` function
   - Add unit tests for each conversion function

2. **Test Conversions**
   - Test user message conversion
   - Test assistant message conversion
   - Test streaming message updates
   - Test metadata preservation
   - Test edge cases (empty messages, tool calls, etc.)

#### Phase 2: Hook Implementation (3-4 hours)

1. **Implement `useAIChat` hook**
   - Import `useChat` from `@ai-sdk/react`
   - Configure with `/api/chat` endpoint
   - Handle feature flag (return old implementation if disabled)
   - Load initial messages from server action
   - Convert initial messages to AI SDK format
   - Set up message conversion on stream updates
   - Sync with `messagesAtom` when feature flag enabled

2. **Handle Streaming**
   - Convert streaming AI SDK messages to `Message` format
   - Update `messagesAtom` in real-time
   - Preserve metadata (renderId, planId, etc.)
   - Handle tool calls (if present in stream)

3. **Handle User Input**
   - Integrate with role selector
   - Send role in request body or headers
   - Handle form submission
   - Clear input after submit

4. **Error Handling**
   - Catch and convert AI SDK errors
   - Display error messages appropriately
   - Handle network failures
   - Handle cancellation

#### Phase 3: Jotai Integration (2-3 hours)

1. **Create Sync Functions**
   - Add `syncMessagesToAtom()` function in `atoms/workspace.ts`
   - Update `messagesAtom` when AI SDK messages change
   - Preserve existing atom structure for non-chat features

2. **Handle Plans/Renders**
   - Ensure plans and renders still work with new hook
   - Preserve `responsePlanId` and `responseRenderId` in messages
   - Keep Centrifugo integration for plan/render updates

3. **Test Integration**
   - Verify messages sync correctly
   - Verify plans still work
   - Verify renders still work
   - Verify no conflicts between useChat and Centrifugo

#### Phase 4: Feature Flag Integration (1-2 hours)

1. **Update Feature Flag Logic**
   - Check flag in `useAIChat` hook
   - Return old implementation if flag disabled
   - Ensure both paths work correctly

2. **Test Both Paths**
   - Test with flag enabled (new implementation)
   - Test with flag disabled (old implementation)
   - Verify no regressions

### Code Examples

**Example 1: Message Format Adapter**

```typescript
// lib/types/chat.ts
import { Message } from '@/components/types';
import { CoreMessage } from 'ai';

export interface MessageMetadata {
  workspaceId?: string;
  userId?: string;
  isIntentComplete?: boolean;
  followupActions?: any[];
  responseRenderId?: string;
  responsePlanId?: string;
  responseRollbackToRevisionNumber?: number;
  planId?: string;
  revisionNumber?: number;
  isApplied?: boolean;
  isApplying?: boolean;
  isIgnored?: boolean;
  isCanceled?: boolean;
}

/**
 * Convert AI SDK message to our Message format
 */
export function aiMessageToMessage(
  aiMessage: CoreMessage,
  metadata: MessageMetadata = {}
): Message {
  if (aiMessage.role === 'user') {
    return {
      id: aiMessage.id || generateId(),
      prompt: typeof aiMessage.content === 'string' 
        ? aiMessage.content 
        : aiMessage.content.map(c => c.type === 'text' ? c.text : '').join(''),
      response: undefined,
      isComplete: true,
      createdAt: new Date(),
      ...metadata,
    };
  } else if (aiMessage.role === 'assistant') {
    return {
      id: aiMessage.id || generateId(),
      prompt: '', // Assistant messages don't have prompts
      response: typeof aiMessage.content === 'string'
        ? aiMessage.content
        : aiMessage.content.map(c => c.type === 'text' ? c.text : '').join(''),
      isComplete: true,
      createdAt: new Date(),
      ...metadata,
    };
  }
  
  throw new Error(`Unsupported message role: ${aiMessage.role}`);
}

/**
 * Convert our Message format to AI SDK messages (user + assistant pair)
 */
export function messageToAIMessages(message: Message): CoreMessage[] {
  const messages: CoreMessage[] = [];
  
  if (message.prompt) {
    messages.push({
      role: 'user',
      content: message.prompt,
      id: `${message.id}-user`,
    });
  }
  
  if (message.response) {
    messages.push({
      role: 'assistant',
      content: message.response,
      id: `${message.id}-assistant`,
    });
  }
  
  return messages;
}

/**
 * Convert array of Messages to AI SDK format for initial messages
 */
export function messagesToAIMessages(messages: Message[]): CoreMessage[] {
  return messages.flatMap(messageToAIMessages);
}
```

**Example 2: Hook Implementation**

```typescript
// hooks/useAIChat.ts
'use client';

import { useChat } from '@ai-sdk/react';
import { useAtom } from 'jotai';
import { messagesAtom } from '@/atoms/workspace';
import { Session } from '@/lib/types/session';
import { Message } from '@/components/types';
import { 
  messagesToAIMessages, 
  aiMessageToMessage,
  MessageMetadata 
} from '@/lib/types/chat';
import { getWorkspaceMessagesAction } from '@/lib/workspace/actions/get-workspace-messages';
import { useFeatureFlag } from '@/lib/config/feature-flags';
import { useState, useEffect } from 'react';

interface UseAIChatOptions {
  workspaceId: string;
  session: Session;
  initialMessages?: Message[];
}

export function useAIChat({ workspaceId, session, initialMessages }: UseAIChatOptions) {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [selectedRole, setSelectedRole] = useState<'auto' | 'developer' | 'operator'>('auto');
  const enableAISDKChat = useFeatureFlag('ENABLE_AI_SDK_CHAT');
  
  // Load initial messages if not provided
  const [loadedMessages, setLoadedMessages] = useState<Message[]>(initialMessages || []);
  
  useEffect(() => {
    if (!initialMessages && enableAISDKChat) {
      // Load messages from server action
      getWorkspaceMessagesAction(session, workspaceId).then(setLoadedMessages);
    }
  }, [workspaceId, session, initialMessages, enableAISDKChat]);
  
  // Convert loaded messages to AI SDK format
  const initialAIMessages = messagesToAIMessages(loadedMessages);
  
  // Configure useChat
  const {
    messages: aiMessages,
    input,
    handleInputChange,
    handleSubmit: aiHandleSubmit,
    isLoading,
    error,
    stop,
    reload,
    setMessages: setAIMessages,
  } = useChat({
    api: '/api/chat',
    initialMessages: initialAIMessages,
    body: {
      workspaceId,
      role: selectedRole,
    },
    onFinish: (message) => {
      // Convert finished message and sync to atom
      const convertedMessage = aiMessageToMessage(message, {
        workspaceId,
        userId: session.user.id,
      });
      setMessages(prev => {
        const existing = prev.find(m => m.id === convertedMessage.id);
        if (existing) {
          return prev.map(m => m.id === convertedMessage.id ? convertedMessage : m);
        }
        return [...prev, convertedMessage];
      });
    },
    onError: (error) => {
      console.error('Chat error:', error);
      // Handle error appropriately
    },
  });
  
  // Sync AI SDK messages to Jotai atom in real-time
  useEffect(() => {
    if (!enableAISDKChat) return;
    
    // Convert all AI messages to our format
    const convertedMessages: Message[] = [];
    let currentUserMessage: Message | null = null;
    
    for (const aiMessage of aiMessages) {
      if (aiMessage.role === 'user') {
        // Save previous user message if exists
        if (currentUserMessage) {
          convertedMessages.push(currentUserMessage);
        }
        currentUserMessage = aiMessageToMessage(aiMessage, {
          workspaceId,
          userId: session.user.id,
        });
      } else if (aiMessage.role === 'assistant') {
        if (currentUserMessage) {
          // Merge assistant response with user message
          const assistantContent = typeof aiMessage.content === 'string'
            ? aiMessage.content
            : aiMessage.content.map(c => c.type === 'text' ? c.text : '').join('');
          currentUserMessage.response = assistantContent;
          currentUserMessage.isComplete = true;
          convertedMessages.push(currentUserMessage);
          currentUserMessage = null;
        }
      }
    }
    
    // Add last user message if exists
    if (currentUserMessage) {
      convertedMessages.push(currentUserMessage);
    }
    
    setMessages(convertedMessages);
  }, [aiMessages, workspaceId, session.user.id, enableAISDKChat, setMessages]);
  
  // Wrap handleSubmit to include role
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    aiHandleSubmit(e);
  };
  
  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
    selectedRole,
    setSelectedRole,
  };
}
```

**Example 3: Feature Flag Integration**

```typescript
// lib/config/feature-flags.ts
export function useFeatureFlag(flagName: string): boolean {
  if (typeof window === 'undefined') {
    // Server-side: read from environment
    return process.env[flagName] === 'true';
  }
  
  // Client-side: read from environment (Next.js exposes env vars)
  return process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT === 'true';
}
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- Message format conversion functions
  - `aiMessageToMessage()` with various inputs
  - `messageToAIMessages()` with various inputs
  - `messagesToAIMessages()` with arrays
  - Edge cases (empty messages, tool calls, metadata)

- Hook logic (mocked `useChat`)
  - Initial message loading
  - Message conversion on stream
  - Jotai atom syncing
  - Error handling

**Integration Tests:**
- Hook with real `/api/chat` endpoint
  - Send message and receive response
  - Stream updates correctly
  - Messages sync to atom
  - Error handling works

- Feature flag toggling
  - Old implementation when flag disabled
  - New implementation when flag enabled
  - No conflicts between implementations

**Manual Testing:**
- Chat flow works end-to-end
- Streaming text appears smoothly
- Messages persist correctly
- Plans and renders still work
- Role selector works
- Error states display correctly

### Edge Cases

- Empty message history
- Very long messages
- Rapid message sending
- Network failures
- Server errors
- Cancellation mid-stream
- Tool calls in messages
- Messages with metadata (renderId, planId)

### Performance Tests

- Time to first token (should match or improve)
- Message conversion overhead (should be <10ms)
- Memory usage (no leaks)
- Re-render frequency (should be optimized)

---

## Success Criteria

**Feature is complete when:**
- [ ] `useAIChat` hook implemented and working
- [ ] Message format conversion functions work correctly
- [ ] Hook streams messages from `/api/chat`
- [ ] Messages sync to `messagesAtom` correctly
- [ ] Feature flag toggles between implementations
- [ ] Historical messages load correctly
- [ ] Role selector integrates with hook
- [ ] Error handling works correctly
- [ ] Plans and renders still work (no regressions)
- [ ] All tests pass
- [ ] No console errors or warnings
- [ ] Performance is acceptable

**Performance Targets:**
- Message conversion: <10ms per message
- Hook initialization: <100ms
- Memory: No leaks over 100 messages
- Re-renders: Optimized (use memoization where needed)

**Quality Gates:**
- Zero critical bugs
- Test coverage >80% for new code
- TypeScript strict mode passes
- No console errors
- Feature flag works correctly

---

## Risk Assessment

### Risk 1: Message Format Mismatch
**Likelihood:** MEDIUM  
**Impact:** HIGH  
**Mitigation:**
- Comprehensive conversion tests
- Handle all message fields
- Preserve metadata in separate structure if needed
- Test with real messages from database

**Status:** 🟡 Needs careful implementation

### Risk 2: State Sync Conflicts
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Clear separation: AI SDK manages chat, Jotai manages plans/renders
- Sync only when feature flag enabled
- Test both implementations side-by-side
- Monitor for race conditions

**Status:** 🟡 Needs testing

### Risk 3: Performance Regression
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:**
- Benchmark conversion functions
- Use memoization for expensive operations
- Profile re-renders
- Optimize hot paths

**Status:** 🟢 Low risk with proper optimization

### Risk 4: Feature Flag Complexity
**Likelihood:** LOW  
**Impact:** LOW  
**Mitigation:**
- Keep flag logic simple
- Test both paths thoroughly
- Document flag usage
- Remove flag in PR#9

**Status:** 🟢 Low risk

### Risk 5: Historical Messages Loading
**Likelihood:** LOW  
**Impact:** LOW  
**Mitigation:**
- Reuse existing server action
- Test with various message counts
- Handle empty history gracefully
- Optimize if needed

**Status:** 🟢 Low risk

---

## Open Questions

1. **Question 1: Tool Call Handling**
   - **Options:**
     - A: Handle tool calls in conversion (extract and display)
     - B: Pass through tool calls as-is, handle in components
   - **Decision needed by:** Phase 2
   - **Recommendation:** Option B (simpler, handle in PR#8)

2. **Question 2: Metadata Storage**
   - **Options:**
     - A: Store in AI SDK message metadata field
     - B: Maintain separate metadata map
     - C: Extend Message type to include all fields
   - **Decision needed by:** Phase 1
   - **Recommendation:** Option C (preserves existing structure)

3. **Question 3: Streaming Updates Frequency**
   - **Options:**
     - A: Update atom on every token (smooth but many updates)
     - B: Batch updates (less smooth but fewer updates)
   - **Decision needed by:** Phase 2
   - **Recommendation:** Option A (useChat handles optimization)

---

## Timeline

**Total Estimate:** 8-12 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Message Format Adapters | 2-3 h | ⏳ |
| 2 | Hook Implementation | 3-4 h | ⏳ |
| 3 | Jotai Integration | 2-3 h | ⏳ |
| 4 | Feature Flag Integration | 1-2 h | ⏳ |
| 5 | Testing | 2-3 h | ⏳ |

---

## Dependencies

**Requires:**
- [ ] PR#1 complete (AI SDK packages installed)
- [ ] PR#5 complete (`/api/chat` endpoint working)
- [ ] Feature flag infrastructure working
- [ ] Go backend streaming AI SDK protocol

**Blocks:**
- PR#7 (Chat UI Component Migration) - needs this hook
- PR#8 (Tool Call Protocol Support) - can proceed in parallel

---

## References

- Related PR: PR#1 (Frontend AI SDK Setup)
- Related PR: PR#5 (Next.js API Route Proxy)
- Related PR: PR#7 (Chat UI Component Migration)
- AI SDK Docs: https://sdk.vercel.ai/docs
- useChat Hook: https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
- Architecture Comparison: `docs/architecture-comparison.md`

