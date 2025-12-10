# PR#7: Testing Guide

---

## Test Categories

### 1. Unit Tests

**Component: ChatContainer**

**Test 1.1: useAIChat Hook Integration**
- [ ] Hook is called with correct parameters
  - Input: `workspace.id`, `session`, `selectedRole`
  - Expected: Hook returns messages, input, handlers
  - Actual: [Record result]

**Test 1.2: State Syncing**
- [ ] Messages from hook sync to Jotai atoms
  - Input: AI SDK messages from hook
  - Expected: Messages appear in messagesAtom
  - Actual: [Record result]

**Test 1.3: Form Handling**
- [ ] Form submit uses hook's handleSubmit
  - Input: Form submission event
  - Expected: Hook's handleSubmit called
  - Actual: [Record result]

**Test 1.4: Input Handling**
- [ ] Textarea value uses hook's input
  - Input: User types in textarea
  - Expected: Hook's input updates
  - Actual: [Record result]

**Test 1.5: Loading State**
- [ ] Loading state uses hook's isLoading
  - Input: Hook returns isLoading=true
  - Expected: Input/button disabled
  - Actual: [Record result]

**Test 1.6: Error Handling**
- [ ] Error from hook displays correctly
  - Input: Hook returns error
  - Expected: Error message displayed
  - Actual: [Record result]

**Test 1.7: Role Selector**
- [ ] Role selector works with hook
  - Input: User selects role
  - Expected: Role passed to hook
  - Actual: [Record result]

**Test 1.8: New Chart Flow**
- [ ] New chart flow uses hook
  - Input: Workspace with revision 0
  - Expected: NewChartContent uses hook
  - Actual: [Record result]

---

**Component: ChatMessage**

**Test 2.1: Message Rendering**
- [ ] Message renders correctly
  - Input: Message from hook
  - Expected: Message displays with correct content
  - Actual: [Record result]

**Test 2.2: Streaming Text**
- [ ] Streaming text updates incrementally
  - Input: Message with streaming response
  - Expected: Text appears token by token
  - Actual: [Record result]

**Test 2.3: Markdown Rendering**
- [ ] Markdown renders correctly
  - Input: Message with markdown content
  - Expected: Markdown formatted correctly
  - Actual: [Record result]

**Test 2.4: Plan References**
- [ ] Plan references display correctly
  - Input: Message with responsePlanId
  - Expected: PlanChatMessage component renders
  - Actual: [Record result]

**Test 2.5: Render References**
- [ ] Render references display correctly
  - Input: Message with responseRenderId
  - Expected: Render component displays
  - Actual: [Record result]

**Test 2.6: Conversion Progress**
- [ ] Conversion progress displays correctly
  - Input: Message with responseConversionId
  - Expected: ConversionProgress component renders
  - Actual: [Record result]

**Test 2.7: Edge Cases**
- [ ] Empty messages handled
  - Input: Message without content
  - Expected: Component handles gracefully
  - Actual: [Record result]

- [ ] Loading state handled
  - Input: Message without response
  - Expected: Loading spinner displays
  - Actual: [Record result]

- [ ] Error messages handled
  - Input: Message with error
  - Expected: Error message displays
  - Actual: [Record result]

- [ ] Canceled messages handled
  - Input: Message with isCanceled=true
  - Expected: Canceled state displays
  - Actual: [Record result]

---

### 2. Integration Tests

**Scenario 1: End-to-End Chat Flow**

**Step 1: Send Message**
- [ ] User types message in ChatContainer
  - Input: "Hello, how are you?"
  - Expected: Message appears in input field
  - Actual: [Record result]

**Step 2: Submit Message**
- [ ] User clicks send or presses Enter
  - Input: Submit action
  - Expected: Message sent to backend
  - Actual: [Record result]

**Step 3: Message Appears in List**
- [ ] Message appears in message list
  - Input: Message sent
  - Expected: Message appears immediately
  - Actual: [Record result]

**Step 4: Streaming Response**
- [ ] Response streams in
  - Input: Backend starts streaming
  - Expected: Text appears incrementally
  - Actual: [Record result]

**Step 5: Message Saves**
- [ ] Message saves to database
  - Input: Response completes
  - Expected: Message persists in database
  - Actual: [Record result]

**Step 6: Message History**
- [ ] Message history loads correctly
  - Input: Page refresh
  - Expected: Previous messages load
  - Actual: [Record result]

---

**Scenario 2: Role Selector Flow**

**Step 1: Select Role**
- [ ] User selects role from dropdown
  - Input: Select "Chart Developer"
  - Expected: Role updates
  - Actual: [Record result]

**Step 2: Send Message with Role**
- [ ] User sends message with selected role
  - Input: Message + role
  - Expected: Role sent to backend
  - Actual: [Record result]

**Step 3: Verify Role Used**
- [ ] Backend uses correct role
  - Input: Message sent
  - Expected: Backend receives role
  - Actual: [Record result]

---

**Scenario 3: Streaming Text Flow**

**Step 1: Start Streaming**
- [ ] Backend starts streaming response
  - Input: Message sent
  - Expected: First token appears
  - Actual: [Record result]

**Step 2: Incremental Updates**
- [ ] Text updates incrementally
  - Input: Streaming continues
  - Expected: Text grows token by token
  - Actual: [Record result]

**Step 3: Markdown Renders**
- [ ] Markdown renders correctly during streaming
  - Input: Markdown content streams
  - Expected: Markdown formatted correctly
  - Actual: [Record result]

**Step 4: Streaming Completes**
- [ ] Streaming completes
  - Input: Backend finishes
  - Expected: Full response displayed
  - Actual: [Record result]

---

**Scenario 4: Feature Flag Toggle**

**Step 1: Test Old Implementation**
- [ ] Flag disabled, test old implementation
  - Input: Flag = false
  - Expected: Centrifugo used, old code path
  - Actual: [Record result]

**Step 2: Test New Implementation**
- [ ] Flag enabled, test new implementation
  - Input: Flag = true
  - Expected: useChat used, new code path
  - Actual: [Record result]

**Step 3: Verify Both Identical**
- [ ] Both implementations produce same result
  - Input: Same message sent
  - Expected: Same UI/UX, same functionality
  - Actual: [Record result]

---

### 3. Edge Cases

**Edge Case 1: Empty Input**
- [ ] Submit with empty input
  - Input: Empty string
  - Expected: No message sent
  - Actual: [Record result]

**Edge Case 2: Very Long Messages**
- [ ] Send very long message
  - Input: 10,000 character message
  - Expected: Message sends and displays correctly
  - Actual: [Record result]

**Edge Case 3: Rapid Message Sending**
- [ ] Send multiple messages quickly
  - Input: 5 messages in quick succession
  - Expected: All messages process correctly
  - Actual: [Record result]

**Edge Case 4: Network Errors**
- [ ] Network error during streaming
  - Input: Disconnect network mid-stream
  - Expected: Error handled gracefully
  - Actual: [Record result]

**Edge Case 5: Stream Cancellation**
- [ ] Cancel stream mid-way
  - Input: Cancel button clicked
  - Expected: Stream stops, message marked canceled
  - Actual: [Record result]

**Edge Case 6: Multiple Concurrent Chats**
- [ ] Multiple workspaces open
  - Input: Chat in workspace A, then workspace B
  - Expected: Each chat works independently
  - Actual: [Record result]

**Edge Case 7: Role Switching During Chat**
- [ ] Change role mid-conversation
  - Input: Send message with role A, change to role B
  - Expected: New messages use new role
  - Actual: [Record result]

---

### 4. Performance Tests

**Benchmark 1: Time-to-First-Token**
- [ ] Measure time until first token appears
  - Input: Send message
  - Expected: < 2 seconds (same or better than current)
  - Actual: [Record time]

**Benchmark 2: Streaming Smoothness**
- [ ] Verify no jank or flicker
  - Input: Watch streaming response
  - Expected: Smooth updates, no jank
  - Actual: [Record observation]

**Benchmark 3: Memory Usage**
- [ ] Check for memory leaks
  - Input: Send 50 messages
  - Expected: Memory usage stable
  - Actual: [Record memory usage]

**Benchmark 4: Bundle Size**
- [ ] Check bundle size impact
  - Input: Build production bundle
  - Expected: Same or smaller than before
  - Actual: [Record size]

---

### 5. Visual Regression Tests

**Visual Test 1: ChatContainer Layout**
- [ ] Layout looks identical to before
  - Input: View ChatContainer
  - Expected: Same layout, spacing, colors
  - Actual: [Record observation]

**Visual Test 2: ChatMessage Layout**
- [ ] Message layout looks identical
  - Input: View ChatMessage
  - Expected: Same layout, spacing, colors
  - Actual: [Record observation]

**Visual Test 3: Streaming Text**
- [ ] Streaming text renders smoothly
  - Input: Watch streaming response
  - Expected: Smooth text appearance, no flicker
  - Actual: [Record observation]

**Visual Test 4: Loading States**
- [ ] Loading states display correctly
  - Input: Send message, watch loading
  - Expected: Spinner/loading indicator shows
  - Actual: [Record observation]

**Visual Test 5: Error States**
- [ ] Error states display correctly
  - Input: Trigger error
  - Expected: Error message displays
  - Actual: [Record observation]

---

### 6. Cross-Component Integration Tests

**Integration Test 1: PlanChatMessage**
- [ ] Plan references work with new implementation
  - Input: Message with plan
  - Expected: PlanChatMessage displays correctly
  - Actual: [Record result]

**Integration Test 2: Render Components**
- [ ] Render references work with new implementation
  - Input: Message with render
  - Expected: Render component displays correctly
  - Actual: [Record result]

**Integration Test 3: Conversion Components**
- [ ] Conversion progress works with new implementation
  - Input: Message with conversion
  - Expected: ConversionProgress displays correctly
  - Actual: [Record result]

**Integration Test 4: ScrollingContent**
- [ ] Scrolling works with new messages
  - Input: New message appears
  - Expected: Scrolls to new message
  - Actual: [Record result]

---

## Acceptance Criteria

**Feature is complete when:**

### Functional Criteria
- [ ] ChatContainer uses useAIChat hook when flag enabled
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

### Quality Criteria
- [ ] All tests pass
- [ ] No console errors
- [ ] No visual regressions
- [ ] No functional regressions
- [ ] Performance same or better
- [ ] Memory usage stable
- [ ] Bundle size same or smaller

### Documentation Criteria
- [ ] Code comments added
- [ ] JSDoc comments added
- [ ] Inline documentation added
- [ ] Message format conversion documented

---

## Test Execution Plan

### Phase 1: Unit Testing (During Implementation)
- Run tests after each component update
- Verify individual pieces work before integration
- Fix issues immediately

### Phase 2: Integration Testing (After Implementation)
- Run full end-to-end tests
- Test all scenarios
- Verify feature flag works

### Phase 3: Performance Testing (Before Completion)
- Measure performance metrics
- Compare to baseline
- Verify no regressions

### Phase 4: Visual Testing (Before Completion)
- Visual inspection of UI
- Compare to before migration
- Verify no visual regressions

---

## Test Data

### Test Messages

**Short Message:**
```
"Hello"
```

**Medium Message:**
```
"Can you help me create a Helm chart for a simple web application?"
```

**Long Message:**
```
[1000+ character message about complex chart requirements]
```

**Message with Markdown:**
```
"Here's a code example:

\`\`\`yaml
apiVersion: v1
kind: Service
\`\`\`
"

**Message with Special Characters:**
```
"Test message with émojis 🚀 and spéciál chàracters"
```

---

## Bug Reporting Template

**If you find a bug during testing:**

1. **Description:** [What happened]
2. **Steps to Reproduce:**
   - Step 1: [Action]
   - Step 2: [Action]
   - Step 3: [Action]
3. **Expected:** [What should happen]
4. **Actual:** [What actually happened]
5. **Environment:**
   - Feature flag: [enabled/disabled]
   - Browser: [Browser version]
   - OS: [OS version]
6. **Screenshots:** [If applicable]
7. **Console Errors:** [If any]

---

## Success Metrics

**Testing is successful when:**

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All edge cases handled
- [ ] Performance targets met
- [ ] No visual regressions
- [ ] No functional regressions
- [ ] Feature flag works correctly
- [ ] Documentation complete

---

**Remember:** Test thoroughly, but don't let perfect be the enemy of good. Focus on the critical paths first, then expand to edge cases.

