# PR#14: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (~30 min)
  - [ ] Read `PR14_REMOVE_CENTRIFUGO_CHAT_HANDLERS.md`
  - [ ] Understand what code needs to be removed
  - [ ] Review previous PRs to understand current state
  - [ ] Note any questions
- [ ] Prerequisites verified
  - [ ] PR#13 complete (feature flags removed)
  - [ ] PR#6 complete (useChat hook working)
  - [ ] PR#7 complete (Chat UI migrated)
  - [ ] All previous PRs merged
  - [ ] Access to codebase
- [ ] Git branch created
  ```bash
  git checkout -b feat/pr14-remove-centrifugo-chat-handlers
  ```

---

## Phase 1: Frontend Cleanup (1-2 hours)

### 1.1: Search for All Chat Handler References (10 minutes)

#### Search Codebase
- [ ] Search for `chatmessage-updated` references
  ```bash
  cd chartsmith-app
  grep -r "chatmessage-updated" .
  ```
- [ ] Search for `handleChatMessageUpdated` references
  ```bash
  grep -r "handleChatMessageUpdated" .
  ```
- [ ] Search for `ChatMessageUpdated` references
  ```bash
  grep -r "ChatMessageUpdated" .
  ```
- [ ] Document all findings
  - [ ] List all files with references
  - [ ] Note line numbers
  - [ ] Identify dependencies

**Checkpoint:** All references identified ✓

---

### 1.2: Remove Chat Handler from useCentrifugo.ts (30 minutes)

#### Locate Handler Function
- [ ] Open `chartsmith-app/hooks/useCentrifugo.ts`
- [ ] Find `handleChatMessageUpdated` function (around line 89)
- [ ] Review function to understand what it does
- [ ] Note any dependencies or side effects

#### Remove Handler Function
- [ ] Remove entire `handleChatMessageUpdated` function
  ```typescript
  // ❌ REMOVE THIS ENTIRE FUNCTION
  const handleChatMessageUpdated = useCallback((data: CentrifugoMessageData) => {
    // ... function body ...
  }, [setMessages, setActiveRenderIds]);
  ```
- [ ] Remove function from dependency arrays
  - [ ] Remove from `handleCentrifugoMessage` dependencies (around line 474)
  - [ ] Check for other references

#### Remove Event Case
- [ ] Find `handleCentrifugoMessage` function
- [ ] Locate `chatmessage-updated` case (around line 452)
- [ ] Remove the case:
  ```typescript
  // ❌ REMOVE THIS CASE
  } else if (eventType === 'chatmessage-updated') {
    handleChatMessageUpdated(message.data);
  }
  ```

#### Verify Compilation
- [ ] Run TypeScript type check
  ```bash
  cd chartsmith-app
  npx tsc --noEmit
  ```
- [ ] Verify no type errors
- [ ] Check for any broken references
- [ ] Fix any import issues

**Checkpoint:** Frontend compiles without errors ✓

**Commit:** `refactor(pr14): remove chat handler from useCentrifugo hook`

---

### 1.3: Test Frontend Changes (20 minutes)

#### Manual Testing
- [ ] Start development server
  ```bash
  cd chartsmith-app
  npm run dev
  ```
- [ ] Open application in browser
- [ ] Test chat functionality
  - [ ] Send a chat message
  - [ ] Verify message appears via AI SDK
  - [ ] Verify streaming works
  - [ ] Verify message completes
- [ ] Test Centrifugo events (non-chat)
  - [ ] Trigger plan update
  - [ ] Verify plan appears in UI
  - [ ] Trigger render stream
  - [ ] Verify render updates appear
- [ ] Check browser console
  - [ ] No errors related to chat handlers
  - [ ] No warnings about missing handlers
  - [ ] Verify no memory leaks

#### Automated Testing
- [ ] Run unit tests
  ```bash
  npm run test:unit
  ```
- [ ] Run integration tests
  ```bash
  npm run test:integration
  ```
- [ ] Verify all tests pass
- [ ] Update tests if needed (remove chat handler mocks)

**Checkpoint:** Frontend works correctly ✓

**Commit:** `test(pr14): verify frontend chat works after handler removal`

---

## Phase 2: Extension Cleanup (30 minutes)

### 2.1: Remove Chat Handler from Extension (15 minutes)

#### Locate Handler
- [ ] Open `chartsmith-extension/src/modules/webSocket/index.ts`
- [ ] Find `handleChatMessageUpdated` function (around line 104)
- [ ] Review function to understand what it does
- [ ] Check if extension actually uses chat

#### Remove Handler Function
- [ ] Remove `handleChatMessageUpdated` function
  ```typescript
  // ❌ REMOVE THIS FUNCTION
  function handleChatMessageUpdated(data: any): void {
    // ... function body ...
  }
  ```

#### Remove Event Case
- [ ] Find `handleWebSocketMessage` function
- [ ] Locate `chatmessage-updated` case (around line 84)
- [ ] Remove the case:
  ```typescript
  // ❌ REMOVE THIS CASE
  case 'chatmessage-updated':
    handleChatMessageUpdated(data);
    return true;
  ```

#### Verify Compilation
- [ ] Run TypeScript type check
  ```bash
  cd chartsmith-extension
  npx tsc --noEmit
  ```
- [ ] Verify no type errors
- [ ] Check for any broken references

**Checkpoint:** Extension compiles without errors ✓

**Commit:** `refactor(pr14): remove chat handler from extension`

---

### 2.2: Test Extension (15 minutes)

#### Manual Testing (if extension uses chat)
- [ ] Build extension
  ```bash
  cd chartsmith-extension
  npm run build
  ```
- [ ] Load extension in VS Code
- [ ] Test chat functionality (if applicable)
- [ ] Test other WebSocket events
- [ ] Check for errors

#### Automated Testing
- [ ] Run extension tests (if any)
- [ ] Verify tests pass
- [ ] Update tests if needed

**Checkpoint:** Extension works correctly ✓

**Commit:** `test(pr14): verify extension works after handler removal`

---

## Phase 3: Backend Cleanup (1-2 hours)

### 3.1: Search for Backend References (15 minutes)

#### Search Codebase
- [ ] Search for `ChatMessageUpdatedEvent` references
  ```bash
  cd pkg
  grep -r "ChatMessageUpdatedEvent" .
  ```
- [ ] Search for `chatmessage-updated` references
  ```bash
  grep -r "chatmessage-updated" .
  ```
- [ ] Search for `realtime.SendEvent` with chat
  ```bash
  grep -r "SendEvent.*chat" .
  ```
- [ ] Document all findings
  - [ ] List all files with references
  - [ ] Note line numbers
  - [ ] Identify if event is used elsewhere

**Checkpoint:** All backend references identified ✓

---

### 3.2: Remove Centrifugo Streaming from Conversational Handler (30 minutes)

#### Locate Streaming Code
- [ ] Open `pkg/listener/conversational.go`
- [ ] Find Centrifugo streaming code (around line 70)
- [ ] Review code to understand what it does
- [ ] Identify what needs to stay (database updates, render jobs)

#### Remove Centrifugo Streaming
- [ ] Remove `ChatMessageUpdatedEvent` creation
  ```go
  // ❌ REMOVE THIS
  e := realtimetypes.ChatMessageUpdatedEvent{
      WorkspaceID: w.ID,
      ChatMessage: chatMessage,
  }
  ```
- [ ] Remove `realtime.SendEvent` call for chat
  ```go
  // ❌ REMOVE THIS
  if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
      return fmt.Errorf("failed to send chat message update: %w", err)
  }
  ```

#### Preserve Critical Code
- [ ] Verify database updates still happen
  - [ ] Check if handled by AI SDK adapter
  - [ ] If not, ensure `workspace.AppendChatMessageResponse` still called
- [ ] Verify render job creation still happens
  - [ ] Ensure `workspace.EnqueueRenderWorkspaceForRevision` still called
- [ ] Verify completion marking still happens
  - [ ] Ensure `workspace.SetChatMessageIntent` still called

#### Verify Compilation
- [ ] Run Go build
  ```bash
  go build ./pkg/listener/...
  ```
- [ ] Verify no compilation errors
- [ ] Check for unused imports
- [ ] Remove unused imports if needed

**Checkpoint:** Backend compiles without errors ✓

**Commit:** `refactor(pr14): remove Centrifugo streaming from conversational handler`

---

### 3.3: Check Other Backend Files (20 minutes)

#### Check new_intent.go
- [ ] Open `pkg/listener/new_intent.go`
- [ ] Search for `ChatMessageUpdatedEvent`
- [ ] If found, determine if still needed
  - [ ] If only for chat, remove
  - [ ] If for other purposes, keep but document
- [ ] Remove chat-related event sends if present
- [ ] Verify intent classification still works

#### Check Other Files
- [ ] Review all files that reference `ChatMessageUpdatedEvent`
- [ ] Determine if event is used for non-chat purposes
- [ ] Document findings
- [ ] Make removal decisions

**Checkpoint:** All backend files reviewed ✓

**Commit:** `refactor(pr14): remove chat events from intent handler`

---

### 3.4: Remove Event Type (if safe) (15 minutes)

#### Verify Event Type Only Used for Chat
- [ ] Confirm `ChatMessageUpdatedEvent` only used for chat
- [ ] If used elsewhere, document and keep
- [ ] If only for chat, proceed with removal

#### Remove Event Type File
- [ ] Open `pkg/realtime/types/chatmessage-updated.go`
- [ ] Review file contents
- [ ] Remove entire file if safe
- [ ] Update imports in other files if needed
- [ ] Verify Go compiles

#### Verify No Broken References
- [ ] Search for any remaining references
  ```bash
  grep -r "ChatMessageUpdatedEvent" .
  ```
- [ ] If references found, investigate and fix
- [ ] Verify all imports updated

**Checkpoint:** Event type removed (if safe) ✓

**Commit:** `refactor(pr14): remove ChatMessageUpdatedEvent type`

---

### 3.5: Test Backend Changes (20 minutes)

#### Manual Testing
- [ ] Start Go worker
  ```bash
  go run main.go worker
  ```
- [ ] Send test chat message via API
- [ ] Verify chat processes correctly
- [ ] Verify database updates happen
- [ ] Verify render job created
- [ ] Check logs for errors

#### Automated Testing
- [ ] Run Go unit tests
  ```bash
  go test ./pkg/listener/...
  ```
- [ ] Run integration tests
  ```bash
  go test ./pkg/... -tags=integration
  ```
- [ ] Verify all tests pass
- [ ] Update tests if needed

**Checkpoint:** Backend works correctly ✓

**Commit:** `test(pr14): verify backend works after Centrifugo removal`

---

## Phase 4: Testing & Validation (2-3 hours)

### 4.1: Unit Tests (30 minutes)

#### Frontend Tests
- [ ] Run all frontend unit tests
  ```bash
  cd chartsmith-app
  npm run test:unit
  ```
- [ ] Update tests that reference removed handlers
- [ ] Remove mocks for `handleChatMessageUpdated`
- [ ] Add tests for edge cases
- [ ] Verify test coverage maintained

#### Backend Tests
- [ ] Run all backend unit tests
  ```bash
  go test ./pkg/...
  ```
- [ ] Update tests that reference removed code
- [ ] Remove mocks for `ChatMessageUpdatedEvent`
- [ ] Add tests for edge cases
- [ ] Verify test coverage maintained

**Checkpoint:** All unit tests pass ✓

**Commit:** `test(pr14): update unit tests after handler removal`

---

### 4.2: Integration Tests (45 minutes)

#### Chat Flow Integration Test
- [ ] Test: Send chat message → Receive response
  - [ ] Send message via API
  - [ ] Verify response streams via AI SDK
  - [ ] Verify message saved to database
  - [ ] Verify render job created
- [ ] Test: Chat history loading
  - [ ] Load previous messages
  - [ ] Verify messages display correctly
- [ ] Test: Multiple concurrent chats
  - [ ] Send multiple messages
  - [ ] Verify all process correctly

#### Centrifugo Events Integration Test
- [ ] Test: Plan update event
  - [ ] Create plan
  - [ ] Verify plan update appears via Centrifugo
  - [ ] Verify UI updates
- [ ] Test: Render stream event
  - [ ] Trigger render
  - [ ] Verify render updates stream via Centrifugo
  - [ ] Verify UI updates
- [ ] Test: Artifact update event
  - [ ] Update artifact
  - [ ] Verify update appears via Centrifugo
  - [ ] Verify UI updates

#### Hybrid Flow Integration Test
- [ ] Test: Chat → Render flow
  - [ ] Send chat message
  - [ ] Chat completes via AI SDK
  - [ ] Render job starts
  - [ ] Render updates via Centrifugo
  - [ ] Verify entire flow works
- [ ] Test: Plan → Execute flow
  - [ ] Create plan
  - [ ] Execute plan
  - [ ] Updates via Centrifugo
  - [ ] Verify entire flow works

**Checkpoint:** All integration tests pass ✓

**Commit:** `test(pr14): add integration tests for chat and Centrifugo events`

---

### 4.3: Manual Testing (1 hour)

#### Chat Functionality
- [ ] Test: Send simple chat message
  - Expected: Message appears, streams response
  - Actual: [Record result]
- [ ] Test: Send complex chat message
  - Expected: Handles complex queries correctly
  - Actual: [Record result]
- [ ] Test: Send message with file context
  - Expected: File context included, response relevant
  - Actual: [Record result]
- [ ] Test: Send message with tool calls
  - Expected: Tools called, results incorporated
  - Actual: [Record result]
- [ ] Test: Chat history
  - Expected: Previous messages load correctly
  - Actual: [Record result]
- [ ] Test: Long chat response
  - Expected: Streams smoothly, no jank
  - Actual: [Record result]

#### Centrifugo Events (Non-Chat)
- [ ] Test: Plan creation
  - Expected: Plan appears in UI via Centrifugo
  - Actual: [Record result]
- [ ] Test: Plan updates
  - Expected: Updates stream in real-time
  - Actual: [Record result]
- [ ] Test: Render stream
  - Expected: Render progress updates in real-time
  - Actual: [Record result]
- [ ] Test: Artifact updates
  - Expected: File updates appear in workspace
  - Actual: [Record result]

#### Error Scenarios
- [ ] Test: Network error during chat
  - Expected: Error handled gracefully, user notified
  - Actual: [Record result]
- [ ] Test: Centrifugo disconnection
  - Expected: Reconnects, events resume
  - Actual: [Record result]
- [ ] Test: Concurrent operations
  - Expected: Chat and renders don't interfere
  - Actual: [Record result]

#### Performance
- [ ] Test: Chat response time
  - Expected: Same or better than before
  - Actual: [Record result]
- [ ] Test: Bundle size
  - Expected: Smaller than before
  - Actual: [Record result]
- [ ] Test: Memory usage
  - Expected: Same or better than before
  - Actual: [Record result]

**Checkpoint:** All manual tests pass ✓

**Commit:** `test(pr14): complete manual testing checklist`

---

### 4.4: Regression Testing (30 minutes)

#### Feature Regression Tests
- [ ] Test: All existing chat features
  - [ ] Role selection
  - [ ] File context
  - [ ] Tool calling
  - [ ] Plan references
  - [ ] Render references
- [ ] Test: All existing plan features
  - [ ] Plan generation
  - [ ] Plan review
  - [ ] Plan execution
- [ ] Test: All existing render features
  - [ ] Render jobs
  - [ ] Render progress
  - [ ] Render completion
- [ ] Test: All existing workspace features
  - [ ] File editing
  - [ ] File creation
  - [ ] File deletion

#### Edge Cases
- [ ] Test: Empty chat message
  - Expected: Handled gracefully
  - Actual: [Record result]
- [ ] Test: Very long response
  - Expected: Streams correctly
  - Actual: [Record result]
- [ ] Test: Rapid message sending
  - Expected: All process correctly
  - Actual: [Record result]
- [ ] Test: Chat during render
  - Expected: No interference
  - Actual: [Record result]

**Checkpoint:** No regressions found ✓

**Commit:** `test(pr14): complete regression testing`

---

## Documentation Phase (30 minutes)

### 5.1: Update Code Comments (15 minutes)

- [ ] Add comments explaining removal
  - [ ] Comment in `useCentrifugo.ts` explaining chat now via AI SDK
  - [ ] Comment in `conversational.go` explaining streaming now via AI SDK
- [ ] Update architecture comments
  - [ ] Note Centrifugo only for non-chat events
  - [ ] Document chat flow via AI SDK

**Commit:** `docs(pr14): add comments explaining chat handler removal`

---

### 5.2: Update Documentation (15 minutes)

- [ ] Update ARCHITECTURE.md
  - [ ] Remove references to Centrifugo chat streaming
  - [ ] Document AI SDK chat flow
  - [ ] Document Centrifugo for non-chat events
- [ ] Update CONTRIBUTING.md if needed
  - [ ] Note chat implementation change
  - [ ] Update development notes

**Commit:** `docs(pr14): update architecture documentation`

---

## Final Verification (30 minutes)

### 6.1: Code Review Checklist

- [ ] All chat handlers removed
- [ ] All Centrifugo chat streaming removed
- [ ] Event type removed (if safe)
- [ ] No broken references
- [ ] No unused imports
- [ ] Code compiles (TypeScript and Go)
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Comments added where helpful

---

### 6.2: Final Search for Remaining References

- [ ] Search for `chatmessage-updated`
  ```bash
  grep -r "chatmessage-updated" .
  ```
  - Expected: No results (or only in docs/tests)
  - Actual: [Record result]
- [ ] Search for `ChatMessageUpdatedEvent`
  ```bash
  grep -r "ChatMessageUpdatedEvent" .
  ```
  - Expected: No results (or only in docs/tests)
  - Actual: [Record result]
- [ ] Search for `handleChatMessageUpdated`
  ```bash
  grep -r "handleChatMessageUpdated" .
  ```
  - Expected: No results (or only in docs/tests)
  - Actual: [Record result]

**Checkpoint:** No remaining references ✓

---

### 6.3: Final Build & Test

- [ ] Frontend build
  ```bash
  cd chartsmith-app
  npm run build
  ```
- [ ] Backend build
  ```bash
  go build ./...
  ```
- [ ] Extension build
  ```bash
  cd chartsmith-extension
  npm run build
  ```
- [ ] Run all tests
- [ ] Verify everything passes

**Checkpoint:** Everything builds and tests pass ✓

**Commit:** `chore(pr14): final verification and cleanup`

---

## Completion Checklist

- [ ] All phases complete
- [ ] All chat handlers removed
- [ ] All Centrifugo chat streaming removed
- [ ] Event type removed (if safe)
- [ ] Chat works via AI SDK
- [ ] Centrifugo events still work (non-chat)
- [ ] All tests passing
- [ ] No console errors
- [ ] No compilation errors
- [ ] Bundle size reduced
- [ ] Documentation updated
- [ ] Code review approved
- [ ] Ready to merge

---

## Deployment Checklist

### Pre-Deploy
- [ ] All tests pass locally
- [ ] Build succeeds
- [ ] No build errors/warnings
- [ ] Code review approved

### Deploy to Staging (if available)
- [ ] Deploy to staging
- [ ] Verify deployment successful
- [ ] Smoke tests pass
- [ ] Chat functionality verified
- [ ] Centrifugo events verified

### Deploy to Production
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Test critical paths
- [ ] Monitor for errors (24 hours)
- [ ] Verify no regressions

---

**PR#14 Complete!** 🎉

This PR completes the Vercel AI SDK migration by removing all legacy Centrifugo chat handlers. Chat now flows exclusively through AI SDK, and Centrifugo handles only non-chat events.

