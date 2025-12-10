# PR#9: Testing Guide

---

## Test Categories

### 1. Unit Tests

#### Feature Flag Removal
- [ ] Test: Feature flag file doesn't exist
  - **Input:** Check for `lib/config/feature-flags.ts`
  - **Expected:** File not found
  - **Actual:** [Record result]

- [ ] Test: No feature flag imports
  - **Input:** Search codebase for `feature-flags` import
  - **Expected:** 0 matches
  - **Actual:** [Record result]

- [ ] Test: useAIChat works without flag check
  - **Input:** Call `useAIChat()` hook
  - **Expected:** Returns AI SDK chat hook
  - **Actual:** [Record result]

- [ ] Test: Centrifugo still works for plans
  - **Input:** Subscribe to plan channel
  - **Expected:** Plan updates received
  - **Actual:** [Record result]

- [ ] Test: Centrifugo still works for renders
  - **Input:** Subscribe to render channel
  - **Expected:** Render updates received
  - **Actual:** [Record result]

---

### 2. Integration Tests

#### Chat Flow
- [ ] Test: Chat sends message
  - **Steps:**
    1. Open chat interface
    2. Type message
    3. Submit message
  - **Expected:** Message appears in chat
  - **Actual:** [Record result]

- [ ] Test: Chat streams response
  - **Steps:**
    1. Send message
    2. Wait for response
  - **Expected:** Response streams incrementally
  - **Actual:** [Record result]

- [ ] Test: Chat handles errors
  - **Steps:**
    1. Send message that causes error
    2. Observe error handling
  - **Expected:** Error displayed gracefully
  - **Actual:** [Record result]

#### Plans Flow
- [ ] Test: Plan generation works
  - **Steps:**
    1. Request plan generation
    2. Wait for plan
  - **Expected:** Plan appears via Centrifugo
  - **Actual:** [Record result]

- [ ] Test: Plan updates work
  - **Steps:**
    1. Generate plan
    2. Wait for updates
  - **Expected:** Plan updates received via Centrifugo
  - **Actual:** [Record result]

#### Renders Flow
- [ ] Test: Render triggers work
  - **Steps:**
    1. Trigger render operation
    2. Wait for render
  - **Expected:** Render status updates via Centrifugo
  - **Actual:** [Record result]

- [ ] Test: Render progress works
  - **Steps:**
    1. Trigger render
    2. Monitor progress
  - **Expected:** Progress updates received
  - **Actual:** [Record result]

---

### 3. Edge Cases

#### Empty Input
- [ ] Test: Empty message handling
  - **Input:** Submit empty message
  - **Expected:** Message not sent or error shown
  - **Actual:** [Record result]

#### Concurrent Operations
- [ ] Test: Chat + Plan simultaneously
  - **Steps:**
    1. Send chat message
    2. Trigger plan generation
  - **Expected:** Both work independently
  - **Actual:** [Record result]

- [ ] Test: Multiple chat messages
  - **Steps:**
    1. Send message 1
    2. Send message 2 before response
  - **Expected:** Both messages handled correctly
  - **Actual:** [Record result]

#### Error Scenarios
- [ ] Test: Network error handling
  - **Input:** Disconnect network, send message
  - **Expected:** Error displayed, can retry
  - **Actual:** [Record result]

- [ ] Test: Server error handling
  - **Input:** Server returns 500 error
  - **Expected:** Error displayed gracefully
  - **Actual:** [Record result]

---

### 4. Performance Tests

#### Bundle Size
- [ ] Test: Bundle size reduced
  - **Before:** ___ KB
  - **After:** ___ KB
  - **Reduction:** ___ KB (target: 50-100KB)
  - **Status:** ✅/❌

#### Load Time
- [ ] Test: Page load time
  - **Before:** ___ ms
  - **After:** ___ ms
  - **Change:** ___ ms (target: same or better)
  - **Status:** ✅/❌

#### Streaming Performance
- [ ] Test: Time to first token
  - **Before:** ___ ms
  - **After:** ___ ms
  - **Change:** ___ ms (target: same or better)
  - **Status:** ✅/❌

---

### 5. Regression Tests

#### Existing Features
- [ ] Test: Tool calling works
  - **Steps:**
    1. Send message that triggers tool
    2. Verify tool called
    3. Verify tool result appears
  - **Expected:** Tools work as before
  - **Actual:** [Record result]

- [ ] Test: Message history loads
  - **Steps:**
    1. Open workspace with history
    2. Verify messages load
  - **Expected:** All messages appear
  - **Actual:** [Record result]

- [ ] Test: File context works
  - **Steps:**
    1. Send message about file
    2. Verify file context included
  - **Expected:** File context used correctly
  - **Actual:** [Record result]

---

## Acceptance Criteria

Feature is complete when:
- [ ] Feature flag file deleted
- [ ] All feature flag references removed
- [ ] Legacy chat code removed
- [ ] Centrifugo chat subscription removed
- [ ] Legacy Go streaming code removed
- [ ] All tests pass
- [ ] Bundle size reduced
- [ ] No console errors
- [ ] Plans/renders still work
- [ ] Documentation updated

---

## Test Execution Checklist

### Before Testing
- [ ] All code changes committed
- [ ] Dependencies installed
- [ ] Environment configured
- [ ] Test data prepared

### During Testing
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Run E2E tests (if available)
- [ ] Manual testing
- [ ] Performance testing
- [ ] Regression testing

### After Testing
- [ ] Document results
- [ ] Fix any failures
- [ ] Re-run tests
- [ ] Update documentation

---

## Test Results Template

### Test Session: [Date]

**Overall Status:** ✅ PASS / ❌ FAIL

**Tests Run:** ___  
**Tests Passed:** ___  
**Tests Failed:** ___  
**Pass Rate:** ___%

**Failures:**
1. [Test name] - [Brief description]
2. [Test name] - [Brief description]

**Notes:**
- [Any observations]
- [Any issues found]
- [Any follow-up needed]

---

## Performance Benchmarks

### Bundle Size
| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Total Bundle | ___ KB | ___ KB | Reduced | ✅/❌ |
| Main Chunk | ___ KB | ___ KB | Reduced | ✅/❌ |
| Vendor Chunk | ___ KB | ___ KB | Reduced | ✅/❌ |

### Load Times
| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| First Load | ___ ms | ___ ms | Same/Better | ✅/❌ |
| Time to Interactive | ___ ms | ___ ms | Same/Better | ✅/❌ |

### Streaming Performance
| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Time to First Token | ___ ms | ___ ms | Same/Better | ✅/❌ |
| Streaming Smoothness | [Rating] | [Rating] | Same/Better | ✅/❌ |

---

## Manual Testing Checklist

### Chat Functionality
- [ ] Send message
- [ ] Receive streaming response
- [ ] Verify response appears correctly
- [ ] Verify markdown renders
- [ ] Verify code blocks work
- [ ] Verify tool calls appear
- [ ] Verify error handling

### Plans Functionality
- [ ] Generate plan
- [ ] Verify plan appears
- [ ] Verify plan updates
- [ ] Verify plan execution

### Renders Functionality
- [ ] Trigger render
- [ ] Verify render status
- [ ] Verify render progress
- [ ] Verify render completion

### Browser Console
- [ ] No errors
- [ ] No warnings
- [ ] No deprecation notices

### Network Tab
- [ ] Chat requests to `/api/chat`
- [ ] No requests to legacy endpoints
- [ ] Centrifugo WebSocket connected
- [ ] Plan/render channels subscribed

---

## Automated Test Commands

### Frontend Tests
```bash
cd chartsmith-app
npm test
```

### Backend Tests
```bash
go test ./... -v
```

### E2E Tests (if available)
```bash
npm run test:e2e
```

### Type Check
```bash
npx tsc --noEmit
```

### Lint
```bash
npm run lint
```

### Build
```bash
npm run build
```

---

## Test Coverage Goals

- **Unit Tests:** 80%+ coverage maintained
- **Integration Tests:** All critical paths covered
- **E2E Tests:** Happy path validated
- **Manual Tests:** All features verified

---

## Known Issues & Workarounds

### Issue 1: [Title]
**Description:** [Description]  
**Workaround:** [Workaround]  
**Status:** [OPEN/FIXED]

---

## Test Sign-Off

**Tester:** [Name]  
**Date:** [Date]  
**Status:** ✅ APPROVED / ❌ NEEDS WORK

**Comments:**
- [Any comments]

