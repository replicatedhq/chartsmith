# PR#7: Chat UI Component Migration

**Estimated Time:** 4-6 hours  
**Complexity:** MEDIUM  
**Dependencies:** PR#5 (Next.js API Route Proxy), PR#6 (useChat Hook Implementation)  
**Parallel With:** None (depends on PR#5 and PR#6)  
**Success Criteria:** G1 (Replace custom chat UI with Vercel AI SDK), G3 (Maintain all existing chat functionality)

---

## Overview

### What We're Building

This PR migrates the chat UI components (`ChatContainer.tsx` and `ChatMessage.tsx`) to use the new Vercel AI SDK `useChat` hook implementation. This is the final frontend integration step that connects the UI layer to the new streaming infrastructure built in PR#5 and PR#6.

**Key Changes:**
1. **ChatContainer.tsx** - Replace custom state management with `useAIChat` hook
2. **ChatMessage.tsx** - Update to render AI SDK message format
3. **Preserve all existing UI/UX** - No visual changes, only internal implementation
4. **Feature flag controlled** - Can toggle between old and new implementations

### Why It Matters

This PR completes the frontend migration to Vercel AI SDK. By updating the UI components:
- Users get improved streaming experience with AI SDK optimizations
- Code becomes more maintainable with standard patterns
- Foundation is laid for easy provider switching
- State management is simplified (less custom Jotai atoms)

### Success in One Sentence

"This PR is successful when `ChatContainer` and `ChatMessage` use the new `useAIChat` hook, all existing functionality works identically, and the feature flag can toggle between implementations."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Gradual Component Migration
**Options Considered:**
1. Migrate both components simultaneously - Faster, but harder to debug
2. Migrate ChatContainer first, then ChatMessage - Clearer separation, easier testing
3. Migrate ChatMessage first, then ChatContainer - Less logical flow

**Chosen:** Migrate ChatContainer first, then ChatMessage

**Rationale:**
- ChatContainer controls the input and message list, so it's the natural starting point
- ChatMessage depends on message format, which comes from ChatContainer
- Easier to test ChatContainer changes independently
- Can verify message flow before updating rendering

**Trade-offs:**
- Gain: Clearer testing path, easier debugging
- Lose: Slightly more commits (acceptable)

#### Decision 2: Message Format Adapter Strategy
**Options Considered:**
1. Convert AI SDK messages to existing Message type - Preserves compatibility
2. Use AI SDK messages directly - Cleaner, but requires more changes
3. Hybrid adapter - Convert for display, keep AI SDK format internally

**Chosen:** Convert AI SDK messages to existing Message type

**Rationale:**
- Preserves compatibility with existing code (PlanChatMessage, render references, etc.)
- Minimal changes to ChatMessage component
- Existing database schema doesn't need changes
- Can migrate message format separately if needed

**Trade-offs:**
- Gain: Minimal disruption, easier migration
- Lose: Temporary adapter layer (can be removed later)

#### Decision 3: State Management Approach
**Options Considered:**
1. Use `useChat` state exclusively - Cleanest, but breaks existing patterns
2. Sync `useChat` state to Jotai atoms - Maintains compatibility
3. Hybrid - Use `useChat` for chat, keep Jotai for workspace state

**Chosen:** Sync `useChat` state to Jotai atoms (temporary)

**Rationale:**
- Other components (PlanChatMessage, render components) depend on Jotai atoms
- Maintains backward compatibility during migration
- Can remove sync layer in cleanup PR (PR#9)
- Feature flag allows easy rollback

**Trade-offs:**
- Gain: Compatibility, easier migration
- Lose: Temporary dual state (acceptable for migration)

#### Decision 4: Feature Flag Placement
**Options Considered:**
1. Feature flag in ChatContainer only - Simpler, but ChatMessage needs to know
2. Feature flag in both components - More explicit, clearer intent
3. Feature flag in useAIChat hook - Centralized, but components need to check

**Chosen:** Feature flag in useAIChat hook (already implemented in PR#6)

**Rationale:**
- Centralized control point
- Components don't need to know about flag
- Hook handles routing to old/new implementation
- Consistent with PR#6 design

**Trade-offs:**
- Gain: Centralized control, cleaner components
- Lose: Components depend on hook behavior (acceptable)

### Data Model

**No database changes** - This PR only affects frontend component implementation.

**Message Format:**
- AI SDK messages are converted to existing `Message` type
- Existing `workspace_chat` schema unchanged
- Message IDs, timestamps, and metadata preserved

### API Design

**No API changes** - This PR uses the `/api/chat` endpoint created in PR#5.

**Component Interface:**
```typescript
// ChatContainer uses useAIChat hook
const {
  messages,        // AI SDK messages (converted to Message[])
  input,           // Current input value
  handleInputChange,
  handleSubmit,    // Submit handler
  isLoading,       // Streaming state
  error,           // Error state
} = useAIChat(workspaceId, session);

// ChatMessage receives Message type (unchanged interface)
<ChatMessage
  messageId={message.id}
  session={session}
  onContentUpdate={handleUpdate}
/>
```

### Component Hierarchy

```
BEFORE:
ChatContainer.tsx
├── Uses custom state (useState, useAtom)
├── Uses createChatMessageAction
├── Manages chatInput state
└── Renders ChatMessage components

AFTER (when flag enabled):
ChatContainer.tsx
├── Uses useAIChat hook
│   └── useAIChat.ts (from PR#6)
│       ├── Feature flag check
│       ├── Old: Custom Centrifugo logic
│       └── New: useChat from @ai-sdk/react
├── Syncs useChat state to Jotai atoms (temporary)
├── Uses hook's input/handleSubmit
└── Renders ChatMessage components

ChatMessage.tsx
├── Receives Message type (unchanged)
├── Renders streaming text from message.response
├── Handles plan/render references (unchanged)
└── UI/UX identical to before
```

---

## Implementation Details

### File Structure

**Modified Files:**
```
chartsmith-app/
├── components/
│   ├── ChatContainer.tsx (~220 lines, +50/-80 lines)
│   └── ChatMessage.tsx (~400 lines, +20/-30 lines)
└── hooks/
    └── useAIChat.ts (from PR#6, may need minor updates)
```

**No New Files** - This PR modifies existing components only.

### Key Implementation Steps

#### Phase 1: Update ChatContainer.tsx (2-3 hours)

**Step 1.1: Import useAIChat Hook**
- [ ] Import `useAIChat` from `@/hooks/useAIChat`
- [ ] Import feature flag utility if needed
- [ ] Keep existing imports for now (Jotai atoms, actions)

**Step 1.2: Replace State Management**
- [ ] Remove `useState` for `chatInput`
- [ ] Remove `useAtom` for `messagesAtom` (keep for sync)
- [ ] Add `useAIChat` hook call
- [ ] Extract `input`, `handleInputChange`, `handleSubmit`, `isLoading`, `error` from hook

**Step 1.3: Sync Hook State to Jotai Atoms**
- [ ] Create `useEffect` to sync `messages` from hook to `messagesAtom`
- [ ] Sync happens only when feature flag enabled
- [ ] Preserve message IDs and metadata during sync

**Step 1.4: Update Form Handling**
- [ ] Replace `handleSubmitChat` with hook's `handleSubmit`
- [ ] Update form `onSubmit` to use hook handler
- [ ] Update textarea `value` and `onChange` to use hook's `input` and `handleInputChange`
- [ ] Preserve Enter key handling (hook should handle this)

**Step 1.5: Update Role Selector**
- [ ] Keep role selector functionality unchanged
- [ ] Pass `selectedRole` to `useAIChat` hook (if hook supports it)
- [ ] If hook doesn't support role, keep role in local state and pass to submit

**Step 1.6: Update Loading/Error States**
- [ ] Replace `isRendering` check with hook's `isLoading`
- [ ] Add error display if hook's `error` is set
- [ ] Preserve disabled state during streaming

**Step 1.7: Handle New Chart Flow**
- [ ] Keep NewChartContent rendering logic
- [ ] Update `handleNewChartSubmitChat` to use hook
- [ ] Ensure role is always "auto" for new charts

**Step 1.8: Testing**
- [ ] Test chat input works
- [ ] Test messages appear correctly
- [ ] Test streaming text renders
- [ ] Test role selector works
- [ ] Test Enter key submission
- [ ] Test disabled state during streaming
- [ ] Test error handling

**Commit:** `feat(chat): migrate ChatContainer to useAIChat hook`

---

#### Phase 2: Update ChatMessage.tsx (1-2 hours)

**Step 2.1: Verify Message Format**
- [ ] Confirm messages from hook match existing `Message` type
- [ ] Check message structure (id, prompt, response, etc.)
- [ ] Verify streaming text updates correctly

**Step 2.2: Update Streaming Text Rendering**
- [ ] Ensure `message.response` contains streaming text
- [ ] Verify markdown rendering works with streaming text
- [ ] Test incremental text updates

**Step 2.3: Preserve Existing Features**
- [ ] Keep plan reference rendering (PlanChatMessage)
- [ ] Keep render reference rendering
- [ ] Keep conversion progress display
- [ ] Keep rollback functionality
- [ ] Keep feedback modal
- [ ] Keep follow-up chat input

**Step 2.4: Handle Edge Cases**
- [ ] Empty messages
- [ ] Messages without responses (loading state)
- [ ] Error messages
- [ ] Canceled messages

**Step 2.5: Testing**
- [ ] Test message rendering
- [ ] Test streaming text display
- [ ] Test markdown rendering
- [ ] Test plan references
- [ ] Test render references
- [ ] Test all interactive elements

**Commit:** `feat(chat): update ChatMessage for AI SDK message format`

---

#### Phase 3: Integration Testing (1 hour)

**Step 3.1: End-to-End Chat Flow**
- [ ] Send message via ChatContainer
- [ ] Verify message appears in list
- [ ] Verify streaming response appears
- [ ] Verify message saves to database
- [ ] Verify message history loads correctly

**Step 3.2: Feature Flag Testing**
- [ ] Test with flag disabled (old implementation)
- [ ] Test with flag enabled (new implementation)
- [ ] Verify both paths work identically
- [ ] Test toggling flag (requires restart)

**Step 3.3: Cross-Component Integration**
- [ ] Test with PlanChatMessage (if applicable)
- [ ] Test with render components
- [ ] Test with conversion components
- [ ] Verify no regressions

**Step 3.4: Performance Testing**
- [ ] Measure time-to-first-token
- [ ] Verify streaming smoothness
- [ ] Check for memory leaks
- [ ] Verify no console errors

**Commit:** `test(chat): add integration tests for AI SDK migration`

---

### Code Examples

**Example 1: ChatContainer with useAIChat**

```typescript
// BEFORE (custom state management)
const [chatInput, setChatInput] = useState("");
const [messages, setMessages] = useAtom(messagesAtom);

const handleSubmitChat = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!chatInput.trim() || isRendering) return;
  const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim(), selectedRole);
  setMessages(prev => [...prev, chatMessage]);
  setChatInput("");
};

// AFTER (with useAIChat hook)
const {
  messages: aiSDKMessages,
  input: chatInput,
  handleInputChange,
  handleSubmit: handleSubmitChat,
  isLoading: isRendering,
  error,
} = useAIChat(workspace.id, session, selectedRole);

// Sync AI SDK messages to Jotai atoms (temporary)
useEffect(() => {
  if (isAISDKChatEnabled() && aiSDKMessages) {
    // Convert AI SDK messages to Message[] format
    const convertedMessages = aiSDKMessages.map(convertAISDKMessageToMessage);
    setMessages(convertedMessages);
  }
}, [aiSDKMessages, setMessages]);

// Form uses hook's handlers
<form onSubmit={handleSubmitChat}>
  <textarea
    value={chatInput}
    onChange={handleInputChange}
    // ... rest of props
  />
</form>
```

**Example 2: Message Format Conversion**

```typescript
// Helper function to convert AI SDK message to Message type
function convertAISDKMessageToMessage(aiSDKMessage: any): Message {
  return {
    id: aiSDKMessage.id,
    workspaceId: workspace.id,
    createdAt: aiSDKMessage.createdAt || new Date().toISOString(),
    sentBy: aiSDKMessage.role === 'user' ? 'user' : 'assistant',
    prompt: aiSDKMessage.role === 'user' ? aiSDKMessage.content : undefined,
    response: aiSDKMessage.role === 'assistant' ? aiSDKMessage.content : undefined,
    // ... preserve other fields from original message if available
  };
}
```

**Example 3: Error Handling**

```typescript
// Display error from hook
{error && (
  <div className="text-red-500 text-sm p-2">
    Error: {error.message}
  </div>
)}

// Disable input during loading
<textarea
  disabled={isRendering}
  // ... other props
/>

<button
  type="submit"
  disabled={isRendering}
  // ... other props
>
  {isRendering ? <Loader2 className="animate-spin" /> : <Send />}
</button>
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- ChatContainer renders correctly with useAIChat
- ChatMessage renders AI SDK messages correctly
- Message format conversion works
- State syncing works correctly

**Integration Tests:**
- End-to-end chat flow (send message, receive response)
- Streaming text updates incrementally
- Messages save to database
- Message history loads correctly

**Visual Regression Tests:**
- UI looks identical to before migration
- Streaming text renders smoothly
- Loading states display correctly
- Error states display correctly

**Feature Flag Tests:**
- Old implementation works with flag disabled
- New implementation works with flag enabled
- Both paths produce identical results

### Edge Cases

- Empty input submission
- Very long messages
- Rapid message sending
- Network errors during streaming
- Stream cancellation
- Multiple concurrent chats
- Role switching during chat

---

## Success Criteria

**Feature is complete when:**
- [ ] ChatContainer uses `useAIChat` hook when flag enabled
- [ ] ChatMessage renders AI SDK messages correctly
- [ ] All existing UI/UX preserved (no visual changes)
- [ ] Chat input works identically to before
- [ ] Streaming text renders smoothly
- [ ] Role selector continues to work
- [ ] Enter key submission works
- [ ] Disabled state during streaming works
- [ ] Error handling works
- [ ] Plan references work (if applicable)
- [ ] Render references work (if applicable)
- [ ] Feature flag toggles between implementations
- [ ] All tests pass
- [ ] No console errors
- [ ] Performance same or better

**Performance Targets:**
- Time-to-first-token: Same or better than current
- Streaming smoothness: No jank or flicker
- Memory usage: No leaks

**Quality Gates:**
- Zero visual regressions
- Zero functional regressions
- All existing features work
- Feature flag works correctly

---

## Risk Assessment

### Risk 1: Message Format Mismatch
**Likelihood:** Medium  
**Impact:** High  
**Mitigation:**
- Create comprehensive message conversion function
- Test conversion with various message types
- Keep adapter layer to handle differences
- Feature flag allows rollback

**Status:** 🟡 Documented

### Risk 2: State Sync Issues
**Likelihood:** Medium  
**Impact:** Medium  
**Mitigation:**
- Sync only when feature flag enabled
- Use `useEffect` with proper dependencies
- Test state syncing thoroughly
- Monitor for race conditions

**Status:** 🟡 Documented

### Risk 3: Streaming Text Rendering Issues
**Likelihood:** Low  
**Impact:** Medium  
**Mitigation:**
- Verify message.response updates incrementally
- Test markdown rendering with streaming text
- Ensure React re-renders on updates
- Test with various message lengths

**Status:** 🟢 Low Risk

### Risk 4: Role Selector Integration
**Likelihood:** Low  
**Impact:** Low  
**Mitigation:**
- Keep role in local state if hook doesn't support it
- Pass role to submit handler
- Test role switching during chat
- Verify role is sent to backend

**Status:** 🟢 Low Risk

### Risk 5: Feature Flag Complexity
**Likelihood:** Low  
**Impact:** Low  
**Mitigation:**
- Flag is handled in useAIChat hook (PR#6)
- Components don't need to check flag
- Test both paths thoroughly
- Document flag usage

**Status:** 🟢 Low Risk

---

## Open Questions

1. **Question:** Does `useAIChat` hook support role parameter?
   - **Answer Needed:** Check PR#6 implementation
   - **Decision Needed By:** Phase 1, Step 1.5

2. **Question:** How are errors handled in useChat hook?
   - **Answer Needed:** Review AI SDK documentation
   - **Decision Needed By:** Phase 1, Step 1.6

3. **Question:** Does useChat handle Enter key submission automatically?
   - **Answer Needed:** Review AI SDK documentation
   - **Decision Needed By:** Phase 1, Step 1.4

---

## Timeline

**Total Estimate:** 4-6 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Update ChatContainer.tsx | 2-3 h | ⏳ |
| 2 | Update ChatMessage.tsx | 1-2 h | ⏳ |
| 3 | Integration Testing | 1 h | ⏳ |

---

## Dependencies

**Requires:**
- [ ] PR#5 complete (Next.js API Route Proxy)
- [ ] PR#6 complete (useChat Hook Implementation)
- [ ] Feature flag infrastructure (from PR#1)

**Blocks:**
- PR#8 (Tool Call Protocol Support) - Needs chat UI working
- PR#9 (Remove Feature Flags) - Needs this migration complete

---

## References

- Related PR: PR#5 (API Route), PR#6 (useChat Hook)
- AI SDK Documentation: https://sdk.vercel.ai/docs
- useChat Hook Reference: https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
- PRD: `docs/PRD-vercel-ai-sdk-migration.md`
- Architecture: `docs/architecture-comparison.md`

