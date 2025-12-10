# PR#11: Testing Guide

**Purpose:** Comprehensive testing strategy for validating the Vercel AI SDK migration  
**Scope:** E2E tests, regression tests, performance validation  
**Time Estimate:** 2-3 hours

---

## Test Categories

### 1. Documentation Tests

#### Unit Tests
- [ ] All code examples compile
- [ ] All links work (no broken links)
- [ ] Markdown renders correctly
- [ ] Diagrams are accurate

#### Manual Review
- [ ] Technical accuracy review
- [ ] Completeness check
- [ ] Clarity and readability
- [ ] Consistency with other docs

**Success Criteria:** All documentation is accurate, complete, and helpful

---

### 2. E2E Tests

#### 2.1: Chat Flow Test

**Test File:** `chartsmith-app/tests/chat-ai-sdk.spec.ts`

**Test Cases:**

**TC-1: Basic Chat Flow**
- [ ] User sends message
- [ ] Message appears in UI immediately
- [ ] Streaming response starts
- [ ] Response streams incrementally
- [ ] Response completes
- [ ] Message persists after page refresh

**Test Steps:**
```typescript
test('basic chat flow with AI SDK', async ({ page }) => {
  await loginTestUser(page);
  await navigateToWorkspace(page);
  
  // Send message
  await page.fill('textarea[placeholder="Ask a question..."]', 'Hello');
  await page.press('textarea', 'Enter');
  
  // Verify message sent
  await expect(page.locator('[data-testid="user-message"]')).toBeVisible();
  
  // Verify streaming starts
  await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
  
  // Wait for completion
  await page.waitForSelector('[data-testid="ai-response-complete"]', { timeout: 30000 });
  
  // Verify persistence
  await page.reload();
  await expect(page.locator('[data-testid="user-message"]')).toBeVisible();
  await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
});
```

**TC-2: Multiple Messages**
- [ ] Send first message
- [ ] Receive response
- [ ] Send second message
- [ ] Verify conversation history maintained
- [ ] Verify context is preserved

**TC-3: Error Handling**
- [ ] Test network failure (simulate offline)
- [ ] Test timeout (long-running request)
- [ ] Test invalid input
- [ ] Verify error messages display correctly
- [ ] Verify recovery after error

**Success Criteria:** All chat flow tests pass, errors handled gracefully

---

#### 2.2: Streaming Test

**Test File:** `chartsmith-app/tests/chat-streaming.spec.ts`

**Test Cases:**

**TC-1: Incremental Rendering**
- [ ] Text appears incrementally (not all at once)
- [ ] No flicker or jank during streaming
- [ ] Smooth rendering experience
- [ ] Text length increases over time

**Test Steps:**
```typescript
test('streaming renders incrementally', async ({ page }) => {
  await loginTestUser(page);
  await navigateToWorkspace(page);
  
  // Send message that generates long response
  await page.fill('textarea', 'Tell me a detailed story');
  await page.press('textarea', 'Enter');
  
  // Verify streaming starts
  const response = page.locator('[data-testid="ai-response"]');
  await expect(response).toBeVisible();
  
  // Check text appears incrementally
  let previousLength = 0;
  let increments = 0;
  
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    const currentText = await response.textContent();
    const currentLength = currentText?.length || 0;
    
    if (currentLength > previousLength) {
      increments++;
    }
    previousLength = currentLength;
  }
  
  expect(increments).toBeGreaterThan(5); // Should increment multiple times
});
```

**TC-2: Cancellation**
- [ ] Start streaming response
- [ ] Click cancel button
- [ ] Verify streaming stops immediately
- [ ] Verify UI updates (loading state clears)
- [ ] Verify partial response is saved (if applicable)

**TC-3: Loading States**
- [ ] Loading indicator shows when sending
- [ ] Loading indicator shows during streaming
- [ ] Loading indicator hides when complete
- [ ] Input disabled during streaming
- [ ] Input enabled after completion

**Success Criteria:** Streaming is smooth, cancellation works, loading states correct

---

#### 2.3: Tool Calling Test

**Test File:** `chartsmith-app/tests/tool-calling-ai-sdk.spec.ts`

**Test Cases:**

**TC-1: Tool Call Streaming**
- [ ] Send message that triggers tool
- [ ] Verify tool call appears in stream
- [ ] Verify tool executes
- [ ] Verify tool result appears
- [ ] Verify result incorporated into response

**Test Steps:**
```typescript
test('tool calls work with AI SDK', async ({ page }) => {
  await loginTestUser(page);
  await navigateToWorkspace(page);
  
  // Send message that triggers tool
  await page.fill('textarea', 'What is the latest Kubernetes version?');
  await page.press('textarea', 'Enter');
  
  // Verify tool call appears
  await expect(page.locator('[data-testid="tool-call"]')).toBeVisible({ timeout: 10000 });
  
  // Verify tool executes
  await page.waitForSelector('[data-testid="tool-result"]', { timeout: 15000 });
  
  // Verify result in response
  await expect(page.locator('[data-testid="ai-response"]')).toContainText('1.', { timeout: 20000 });
});
```

**TC-2: text_editor Tool**
- [ ] Send message that uses text_editor
- [ ] Verify tool call streams correctly
- [ ] Verify file changes appear
- [ ] Verify response includes changes
- [ ] Verify file browser updates

**TC-3: Multiple Tools**
- [ ] Send message triggering multiple tools
- [ ] Verify all tools execute
- [ ] Verify results appear in order
- [ ] Verify final response incorporates all results

**TC-4: Tool Call Errors**
- [ ] Simulate tool failure
- [ ] Verify error message appears
- [ ] Verify recovery works
- [ ] Verify partial results handled

**Success Criteria:** All tool calling tests pass, tools execute correctly

---

#### 2.4: Integration Test

**Test Cases:**

**TC-1: Chat with File Context**
- [ ] Open workspace with files
- [ ] Send message referencing files
- [ ] Verify file context included
- [ ] Verify response uses file context

**TC-2: Chat with Chart Context**
- [ ] Open workspace with chart
- [ ] Send message about chart
- [ ] Verify chart context included
- [ ] Verify response references chart

**TC-3: Chat with Plan References**
- [ ] Create plan in workspace
- [ ] Send message referencing plan
- [ ] Verify plan context included
- [ ] Verify plan links work

**TC-4: Chat with Render References**
- [ ] Create render in workspace
- [ ] Send message referencing render
- [ ] Verify render context included
- [ ] Verify render links work

**Success Criteria:** All integration scenarios work correctly

---

### 3. Regression Tests

#### 3.1: Existing E2E Tests

**Run All Existing Tests:**
- [ ] `tests/login.spec.ts` - Login flow
- [ ] `tests/chat-scrolling.spec.ts` - Chat scrolling behavior
- [ ] `tests/upload-chart.spec.ts` - Chart upload
- [ ] `tests/import-artifactory.spec.ts` - ArtifactHub import

**Success Criteria:** All existing tests pass (no regressions)

---

#### 3.2: Edge Cases

**Test Cases:**

**TC-1: Empty Messages**
- [ ] Try to send empty message
- [ ] Verify validation works
- [ ] Verify no error thrown

**TC-2: Very Long Messages**
- [ ] Send message with 10,000+ characters
- [ ] Verify message sends
- [ ] Verify response received
- [ ] Verify UI handles long text

**TC-3: Special Characters**
- [ ] Send message with emojis
- [ ] Send message with unicode
- [ ] Send message with code blocks
- [ ] Verify all render correctly

**TC-4: Rapid Message Sending**
- [ ] Send 5 messages quickly
- [ ] Verify all send correctly
- [ ] Verify responses don't mix up
- [ ] Verify conversation order correct

**TC-5: Network Interruptions**
- [ ] Start sending message
- [ ] Simulate network failure
- [ ] Verify error handling
- [ ] Verify recovery works

**Success Criteria:** All edge cases handled gracefully

---

### 4. Performance Tests

#### 4.1: Time to First Token

**Test:** Measure time from message send to first token received

**Target:** Same or better than before migration

**Test Steps:**
```typescript
test('time to first token', async ({ page }) => {
  await loginTestUser(page);
  await navigateToWorkspace(page);
  
  const startTime = Date.now();
  
  await page.fill('textarea', 'Hello');
  await page.press('textarea', 'Enter');
  
  // Wait for first token
  await page.waitForSelector('[data-testid="ai-response"]', { timeout: 10000 });
  
  const firstTokenTime = Date.now() - startTime;
  
  console.log(`Time to first token: ${firstTokenTime}ms`);
  expect(firstTokenTime).toBeLessThan(5000); // 5 seconds max
});
```

**Success Criteria:** < 5 seconds (same or better than before)

---

#### 4.2: Streaming Smoothness

**Test:** Verify no jank or flicker during streaming

**Target:** Smooth, incremental rendering

**Test Steps:**
- Visual inspection during streaming
- Check for layout shifts
- Verify no flicker
- Check frame rate (if possible)

**Success Criteria:** Smooth streaming, no visible jank

---

#### 4.3: Memory Usage

**Test:** Verify no memory leaks

**Target:** No memory leaks detected

**Test Steps:**
- Send multiple messages
- Check memory usage
- Verify no continuous growth
- Check for leaks in dev tools

**Success Criteria:** No memory leaks detected

---

#### 4.4: Bundle Size

**Test:** Verify bundle size is acceptable

**Target:** Same or smaller than before

**Test Steps:**
```bash
npm run build
# Check .next/static/chunks/ for bundle sizes
```

**Success Criteria:** Bundle size same or smaller

---

## Acceptance Criteria

**Feature is complete when:**
- [ ] All E2E tests pass
- [ ] All regression tests pass
- [ ] All edge cases handled
- [ ] Performance targets met
- [ ] No console errors
- [ ] No visual regressions
- [ ] Memory usage acceptable
- [ ] Bundle size acceptable

---

## Test Execution

### Running Tests

**Run All E2E Tests:**
```bash
cd chartsmith-app
npm run test:e2e
```

**Run Specific Test:**
```bash
npm run test:e2e tests/chat-ai-sdk.spec.ts
```

**Run Tests in Headed Mode:**
```bash
npm run test:e2e:headed
```

**Run Tests with Debug:**
```bash
DEBUG=pw:api npm run test:e2e
```

### Test Environment

**Requirements:**
- Frontend dev server running (`npm run dev`)
- Backend worker running (`make run-worker`)
- Database running (Docker)
- Centrifugo running (Docker)

**Setup:**
```bash
# Terminal 1: Frontend
cd chartsmith-app
npm run dev

# Terminal 2: Backend
make run-worker

# Terminal 3: Tests
cd chartsmith-app
npm run test:e2e
```

---

## Test Data

### Test Workspaces
- Use existing test workspaces
- Create new workspace if needed
- Ensure test data is available

### Test Messages
- Simple messages: "Hello", "What is Kubernetes?"
- Tool-triggering: "What is the latest Kubernetes version?"
- Long messages: Generate 1000+ character message
- Special characters: Include emojis, unicode, code blocks

---

## Troubleshooting

### Issue: Tests Fail to Start
**Solution:** Verify all services are running (frontend, backend, database)

### Issue: Tests Timeout
**Solution:** Increase timeout, check network, verify services

### Issue: Tests Flaky
**Solution:** Add waits, use proper selectors, check for race conditions

### Issue: Performance Tests Fail
**Solution:** Check network conditions, verify test environment matches production

---

## Test Coverage Goals

**Target Coverage:**
- Chat flow: 100% of critical paths
- Streaming: All scenarios covered
- Tool calling: All tools tested
- Edge cases: Common edge cases covered
- Regression: All existing tests pass

---

## Manual Testing Checklist

### Full User Journey
- [ ] Login
- [ ] Navigate to workspace
- [ ] Send chat message
- [ ] Receive streaming response
- [ ] Send follow-up message
- [ ] Use tool calling
- [ ] Check message history
- [ ] Refresh page
- [ ] Verify persistence

### Feature Testing
- [ ] Chat input works
- [ ] Role selector works
- [ ] Streaming works smoothly
- [ ] Tool calls work
- [ ] File context works
- [ ] Chart context works
- [ ] Plan references work
- [ ] Render references work

### UI/UX Validation
- [ ] No visual regressions
- [ ] Loading states correct
- [ ] Error states correct
- [ ] Responsive design works
- [ ] Accessibility preserved

### Console Check
- [ ] No console errors
- [ ] No console warnings
- [ ] Network requests correct
- [ ] Performance acceptable

---

**Status:** 📋 READY FOR TESTING  
**Next Step:** Begin creating E2E tests

