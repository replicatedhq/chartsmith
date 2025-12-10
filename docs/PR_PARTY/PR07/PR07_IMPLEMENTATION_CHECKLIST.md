# PR#7: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (~45 min)
- [ ] Verify PR#5 is complete (API route exists)
- [ ] Verify PR#6 is complete (useAIChat hook exists)
- [ ] Review useAIChat hook interface
  ```typescript
  // Check what useAIChat returns
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useAIChat(workspaceId, session, role?);
  ```
- [ ] Review ChatContainer.tsx current implementation
- [ ] Review ChatMessage.tsx current implementation
- [ ] Check feature flag is available (`isAISDKChatEnabled()`)
- [ ] Git branch created
  ```bash
  git checkout -b feat/ai-sdk-chat-ui
  ```

---

## Phase 1: Update ChatContainer.tsx (2-3 hours)

### 1.1: Import useAIChat Hook (5 minutes)

#### Add Imports
- [ ] Import `useAIChat` from `@/hooks/useAIChat`
  ```typescript
  import { useAIChat } from "@/hooks/useAIChat";
  ```
- [ ] Import feature flag utility if needed
  ```typescript
  import { isAISDKChatEnabled } from "@/lib/config/feature-flags";
  ```
- [ ] Keep existing imports (Jotai, actions, etc.)

**Checkpoint:** Imports added ✓

**Commit:** `feat(chat): add useAIChat imports to ChatContainer`

---

### 1.2: Replace State Management (30 minutes)

#### Remove Old State
- [ ] Remove `useState` for `chatInput`
  ```typescript
  // ❌ REMOVE THIS
  const [chatInput, setChatInput] = useState("");
  ```
- [ ] Keep `useAtom` for `messagesAtom` (needed for sync)
  ```typescript
  // ✅ KEEP THIS (for sync)
  const [messages, setMessages] = useAtom(messagesAtom);
  ```

#### Add useAIChat Hook
- [ ] Add `useAIChat` hook call
  ```typescript
  const {
    messages: aiSDKMessages,
    input: chatInput,
    handleInputChange,
    handleSubmit: handleSubmitChat,
    isLoading: isRendering,
    error,
  } = useAIChat(workspace.id, session, selectedRole);
  ```
- [ ] Handle case when workspace is null
  ```typescript
  const aiChatHook = workspace ? useAIChat(workspace.id, session, selectedRole) : null;
  ```

**Checkpoint:** Hook integrated ✓

**Commit:** `feat(chat): integrate useAIChat hook in ChatContainer`

---

### 1.3: Sync Hook State to Jotai Atoms (30 minutes)

#### Create Message Conversion Function
- [ ] Create helper function to convert AI SDK messages to Message[]
  ```typescript
  function convertAISDKMessageToMessage(aiSDKMessage: any, workspaceId: string): Message {
    return {
      id: aiSDKMessage.id,
      workspaceId: workspaceId,
      createdAt: aiSDKMessage.createdAt || new Date().toISOString(),
      sentBy: aiSDKMessage.role === 'user' ? 'user' : 'assistant',
      prompt: aiSDKMessage.role === 'user' ? aiSDKMessage.content : undefined,
      response: aiSDKMessage.role === 'assistant' ? aiSDKMessage.content : undefined,
      // Preserve other fields if available
    };
  }
  ```

#### Add Sync useEffect
- [ ] Add `useEffect` to sync messages when flag enabled
  ```typescript
  useEffect(() => {
    if (isAISDKChatEnabled() && aiChatHook?.messages && workspace) {
      const convertedMessages = aiChatHook.messages.map(msg => 
        convertAISDKMessageToMessage(msg, workspace.id)
      );
      setMessages(convertedMessages);
    }
  }, [aiChatHook?.messages, workspace?.id, setMessages]);
  ```

**Checkpoint:** State syncing works ✓

**Commit:** `feat(chat): sync useAIChat messages to Jotai atoms`

---

### 1.4: Update Form Handling (30 minutes)

#### Update Form Submit Handler
- [ ] Replace `handleSubmitChat` with hook's handler
  ```typescript
  // ❌ REMOVE OLD HANDLER
  const handleSubmitChat = async (e: React.FormEvent) => {
    // ... old implementation
  };

  // ✅ USE HOOK'S HANDLER
  const handleSubmitChat = aiChatHook?.handleSubmit || handleOldSubmitChat;
  ```

#### Update Textarea Props
- [ ] Update textarea `value` to use hook's `input`
  ```typescript
  <textarea
    value={isAISDKChatEnabled() ? (aiChatHook?.input || "") : chatInput}
    // ... other props
  />
  ```
- [ ] Update textarea `onChange` to use hook's `handleInputChange`
  ```typescript
  <textarea
    onChange={(e) => {
      if (isAISDKChatEnabled() && aiChatHook) {
        aiChatHook.handleInputChange(e);
      } else {
        setChatInput(e.target.value);
      }
    }}
    // ... other props
  />
  ```

#### Update Enter Key Handling
- [ ] Check if useChat handles Enter automatically
- [ ] If yes, remove custom Enter handler
- [ ] If no, keep Enter handler but use hook's submit

**Checkpoint:** Form handling updated ✓

**Commit:** `feat(chat): update ChatContainer form to use useAIChat handlers`

---

### 1.5: Update Role Selector (15 minutes)

#### Preserve Role Selector
- [ ] Keep role selector UI unchanged
- [ ] Keep `selectedRole` state (if hook doesn't support it)
- [ ] Pass `selectedRole` to `useAIChat` if supported
  ```typescript
  const aiChatHook = workspace ? useAIChat(
    workspace.id, 
    session, 
    selectedRole  // Pass role if hook supports it
  ) : null;
  ```
- [ ] If hook doesn't support role, pass role in submit handler
  ```typescript
  const handleSubmitWithRole = (e: React.FormEvent) => {
    // Wrap hook's handleSubmit to include role
    // Or modify useAIChat to accept role
  };
  ```

**Checkpoint:** Role selector works ✓

**Commit:** `feat(chat): preserve role selector with useAIChat`

---

### 1.6: Update Loading/Error States (20 minutes)

#### Update Loading State
- [ ] Replace `isRendering` check with hook's `isLoading`
  ```typescript
  const isRendering = isAISDKChatEnabled() 
    ? (aiChatHook?.isLoading || false)
    : isRenderingFromAtom;
  ```

#### Add Error Display
- [ ] Add error display if hook's `error` is set
  ```typescript
  {aiChatHook?.error && (
    <div className="text-red-500 text-sm p-2">
      Error: {aiChatHook.error.message}
    </div>
  )}
  ```

#### Update Disabled States
- [ ] Update textarea disabled prop
  ```typescript
  <textarea
    disabled={isRendering}
    // ... other props
  />
  ```
- [ ] Update submit button disabled prop
  ```typescript
  <button
    type="submit"
    disabled={isRendering}
    // ... other props
  >
    {isRendering ? <Loader2 className="animate-spin" /> : <Send />}
  </button>
  ```

**Checkpoint:** Loading/error states work ✓

**Commit:** `feat(chat): update loading and error states in ChatContainer`

---

### 1.7: Handle New Chart Flow (15 minutes)

#### Update NewChartContent Handler
- [ ] Keep NewChartContent rendering logic
- [ ] Update `handleNewChartSubmitChat` to use hook
  ```typescript
  const handleNewChartSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAISDKChatEnabled() && aiChatHook) {
      // Use hook's handleSubmit with "auto" role
      aiChatHook.handleSubmit(e);
    } else {
      // Old implementation
      // ...
    }
  };
  ```
- [ ] Ensure role is always "auto" for new charts
- [ ] Pass hook's input/handlers to NewChartContent

**Checkpoint:** New chart flow works ✓

**Commit:** `feat(chat): update new chart flow to use useAIChat`

---

### 1.8: Testing ChatContainer (30 minutes)

#### Manual Testing
- [ ] Test chat input works
  - Type message
  - Verify input updates
- [ ] Test messages appear correctly
  - Send message
  - Verify message appears in list
- [ ] Test streaming text renders
  - Send message
  - Verify response streams in
- [ ] Test role selector works
  - Change role
  - Send message
  - Verify role is used
- [ ] Test Enter key submission
  - Type message
  - Press Enter
  - Verify message sends
- [ ] Test disabled state during streaming
  - Send message
  - Verify input/button disabled
  - Verify re-enabled after response
- [ ] Test error handling
  - Simulate error (disconnect network?)
  - Verify error displays
- [ ] Test feature flag toggle
  - Disable flag, test old implementation
  - Enable flag, test new implementation

**Checkpoint:** ChatContainer working ✓

**Commit:** `test(chat): verify ChatContainer with useAIChat`

---

## Phase 2: Update ChatMessage.tsx (1-2 hours)

### 2.1: Verify Message Format (15 minutes)

#### Check Message Structure
- [ ] Confirm messages from hook match `Message` type
  ```typescript
  // Check message structure
  console.log('Message from hook:', message);
  ```
- [ ] Verify message has required fields
  - `id`
  - `prompt` (for user messages)
  - `response` (for assistant messages)
  - `createdAt`
- [ ] Check streaming text updates
  - Verify `message.response` updates incrementally
  - Check if updates trigger re-renders

**Checkpoint:** Message format verified ✓

**Commit:** `feat(chat): verify AI SDK message format in ChatMessage`

---

### 2.2: Update Streaming Text Rendering (20 minutes)

#### Verify Streaming Updates
- [ ] Ensure `message.response` contains streaming text
  ```typescript
  // In ChatMessage component
  const responseText = message?.response || "";
  // Should update incrementally during streaming
  ```
- [ ] Verify markdown rendering works with streaming text
  ```typescript
  <ReactMarkdown>{message?.response || ""}</ReactMarkdown>
  ```
- [ ] Test incremental text updates
  - Send message
  - Watch response appear token by token
  - Verify no flicker or jank

**Checkpoint:** Streaming text renders correctly ✓

**Commit:** `feat(chat): update ChatMessage streaming text rendering`

---

### 2.3: Preserve Existing Features (30 minutes)

#### Keep Plan References
- [ ] Verify PlanChatMessage still works
  ```typescript
  {message?.responsePlanId && (
    <PlanChatMessage
      planId={message.responsePlanId}
      // ... props
    />
  )}
  ```

#### Keep Render References
- [ ] Verify render references still work
  ```typescript
  {message?.responseRenderId && (
    // Render component
  )}
  ```

#### Keep Conversion Progress
- [ ] Verify conversion progress displays
  ```typescript
  {message?.responseConversionId && (
    <ConversionProgress
      conversionId={message.responseConversionId}
      // ... props
    />
  )}
  ```

#### Keep Rollback Functionality
- [ ] Verify rollback modal works
- [ ] Test rollback button

#### Keep Feedback Modal
- [ ] Verify feedback modal works
- [ ] Test feedback button

#### Keep Follow-up Chat Input
- [ ] Verify follow-up input works
- [ ] Test follow-up submission

**Checkpoint:** All features preserved ✓

**Commit:** `feat(chat): preserve existing ChatMessage features`

---

### 2.4: Handle Edge Cases (15 minutes)

#### Empty Messages
- [ ] Handle messages without content
  ```typescript
  if (!message) return null;
  ```

#### Loading State
- [ ] Handle messages without responses (loading)
  ```typescript
  {!message.response && message.sentBy === 'assistant' && (
    <LoadingSpinner message="Thinking..." />
  )}
  ```

#### Error Messages
- [ ] Handle error messages
  ```typescript
  {message.error && (
    <div className="text-red-500">Error: {message.error}</div>
  )}
  ```

#### Canceled Messages
- [ ] Handle canceled messages
  ```typescript
  {message.isCanceled && (
    <div className="text-gray-500">Message canceled</div>
  )}
  ```

**Checkpoint:** Edge cases handled ✓

**Commit:** `feat(chat): handle edge cases in ChatMessage`

---

### 2.5: Testing ChatMessage (20 minutes)

#### Manual Testing
- [ ] Test message rendering
  - User messages display correctly
  - Assistant messages display correctly
- [ ] Test streaming text display
  - Verify text appears incrementally
  - Verify markdown renders correctly
- [ ] Test markdown rendering
  - Code blocks
  - Lists
  - Links
  - Bold/italic
- [ ] Test plan references
  - Verify plan displays
  - Test plan actions
- [ ] Test render references
  - Verify render displays
  - Test render actions
- [ ] Test all interactive elements
  - Feedback button
  - Rollback button
  - Follow-up input

**Checkpoint:** ChatMessage working ✓

**Commit:** `test(chat): verify ChatMessage with AI SDK messages`

---

## Phase 3: Integration Testing (1 hour)

### 3.1: End-to-End Chat Flow (20 minutes)

#### Full Chat Test
- [ ] Send message via ChatContainer
  - Type message
  - Click send or press Enter
- [ ] Verify message appears in list
  - Check message appears immediately
  - Verify message structure correct
- [ ] Verify streaming response appears
  - Watch response stream in
  - Verify text updates incrementally
- [ ] Verify message saves to database
  - Refresh page
  - Verify message persists
- [ ] Verify message history loads correctly
  - Open workspace
  - Verify previous messages load

**Checkpoint:** End-to-end flow works ✓

**Commit:** `test(chat): verify end-to-end chat flow`

---

### 3.2: Feature Flag Testing (15 minutes)

#### Test Old Implementation
- [ ] Set flag to disabled
  ```bash
  # In .env.local
  NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false
  ```
- [ ] Restart dev server
- [ ] Test chat functionality
  - Send message
  - Verify old implementation works
  - Verify Centrifugo still used

#### Test New Implementation
- [ ] Set flag to enabled
  ```bash
  # In .env.local
  NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true
  ```
- [ ] Restart dev server
- [ ] Test chat functionality
  - Send message
  - Verify new implementation works
  - Verify useChat used

#### Verify Both Paths Identical
- [ ] Compare UI/UX
  - Should look identical
  - Should behave identically
- [ ] Compare functionality
  - Same features work
  - Same edge cases handled

**Checkpoint:** Feature flag works ✓

**Commit:** `test(chat): verify feature flag toggles correctly`

---

### 3.3: Cross-Component Integration (15 minutes)

#### Test Plan Integration
- [ ] Test with PlanChatMessage
  - Generate plan
  - Verify plan displays
  - Test plan actions

#### Test Render Integration
- [ ] Test with render components
  - Generate render
  - Verify render displays
  - Test render actions

#### Test Conversion Integration
- [ ] Test with conversion components
  - Start conversion
  - Verify progress displays
  - Test conversion actions

#### Verify No Regressions
- [ ] Check all existing features
- [ ] Verify no broken functionality
- [ ] Check console for errors

**Checkpoint:** Cross-component integration works ✓

**Commit:** `test(chat): verify cross-component integration`

---

### 3.4: Performance Testing (10 minutes)

#### Measure Performance
- [ ] Measure time-to-first-token
  - Send message
  - Time until first token appears
  - Compare to old implementation
- [ ] Verify streaming smoothness
  - Watch streaming
  - Check for jank or flicker
  - Verify smooth updates
- [ ] Check for memory leaks
  - Send many messages
  - Check memory usage
  - Verify no leaks
- [ ] Verify no console errors
  - Open console
  - Send messages
  - Verify no errors

**Checkpoint:** Performance acceptable ✓

**Commit:** `test(chat): verify performance metrics`

---

## Documentation Phase (30 minutes)

- [ ] Add JSDoc comments to new functions
- [ ] Update component prop documentation
- [ ] Add inline comments for complex logic
- [ ] Document message format conversion
- [ ] Document state syncing approach

**Commit:** `docs(chat): add documentation for AI SDK migration`

---

## Pre-Completion Checklist

### Code Complete
- [ ] All checklist items marked complete
- [ ] ChatContainer uses useAIChat when flag enabled
- [ ] ChatMessage renders AI SDK messages correctly
- [ ] All existing features work
- [ ] Feature flag toggles correctly

### Testing Complete
- [ ] Unit tests pass (if any)
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] Feature flag testing complete
- [ ] Performance testing complete
- [ ] No console errors

### Documentation Complete
- [ ] Code comments added
- [ ] JSDoc comments added
- [ ] Inline documentation added

---

## Completion Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] Performance targets met
- [ ] No visual regressions
- [ ] No functional regressions
- [ ] Feature flag works correctly
- [ ] Documentation complete
- [ ] Code reviewed (self-review)
- [ ] Ready for PR submission

**Status:** Ready for review! 🎉

