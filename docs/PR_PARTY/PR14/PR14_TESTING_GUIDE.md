# PR#14: Testing Guide

**Purpose:** Comprehensive testing strategy for removing Centrifugo chat handlers  
**Scope:** Frontend, extension, backend, integration, and regression testing  
**Time Estimate:** 2-3 hours

---

## Test Categories

### 1. Unit Tests

#### Frontend Unit Tests

**Test Suite: `useCentrifugo.test.ts`**

**Test 1.1: Chat Handler Removed**
- **Description:** Verify `handleChatMessageUpdated` is not exported or used
- **Setup:** Import `useCentrifugo` hook
- **Action:** Check hook exports
- **Expected:** No `handleChatMessageUpdated` function exported
- **Actual:** [Record result]

**Test 1.2: Event Router No Longer Handles Chat**
- **Description:** Verify `chatmessage-updated` case removed from event router
- **Setup:** Mock Centrifugo message with `chatmessage-updated` event
- **Action:** Call `handleCentrifugoMessage` with chat event
- **Expected:** Event ignored or not handled (no chat handler called)
- **Actual:** [Record result]

**Test 1.3: Other Events Still Handled**
- **Description:** Verify non-chat events still work
- **Setup:** Mock Centrifugo messages for plan-updated, render-stream, etc.
- **Action:** Call `handleCentrifugoMessage` with each event
- **Expected:** Each event handled correctly
- **Actual:** [Record result]

**Test 1.4: No Broken References**
- **Description:** Verify no broken references to removed handlers
- **Setup:** Import all chat-related modules
- **Action:** Check for undefined references
- **Expected:** No undefined references
- **Actual:** [Record result]

#### Backend Unit Tests

**Test Suite: `conversational_test.go`**

**Test 1.5: Centrifugo Streaming Removed**
- **Description:** Verify `ChatMessageUpdatedEvent` not sent
- **Setup:** Mock conversational handler
- **Action:** Process chat message
- **Expected:** No `realtime.SendEvent` call for chat
- **Actual:** [Record result]

**Test 1.6: Database Updates Still Happen**
- **Description:** Verify database updates still occur
- **Setup:** Mock database connection
- **Action:** Process chat message
- **Expected:** `workspace.AppendChatMessageResponse` called
- **Actual:** [Record result]

**Test 1.7: Render Job Creation Still Happens**
- **Description:** Verify render job created after chat
- **Setup:** Mock workspace and database
- **Action:** Complete chat message
- **Expected:** `workspace.EnqueueRenderWorkspaceForRevision` called
- **Actual:** [Record result]

**Test 1.8: Event Type Removed (if applicable)**
- **Description:** Verify `ChatMessageUpdatedEvent` type removed
- **Setup:** Try to import event type
- **Action:** Compile Go code
- **Expected:** Compilation error or type not found
- **Actual:** [Record result]

---

### 2. Integration Tests

#### Chat Flow Integration Test

**Test 2.1: End-to-End Chat Flow**
- **Description:** Send chat message and verify complete flow
- **Setup:** 
  - Start Go worker
  - Start Next.js dev server
  - Open browser
- **Steps:**
  1. Send chat message via UI
  2. Verify message appears in UI
  3. Verify response streams via AI SDK
  4. Verify message saved to database
  5. Verify render job created
- **Expected:** All steps complete successfully
- **Actual:** [Record result]

**Test 2.2: Chat History Loading**
- **Description:** Verify previous messages load correctly
- **Setup:** 
  - Database has previous chat messages
  - Open chat UI
- **Action:** Load chat history
- **Expected:** Previous messages display correctly
- **Actual:** [Record result]

**Test 2.3: Multiple Concurrent Chats**
- **Description:** Send multiple chat messages concurrently
- **Setup:** 
  - Open multiple browser tabs
  - Send messages from each tab
- **Action:** Send messages simultaneously
- **Expected:** All messages process correctly, no interference
- **Actual:** [Record result]

#### Centrifugo Events Integration Test

**Test 2.4: Plan Update Event**
- **Description:** Verify plan updates still work via Centrifugo
- **Setup:** 
  - Create plan
  - Subscribe to Centrifugo channel
- **Action:** Update plan
- **Expected:** Plan update appears in UI via Centrifugo
- **Actual:** [Record result]

**Test 2.5: Render Stream Event**
- **Description:** Verify render updates still stream via Centrifugo
- **Setup:** 
  - Trigger render job
  - Subscribe to Centrifugo channel
- **Action:** Monitor render progress
- **Expected:** Render updates stream in real-time via Centrifugo
- **Actual:** [Record result]

**Test 2.6: Artifact Update Event**
- **Description:** Verify artifact updates still work via Centrifugo
- **Setup:** 
  - Update artifact file
  - Subscribe to Centrifugo channel
- **Action:** Monitor artifact updates
- **Expected:** Artifact update appears in UI via Centrifugo
- **Actual:** [Record result]

#### Hybrid Flow Integration Test

**Test 2.7: Chat → Render Flow**
- **Description:** Verify chat completes and render starts
- **Setup:** 
  - Send chat message
  - Monitor both chat and render
- **Steps:**
  1. Chat completes via AI SDK
  2. Render job created
  3. Render updates stream via Centrifugo
- **Expected:** Entire flow works correctly
- **Actual:** [Record result]

**Test 2.8: Plan → Execute Flow**
- **Description:** Verify plan execution updates via Centrifugo
- **Setup:** 
  - Create plan
  - Execute plan
- **Action:** Monitor execution updates
- **Expected:** Execution updates stream via Centrifugo
- **Actual:** [Record result]

---

### 3. Manual Testing

#### Chat Functionality

**Test 3.1: Simple Chat Message**
- **Description:** Send simple chat message
- **Steps:**
  1. Open chat UI
  2. Type "Hello"
  3. Send message
  4. Wait for response
- **Expected:** 
  - Message appears in UI
  - Response streams token-by-token via AI SDK
  - Message completes
  - Render job created
- **Actual:** [Record result]

**Test 3.2: Complex Chat Message**
- **Description:** Send complex chat message with multiple parts
- **Steps:**
  1. Open chat UI
  2. Type complex query
  3. Send message
  4. Monitor response
- **Expected:** 
  - Message processes correctly
  - Response is relevant and complete
  - No errors
- **Actual:** [Record result]

**Test 3.3: Chat with File Context**
- **Description:** Send chat message that references files
- **Steps:**
  1. Open workspace with files
  2. Send message referencing files
  3. Monitor response
- **Expected:** 
  - File context included in prompt
  - Response references files correctly
  - No errors
- **Actual:** [Record result]

**Test 3.4: Chat with Tool Calls**
- **Description:** Send chat message that triggers tool calls
- **Steps:**
  1. Send message requiring tool call (e.g., "latest version")
  2. Monitor tool execution
  3. Verify tool results in response
- **Expected:** 
  - Tool called correctly
  - Tool results incorporated into response
  - No errors
- **Actual:** [Record result]

**Test 3.5: Long Chat Response**
- **Description:** Send message that generates long response
- **Steps:**
  1. Send message requesting detailed explanation
  2. Monitor streaming
  3. Verify completion
- **Expected:** 
  - Response streams smoothly
  - No jank or flicker
  - Response completes correctly
- **Actual:** [Record result]

#### Centrifugo Events (Non-Chat)

**Test 3.6: Plan Creation**
- **Description:** Create plan and verify updates
- **Steps:**
  1. Trigger plan creation
  2. Monitor Centrifugo events
  3. Verify plan appears in UI
- **Expected:** 
  - Plan created successfully
  - Plan updates appear via Centrifugo
  - UI updates correctly
- **Actual:** [Record result]

**Test 3.7: Plan Updates**
- **Description:** Update plan and verify streaming
- **Steps:**
  1. Create plan
  2. Trigger plan update
  3. Monitor streaming updates
- **Expected:** 
  - Plan updates stream in real-time
  - UI updates smoothly
  - No errors
- **Actual:** [Record result]

**Test 3.8: Render Stream**
- **Description:** Trigger render and verify streaming
- **Steps:**
  1. Trigger render job
  2. Monitor render progress
  3. Verify completion
- **Expected:** 
  - Render progress streams via Centrifugo
  - UI updates in real-time
  - Render completes successfully
- **Actual:** [Record result]

**Test 3.9: Artifact Updates**
- **Description:** Update artifact and verify updates
- **Steps:**
  1. Update artifact file
  2. Monitor Centrifugo events
  3. Verify file appears in workspace
- **Expected:** 
  - Artifact update appears via Centrifugo
  - File appears in workspace
  - UI updates correctly
- **Actual:** [Record result]

#### Error Scenarios

**Test 3.10: Network Error During Chat**
- **Description:** Simulate network error during chat
- **Steps:**
  1. Start chat message
  2. Disconnect network mid-stream
  3. Reconnect network
- **Expected:** 
  - Error handled gracefully
  - User notified of error
  - Can retry or continue
- **Actual:** [Record result]

**Test 3.11: Centrifugo Disconnection**
- **Description:** Simulate Centrifugo disconnection
- **Steps:**
  1. Disconnect Centrifugo
  2. Trigger plan/render update
  3. Reconnect Centrifugo
- **Expected:** 
  - Reconnects automatically
  - Events resume after reconnection
  - No data loss
- **Actual:** [Record result]

**Test 3.12: Concurrent Operations**
- **Description:** Test chat and renders happening simultaneously
- **Steps:**
  1. Send chat message
  2. Trigger render job
  3. Monitor both operations
- **Expected:** 
  - Chat and render don't interfere
  - Both complete successfully
  - No errors or conflicts
- **Actual:** [Record result]

---

### 4. Performance Tests

#### Response Time

**Test 4.1: Chat Response Time**
- **Description:** Measure time to first token
- **Setup:** 
  - Start timer
  - Send chat message
  - Stop timer on first token
- **Expected:** Same or better than before migration
- **Actual:** [Record result]
- **Target:** < 500ms

**Test 4.2: Chat Completion Time**
- **Description:** Measure time to complete chat response
- **Setup:** 
  - Start timer
  - Send chat message
  - Stop timer on completion
- **Expected:** Same or better than before migration
- **Actual:** [Record result]
- **Target:** < 5s for typical response

#### Bundle Size

**Test 4.3: Frontend Bundle Size**
- **Description:** Measure frontend bundle size
- **Setup:** 
  - Build production bundle
  - Measure size
- **Expected:** Smaller than before (removed ~100 lines)
- **Actual:** [Record result]
- **Target:** < previous size

**Test 4.4: Extension Bundle Size**
- **Description:** Measure extension bundle size
- **Setup:** 
  - Build extension
  - Measure size
- **Expected:** Smaller than before (removed ~20 lines)
- **Actual:** [Record result]
- **Target:** < previous size

#### Memory Usage

**Test 4.5: Memory Usage**
- **Description:** Measure memory usage during chat
- **Setup:** 
  - Monitor memory before chat
  - Send multiple chat messages
  - Monitor memory after chat
- **Expected:** Same or better than before migration
- **Actual:** [Record result]
- **Target:** No memory leaks

---

### 5. Edge Cases

**Test 5.1: Empty Chat Message**
- **Description:** Send empty chat message
- **Expected:** Handled gracefully, error message or ignored
- **Actual:** [Record result]

**Test 5.2: Very Long Chat Response**
- **Description:** Send message that generates very long response
- **Expected:** Streams correctly, no performance issues
- **Actual:** [Record result]

**Test 5.3: Rapid Message Sending**
- **Description:** Send multiple messages rapidly
- **Expected:** All process correctly, no interference
- **Actual:** [Record result]

**Test 5.4: Chat During Render**
- **Description:** Send chat message while render in progress
- **Expected:** Chat and render don't interfere
- **Actual:** [Record result]

**Test 5.5: Chat During Plan Execution**
- **Description:** Send chat message while plan executing
- **Expected:** Chat and plan execution don't interfere
- **Actual:** [Record result]

---

### 6. Regression Tests

#### Feature Regression Tests

**Test 6.1: All Chat Features**
- **Description:** Test all existing chat features
- **Checklist:**
  - [ ] Role selection works
  - [ ] File context works
  - [ ] Tool calling works
  - [ ] Plan references work
  - [ ] Render references work
  - [ ] Message history works
- **Expected:** All features work as before
- **Actual:** [Record result]

**Test 6.2: All Plan Features**
- **Description:** Test all existing plan features
- **Checklist:**
  - [ ] Plan generation works
  - [ ] Plan review works
  - [ ] Plan execution works
  - [ ] Plan updates stream correctly
- **Expected:** All features work as before
- **Actual:** [Record result]

**Test 6.3: All Render Features**
- **Description:** Test all existing render features
- **Checklist:**
  - [ ] Render jobs created
  - [ ] Render progress streams
  - [ ] Render completion works
  - [ ] Render errors handled
- **Expected:** All features work as before
- **Actual:** [Record result]

**Test 6.4: All Workspace Features**
- **Description:** Test all existing workspace features
- **Checklist:**
  - [ ] File editing works
  - [ ] File creation works
  - [ ] File deletion works
  - [ ] File updates appear correctly
- **Expected:** All features work as before
- **Actual:** [Record result]

---

## Acceptance Criteria

**Feature is complete when:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All manual tests pass
- [ ] All performance tests meet targets
- [ ] All edge cases handled
- [ ] No regressions found
- [ ] Chat works via AI SDK
- [ ] Centrifugo events work (non-chat)
- [ ] Bundle size reduced
- [ ] No console errors
- [ ] No memory leaks

---

## Test Execution Log

### Date: [Date]
### Tester: [Name]
### Environment: [Environment]

#### Unit Tests
- [ ] Frontend unit tests: [PASS/FAIL]
- [ ] Backend unit tests: [PASS/FAIL]
- **Notes:** [Any issues or observations]

#### Integration Tests
- [ ] Chat flow: [PASS/FAIL]
- [ ] Centrifugo events: [PASS/FAIL]
- [ ] Hybrid flows: [PASS/FAIL]
- **Notes:** [Any issues or observations]

#### Manual Tests
- [ ] Chat functionality: [PASS/FAIL]
- [ ] Centrifugo events: [PASS/FAIL]
- [ ] Error scenarios: [PASS/FAIL]
- **Notes:** [Any issues or observations]

#### Performance Tests
- [ ] Response time: [PASS/FAIL]
- [ ] Bundle size: [PASS/FAIL]
- [ ] Memory usage: [PASS/FAIL]
- **Notes:** [Any issues or observations]

#### Regression Tests
- [ ] Chat features: [PASS/FAIL]
- [ ] Plan features: [PASS/FAIL]
- [ ] Render features: [PASS/FAIL]
- [ ] Workspace features: [PASS/FAIL]
- **Notes:** [Any issues or observations]

---

## Issues Found

### Issue 1: [Title]
- **Severity:** [CRITICAL/HIGH/MEDIUM/LOW]
- **Description:** [Description]
- **Steps to Reproduce:** [Steps]
- **Expected:** [Expected behavior]
- **Actual:** [Actual behavior]
- **Status:** [OPEN/RESOLVED]

---

## Test Summary

**Total Tests:** [X]  
**Passed:** [X]  
**Failed:** [X]  
**Skipped:** [X]  
**Pass Rate:** [X]%

**Overall Status:** [PASS/FAIL]

**Recommendation:** [APPROVE/REJECT/NEEDS WORK]

---

*Comprehensive testing ensures the migration is complete and correct. This guide covers all aspects of removing Centrifugo chat handlers while preserving all functionality.*

