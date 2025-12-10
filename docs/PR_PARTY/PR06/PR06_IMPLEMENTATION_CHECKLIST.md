# PR#6: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (`PR06_USECHAT_HOOK_IMPLEMENTATION.md`) (~45 min)
- [ ] Prerequisites verified
  - [ ] PR#1 complete (AI SDK packages installed)
  - [ ] PR#5 complete (`/api/chat` endpoint working)
  - [ ] Feature flag infrastructure exists
- [ ] Dependencies installed
  ```bash
  cd chartsmith-app
  npm install
  ```
- [ ] Environment configured
  ```bash
  # Ensure feature flag is available
  # NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true (for testing)
  ```
- [ ] Git branch created
  ```bash
  git checkout -b feat/ai-sdk-use-chat
  ```

---

## Phase 1: Message Format Adapters (2-3 hours)

### 1.1: Create Chat Types File (30 minutes)

#### Create File
- [ ] Create `chartsmith-app/lib/types/chat.ts`

#### Define Types
- [ ] Import `CoreMessage` from `ai` package
- [ ] Import `Message` from `@/components/types`
- [ ] Define `MessageMetadata` interface
  ```typescript
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
  ```

**Checkpoint:** Types defined ✓

**Commit:** `feat(chat): add message metadata type definitions`

---

### 1.2: Implement aiMessageToMessage Function (45 minutes)

#### Create Conversion Function
- [ ] Implement `aiMessageToMessage()` function
  ```typescript
  export function aiMessageToMessage(
    aiMessage: CoreMessage,
    metadata: MessageMetadata = {}
  ): Message {
    // Handle user messages
    if (aiMessage.role === 'user') {
      return {
        id: aiMessage.id || generateId(),
        prompt: extractContent(aiMessage.content),
        response: undefined,
        isComplete: true,
        createdAt: new Date(),
        ...metadata,
      };
    }
    
    // Handle assistant messages
    if (aiMessage.role === 'assistant') {
      return {
        id: aiMessage.id || generateId(),
        prompt: '',
        response: extractContent(aiMessage.content),
        isComplete: true,
        createdAt: new Date(),
        ...metadata,
      };
    }
    
    throw new Error(`Unsupported message role: ${aiMessage.role}`);
  }
  ```

#### Create Helper Functions
- [ ] Create `extractContent()` helper
  ```typescript
  function extractContent(content: string | Array<{type: string, text?: string}>): string {
    if (typeof content === 'string') {
      return content;
    }
    return content
      .map(c => c.type === 'text' ? c.text || '' : '')
      .join('');
  }
  ```
- [ ] Create `generateId()` helper (or import from existing utils)

#### Test Function
- [ ] Test case 1: User message conversion
  - Input: `{ role: 'user', content: 'Hello' }`
  - Expected: `Message` with `prompt: 'Hello'`
  - Actual: [Record result]
- [ ] Test case 2: Assistant message conversion
  - Input: `{ role: 'assistant', content: 'Hi there' }`
  - Expected: `Message` with `response: 'Hi there'`
  - Actual: [Record result]
- [ ] Test case 3: Complex content (array format)
  - Input: `{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }`
  - Expected: `Message` with `prompt: 'Hello'`
  - Actual: [Record result]
- [ ] Test case 4: Metadata preservation
  - Input: Message with `workspaceId` in metadata
  - Expected: `Message` includes `workspaceId`
  - Actual: [Record result]

**Checkpoint:** `aiMessageToMessage()` working ✓

**Commit:** `feat(chat): implement AI SDK to Message conversion`

---

### 1.3: Implement messageToAIMessages Function (30 minutes)

#### Create Conversion Function
- [ ] Implement `messageToAIMessages()` function
  ```typescript
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
  ```

#### Test Function
- [ ] Test case 1: Message with prompt only
  - Input: `{ id: '1', prompt: 'Hello', response: undefined }`
  - Expected: Array with one user message
  - Actual: [Record result]
- [ ] Test case 2: Message with response
  - Input: `{ id: '1', prompt: 'Hello', response: 'Hi' }`
  - Expected: Array with user + assistant messages
  - Actual: [Record result]
- [ ] Test case 3: Empty message
  - Input: `{ id: '1', prompt: '', response: '' }`
  - Expected: Empty array (or handle appropriately)
  - Actual: [Record result]

**Checkpoint:** `messageToAIMessages()` working ✓

**Commit:** `feat(chat): implement Message to AI SDK conversion`

---

### 1.4: Implement messagesToAIMessages Function (15 minutes)

#### Create Conversion Function
- [ ] Implement `messagesToAIMessages()` function
  ```typescript
  export function messagesToAIMessages(messages: Message[]): CoreMessage[] {
    return messages.flatMap(messageToAIMessages);
  }
  ```

#### Test Function
- [ ] Test case 1: Empty array
  - Input: `[]`
  - Expected: `[]`
  - Actual: [Record result]
- [ ] Test case 2: Multiple messages
  - Input: Array of 3 messages
  - Expected: Array of 6 AI SDK messages (3 user + 3 assistant)
  - Actual: [Record result]

**Checkpoint:** `messagesToAIMessages()` working ✓

**Commit:** `feat(chat): implement batch message conversion`

---

### 1.5: Write Unit Tests (30 minutes)

#### Create Test File
- [ ] Create `chartsmith-app/lib/types/__tests__/chat.test.ts`

#### Write Tests
- [ ] Test `aiMessageToMessage()` with all edge cases
- [ ] Test `messageToAIMessages()` with all edge cases
- [ ] Test `messagesToAIMessages()` with various inputs
- [ ] Test metadata preservation
- [ ] Test error cases (invalid roles, etc.)

#### Run Tests
- [ ] All tests pass
  ```bash
  npm test -- lib/types/__tests__/chat.test.ts
  ```

**Checkpoint:** All conversion tests passing ✓

**Commit:** `test(chat): add unit tests for message conversion functions`

---

## Phase 2: Hook Implementation (3-4 hours)

### 2.1: Set Up Hook Structure (30 minutes)

#### Create Hook File
- [ ] Create `chartsmith-app/hooks/useAIChat.ts`

#### Add Imports
- [ ] Import `useChat` from `@ai-sdk/react`
- [ ] Import `useAtom` from `jotai`
- [ ] Import `useState`, `useEffect` from `react`
- [ ] Import conversion functions from `@/lib/types/chat`
- [ ] Import `messagesAtom` from `@/atoms/workspace`
- [ ] Import `Session` type
- [ ] Import `Message` type
- [ ] Import `getWorkspaceMessagesAction`
- [ ] Import `useFeatureFlag`

#### Define Hook Interface
- [ ] Define `UseAIChatOptions` interface
- [ ] Define `UseAIChatReturn` interface

**Checkpoint:** Hook structure set up ✓

**Commit:** `feat(chat): create useAIChat hook structure`

---

### 2.2: Implement Feature Flag Check (15 minutes)

#### Add Feature Flag Logic
- [ ] Check feature flag using `useFeatureFlag('ENABLE_AI_SDK_CHAT')`
- [ ] Return early with old implementation if flag disabled
  ```typescript
  if (!enableAISDKChat) {
    // Return old implementation or throw error
    // (Old implementation will be in ChatContainer)
  }
  ```

**Checkpoint:** Feature flag check working ✓

**Commit:** `feat(chat): add feature flag check to useAIChat`

---

### 2.3: Implement Initial Messages Loading (45 minutes)

#### Load Historical Messages
- [ ] Add state for loaded messages
  ```typescript
  const [loadedMessages, setLoadedMessages] = useState<Message[]>(initialMessages || []);
  ```
- [ ] Add effect to load messages if not provided
  ```typescript
  useEffect(() => {
    if (!initialMessages && enableAISDKChat) {
      getWorkspaceMessagesAction(session, workspaceId)
        .then(setLoadedMessages)
        .catch(console.error);
    }
  }, [workspaceId, session, initialMessages, enableAISDKChat]);
  ```
- [ ] Convert loaded messages to AI SDK format
  ```typescript
  const initialAIMessages = messagesToAIMessages(loadedMessages);
  ```

#### Test Loading
- [ ] Test case 1: Initial messages provided
  - Expected: Uses provided messages
  - Actual: [Record result]
- [ ] Test case 2: No initial messages
  - Expected: Loads from server action
  - Actual: [Record result]
- [ ] Test case 3: Empty history
  - Expected: Empty array, no errors
  - Actual: [Record result]

**Checkpoint:** Initial messages loading working ✓

**Commit:** `feat(chat): implement initial messages loading`

---

### 2.4: Configure useChat Hook (45 minutes)

#### Set Up useChat
- [ ] Configure `useChat` with `/api/chat` endpoint
  ```typescript
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
  });
  ```

#### Add Role State
- [ ] Add `selectedRole` state
  ```typescript
  const [selectedRole, setSelectedRole] = useState<'auto' | 'developer' | 'operator'>('auto');
  ```

#### Test Configuration
- [ ] Test case 1: Hook initializes correctly
  - Expected: No errors, initial messages loaded
  - Actual: [Record result]
- [ ] Test case 2: Role included in request body
  - Expected: Role sent to backend
  - Actual: [Record result]

**Checkpoint:** `useChat` configured ✓

**Commit:** `feat(chat): configure useChat hook`

---

### 2.5: Implement Message Conversion on Stream (1 hour)

#### Add Conversion Effect
- [ ] Add effect to convert AI SDK messages to our format
  ```typescript
  useEffect(() => {
    if (!enableAISDKChat) return;
    
    // Convert AI messages to Message format
    const convertedMessages: Message[] = [];
    let currentUserMessage: Message | null = null;
    
    for (const aiMessage of aiMessages) {
      if (aiMessage.role === 'user') {
        // Handle user message
        if (currentUserMessage) {
          convertedMessages.push(currentUserMessage);
        }
        currentUserMessage = aiMessageToMessage(aiMessage, {
          workspaceId,
          userId: session.user.id,
        });
      } else if (aiMessage.role === 'assistant') {
        // Handle assistant message
        if (currentUserMessage) {
          const assistantContent = extractContent(aiMessage.content);
          currentUserMessage.response = assistantContent;
          currentUserMessage.isComplete = !isLoading; // May still be streaming
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
  }, [aiMessages, workspaceId, session.user.id, enableAISDKChat, isLoading, setMessages]);
  ```

#### Handle Streaming State
- [ ] Update `isComplete` based on `isLoading` state
- [ ] Handle partial responses during streaming

#### Test Conversion
- [ ] Test case 1: Single user message
  - Expected: One message in atom
  - Actual: [Record result]
- [ ] Test case 2: User + assistant pair
  - Expected: One message with prompt and response
  - Actual: [Record result]
- [ ] Test case 3: Streaming update
  - Expected: Response updates incrementally
  - Actual: [Record result]

**Checkpoint:** Message conversion working ✓

**Commit:** `feat(chat): implement real-time message conversion`

---

### 2.6: Implement onFinish Handler (30 minutes)

#### Add onFinish Callback
- [ ] Add `onFinish` handler to `useChat` config
  ```typescript
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
  ```

#### Test onFinish
- [ ] Test case 1: Message finishes correctly
  - Expected: Message marked as complete
  - Actual: [Record result]
- [ ] Test case 2: Message updates atom
  - Expected: Atom updated with final message
  - Actual: [Record result]

**Checkpoint:** `onFinish` handler working ✓

**Commit:** `feat(chat): add onFinish handler for completed messages`

---

### 2.7: Implement Error Handling (30 minutes)

#### Add Error Handler
- [ ] Add `onError` handler to `useChat` config
  ```typescript
  onError: (error) => {
    console.error('Chat error:', error);
    // Handle error appropriately
    // Could set error state or show toast
  },
  ```

#### Handle Error State
- [ ] Expose `error` from hook return
- [ ] Test error scenarios
  - Network failure
  - Server error
  - Invalid response

**Checkpoint:** Error handling working ✓

**Commit:** `feat(chat): add error handling to useAIChat`

---

### 2.8: Wrap handleSubmit (15 minutes)

#### Create Wrapper Function
- [ ] Wrap `aiHandleSubmit` to include role
  ```typescript
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    aiHandleSubmit(e);
  };
  ```

#### Return from Hook
- [ ] Return `handleSubmit` in hook return object

**Checkpoint:** Submit handler working ✓

**Commit:** `feat(chat): wrap handleSubmit with role support`

---

## Phase 3: Jotai Integration (2-3 hours)

### 3.1: Verify Atom Structure (15 minutes)

#### Check Existing Atoms
- [ ] Review `messagesAtom` in `atoms/workspace.ts`
- [ ] Verify atom structure matches our needs
- [ ] Check for any conflicts with new implementation

**Checkpoint:** Atom structure verified ✓

**Commit:** `refactor(chat): verify atom structure`

---

### 3.2: Test Message Sync (45 minutes)

#### Verify Sync Works
- [ ] Test that messages sync to atom correctly
- [ ] Test that atom updates trigger re-renders
- [ ] Test that multiple components can read atom

#### Test Edge Cases
- [ ] Test case 1: Rapid message sending
  - Expected: All messages sync correctly
  - Actual: [Record result]
- [ ] Test case 2: Message updates during streaming
  - Expected: Atom updates incrementally
  - Actual: [Record result]
- [ ] Test case 3: Component unmounts during sync
  - Expected: No memory leaks
  - Actual: [Record result]

**Checkpoint:** Message sync working ✓

**Commit:** `feat(chat): verify message sync to atom`

---

### 3.3: Preserve Plans/Renders Integration (1 hour)

#### Verify Plans Still Work
- [ ] Test that `responsePlanId` is preserved in messages
- [ ] Test that plan updates via Centrifugo still work
- [ ] Test that plan references in messages work

#### Verify Renders Still Work
- [ ] Test that `responseRenderId` is preserved in messages
- [ ] Test that render updates via Centrifugo still work
- [ ] Test that render references in messages work

#### Test Hybrid System
- [ ] Test case 1: Chat via useChat, plans via Centrifugo
  - Expected: Both work independently
  - Actual: [Record result]
- [ ] Test case 2: No conflicts between systems
  - Expected: No race conditions
  - Actual: [Record result]

**Checkpoint:** Plans/renders integration preserved ✓

**Commit:** `feat(chat): preserve plans and renders integration`

---

### 3.4: Add Metadata Preservation (30 minutes)

#### Preserve Metadata Fields
- [ ] Ensure `responseRenderId` is preserved
- [ ] Ensure `responsePlanId` is preserved
- [ ] Ensure `responseRollbackToRevisionNumber` is preserved
- [ ] Ensure `planId` is preserved
- [ ] Ensure `revisionNumber` is preserved
- [ ] Ensure `isApplied`, `isApplying`, `isIgnored` are preserved
- [ ] Ensure `isCanceled` is preserved

#### Test Metadata
- [ ] Test case 1: Message with renderId
  - Expected: RenderId preserved in converted message
  - Actual: [Record result]
- [ ] Test case 2: Message with planId
  - Expected: PlanId preserved in converted message
  - Actual: [Record result]

**Checkpoint:** Metadata preservation working ✓

**Commit:** `feat(chat): preserve message metadata`

---

## Phase 4: Feature Flag Integration (1-2 hours)

### 4.1: Update Feature Flag Logic (30 minutes)

#### Verify Flag Works
- [ ] Test with flag enabled
  - Expected: New implementation active
  - Actual: [Record result]
- [ ] Test with flag disabled
  - Expected: Old implementation active (or error)
  - Actual: [Record result]

#### Add Flag Documentation
- [ ] Document flag usage in code comments
- [ ] Add flag to environment variable docs

**Checkpoint:** Feature flag working ✓

**Commit:** `feat(chat): verify feature flag integration`

---

### 4.2: Test Both Paths (1 hour)

#### Test New Implementation
- [ ] Test case 1: Send message with flag enabled
  - Expected: Uses useChat, streams correctly
  - Actual: [Record result]
- [ ] Test case 2: Receive response with flag enabled
  - Expected: Response streams, updates atom
  - Actual: [Record result]

#### Test Old Implementation
- [ ] Test case 1: Send message with flag disabled
  - Expected: Uses old implementation (if available)
  - Actual: [Record result]
- [ ] Test case 2: No regressions
  - Expected: Old path works as before
  - Actual: [Record result]

**Checkpoint:** Both paths working ✓

**Commit:** `test(chat): verify both feature flag paths`

---

## Testing Phase (2-3 hours)

### Unit Tests
- [ ] Test suite created for hook
- [ ] All conversion functions have tests
- [ ] Hook logic has tests (mocked useChat)
- [ ] Edge cases covered
- [ ] All tests passing
  ```bash
  npm test -- hooks/useAIChat
  ```

### Integration Tests
- [ ] Test scenario 1: End-to-end chat flow
  - [ ] Send message
  - [ ] Receive streaming response
  - [ ] Verify messages in atom
  - [ ] Verify UI updates
- [ ] Test scenario 2: Historical messages loading
  - [ ] Load workspace with history
  - [ ] Verify messages loaded correctly
  - [ ] Verify conversion correct
- [ ] Test scenario 3: Feature flag toggling
  - [ ] Toggle flag
  - [ ] Verify implementation switches
  - [ ] Verify no conflicts

### Manual Testing
- [ ] Happy path works
  - [ ] Send message
  - [ ] Receive response
  - [ ] Streaming smooth
  - [ ] Messages persist
- [ ] Error handling works
  - [ ] Network failure
  - [ ] Server error
  - [ ] Invalid response
- [ ] Performance acceptable
  - [ ] No lag
  - [ ] Smooth streaming
  - [ ] No memory leaks
- [ ] Plans/renders still work
  - [ ] Plans generate correctly
  - [ ] Renders work correctly
  - [ ] No conflicts

### Performance Testing
- [ ] Benchmark 1: Message conversion time
  - Target: <10ms per message
  - Actual: [Record result] ✓
- [ ] Benchmark 2: Hook initialization time
  - Target: <100ms
  - Actual: [Record result] ✓
- [ ] Benchmark 3: Memory usage
  - Target: No leaks over 100 messages
  - Actual: [Record result] ✓

---

## Bug Fixing (If needed)

### Bug #1: [Title]
- [ ] Reproduced
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Tested
- [ ] Documented in bug analysis doc

---

## Documentation Phase (1 hour)

- [ ] JSDoc comments added to hook
- [ ] JSDoc comments added to conversion functions
- [ ] README updated (if applicable)
- [ ] Code comments added for complex logic
- [ ] Type definitions documented

---

## Completion Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] Performance targets met
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Feature flag works correctly
- [ ] Plans/renders still work
- [ ] Ready for PR#7 (Chat UI Migration)

---

**Status:** Ready to start implementation! 🚀

