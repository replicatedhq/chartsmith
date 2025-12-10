# PR#10: Testing Guide

**Use this guide to ensure comprehensive testing of the Anthropic SDK removal.**

---

## Test Categories

### 1. Unit Tests

#### Go Backend: Classification Function
**Function:** `llm.ClassifyPromptType()`

**Test Cases:**

- [ ] **Test Case 1: Plan Classification**
  - **Input:** `"add a new deployment to the chart"`
  - **Expected:** `"plan"`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 2: Chat Classification**
  - **Input:** `"what is kubernetes?"`
  - **Expected:** `"chat"`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 3: Edge Case - Empty String**
  - **Input:** `""`
  - **Expected:** Error or default to "chat"
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 4: Edge Case - Very Long Message**
  - **Input:** `"a" * 10000` (10,000 characters)
  - **Expected:** `"plan"` or `"chat"` (handles gracefully)
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 5: Error Handling - API Failure**
  - **Input:** Mock API error
  - **Expected:** Error returned
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 6: Error Handling - Invalid Response**
  - **Input:** Mock invalid response format
  - **Expected:** Error returned
  - **Actual:** [Record result]
  - **Status:** ⏳

**Test File:** `pkg/llm/prompt_type_test.go`

---

#### Go Backend: HTTP Handler
**Function:** `api.HandlePromptType()`

**Test Cases:**

- [ ] **Test Case 1: Successful Request**
  - **Request:** `POST /api/prompt-type` with `{"message": "add deployment"}`
  - **Expected:** `200 OK` with `{"type": "plan"}`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 2: Invalid Method (GET)**
  - **Request:** `GET /api/prompt-type`
  - **Expected:** `405 Method Not Allowed`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 3: Missing Message Field**
  - **Request:** `POST /api/prompt-type` with `{}`
  - **Expected:** `400 Bad Request`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 4: Empty Message**
  - **Request:** `POST /api/prompt-type` with `{"message": ""}`
  - **Expected:** `400 Bad Request`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 5: Invalid JSON**
  - **Request:** `POST /api/prompt-type` with invalid JSON
  - **Expected:** `400 Bad Request`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 6: LLM Error**
  - **Request:** `POST /api/prompt-type` with message (mock LLM error)
  - **Expected:** `500 Internal Server Error`
  - **Actual:** [Record result]
  - **Status:** ⏳

**Test File:** `pkg/api/prompt_type_test.go`

---

#### Frontend: promptType Function
**Function:** `promptType()`

**Test Cases:**

- [ ] **Test Case 1: Successful API Call - Plan**
  - **Input:** `"add a new deployment"`
  - **Mock:** API returns `{"type": "plan"}`
  - **Expected:** `PromptType.Plan`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 2: Successful API Call - Chat**
  - **Input:** `"what is kubernetes?"`
  - **Mock:** API returns `{"type": "chat"}`
  - **Expected:** `PromptType.Chat`
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 3: API Error (500)**
  - **Input:** `"test message"`
  - **Mock:** API returns `500 Internal Server Error`
  - **Expected:** Error thrown
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 4: Network Error**
  - **Input:** `"test message"`
  - **Mock:** Network failure
  - **Expected:** Error thrown
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 5: Invalid Response Format**
  - **Input:** `"test message"`
  - **Mock:** API returns invalid JSON
  - **Expected:** Error thrown
  - **Actual:** [Record result]
  - **Status:** ⏳

**Test File:** `chartsmith-app/lib/llm/__tests__/prompt-type.test.ts`

---

### 2. Integration Tests

#### End-to-End Flow
**Scenario:** Full request flow from frontend to LLM

**Test Cases:**

- [ ] **Test Case 1: Complete Flow - Plan**
  - **Steps:**
    1. Frontend calls `promptType("add deployment")`
    2. Request goes to `/api/prompt-type`
    3. Next.js route forwards to Go backend
    4. Go backend calls Anthropic API
    5. Response flows back through chain
  - **Expected:** `PromptType.Plan` returned
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 2: Complete Flow - Chat**
  - **Steps:**
    1. Frontend calls `promptType("what is k8s?")`
    2. Request goes to `/api/prompt-type`
    3. Next.js route forwards to Go backend
    4. Go backend calls Anthropic API
    5. Response flows back through chain
  - **Expected:** `PromptType.Chat` returned
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 3: Error Propagation**
  - **Steps:**
    1. Frontend calls `promptType("test")`
    2. Go backend fails (mock error)
    3. Error propagates back
  - **Expected:** Error thrown in frontend
  - **Actual:** [Record result]
  - **Status:** ⏳

**Test File:** `tests/integration/prompt-type.test.ts` (or similar)

---

### 3. Edge Cases

#### Input Validation

- [ ] **Empty String**
  - **Input:** `""`
  - **Expected:** Error or default behavior
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Very Long String**
  - **Input:** 10,000+ characters
  - **Expected:** Handles gracefully (may truncate or error)
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Special Characters**
  - **Input:** `"test\n\t\"'message"`
  - **Expected:** Handles correctly
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Unicode Characters**
  - **Input:** `"测试消息"` (Chinese characters)
  - **Expected:** Handles correctly
  - **Actual:** [Record result]
  - **Status:** ⏳

#### Network Scenarios

- [ ] **Timeout**
  - **Scenario:** Go backend takes >30 seconds
  - **Expected:** Timeout error
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Connection Refused**
  - **Scenario:** Go backend not running
  - **Expected:** Connection error
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Slow Network**
  - **Scenario:** High latency (>2 seconds)
  - **Expected:** Still works, may be slow
  - **Actual:** [Record result]
  - **Status:** ⏳

#### Error Scenarios

- [ ] **LLM API Rate Limit**
  - **Scenario:** Anthropic API returns rate limit error
  - **Expected:** Error propagated correctly
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **LLM API Invalid Key**
  - **Scenario:** Anthropic API key invalid
  - **Expected:** Error propagated correctly
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Malformed Response**
  - **Scenario:** Go backend returns invalid JSON
  - **Expected:** Error in frontend
  - **Actual:** [Record result]
  - **Status:** ⏳

---

### 4. Performance Tests

#### Response Time

- [ ] **Benchmark 1: Average Response Time**
  - **Test:** 10 requests with various messages
  - **Target:** < 2 seconds average
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Benchmark 2: P95 Response Time**
  - **Test:** 100 requests
  - **Target:** < 3 seconds (95th percentile)
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Benchmark 3: Time to First Token**
  - **Test:** Measure time until first response byte
  - **Target:** < 1 second
  - **Actual:** [Record result]
  - **Status:** ⏳

#### Bundle Size

- [ ] **Benchmark 4: Bundle Size Reduction**
  - **Test:** Compare bundle size before/after
  - **Target:** 50-100KB reduction
  - **Before:** [Record size]
  - **After:** [Record size]
  - **Reduction:** [Calculate]
  - **Status:** ⏳

#### Concurrent Requests

- [ ] **Benchmark 5: Concurrent Requests**
  - **Test:** 10 concurrent requests
  - **Target:** All succeed, no errors
  - **Actual:** [Record result]
  - **Status:** ⏳

---

### 5. Regression Tests

#### Existing Functionality

- [ ] **Test Case 1: Chat Still Works**
  - **Scenario:** Send chat message
  - **Expected:** Chat works normally
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 2: Plan Generation Still Works**
  - **Scenario:** Create plan
  - **Expected:** Plan generation works normally
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 3: Workspace Creation Still Works**
  - **Scenario:** Create workspace from prompt
  - **Expected:** Workspace creation works normally
  - **Actual:** [Record result]
  - **Status:** ⏳

#### Visual Regression

- [ ] **Test Case 4: No Visual Changes**
  - **Scenario:** Compare UI before/after
  - **Expected:** No visual differences
  - **Actual:** [Record result]
  - **Status:** ⏳

---

### 6. Security Tests

#### API Key Security

- [ ] **Test Case 1: API Key Not in Frontend**
  - **Test:** Search frontend bundle for API key
  - **Expected:** No API keys found
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 2: Authentication Required**
  - **Test:** Call API route without auth
  - **Expected:** 401 Unauthorized
  - **Actual:** [Record result]
  - **Status:** ⏳

#### Input Sanitization

- [ ] **Test Case 3: XSS Prevention**
  - **Input:** `"<script>alert('xss')</script>"`
  - **Expected:** Handled safely, no XSS
  - **Actual:** [Record result]
  - **Status:** ⏳

- [ ] **Test Case 4: SQL Injection Prevention**
  - **Input:** `"'; DROP TABLE users; --"`
  - **Expected:** Handled safely, no SQL injection
  - **Actual:** [Record result]
  - **Status:** ⏳

---

## Acceptance Criteria

**Feature is complete when:**

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All edge cases handled
- [ ] Performance targets met
- [ ] Bundle size reduced
- [ ] No regressions
- [ ] Security tests pass
- [ ] Manual testing complete

---

## Test Execution Checklist

### Before Testing
- [ ] Go backend deployed
- [ ] Next.js API route deployed
- [ ] Frontend updated
- [ ] Dependencies removed
- [ ] Test environment configured

### During Testing
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Run performance tests
- [ ] Run security tests
- [ ] Manual testing
- [ ] Document results

### After Testing
- [ ] Review test results
- [ ] Fix any failures
- [ ] Re-run failed tests
- [ ] Update documentation
- [ ] Mark tests as complete

---

## Test Data

### Sample Messages for Testing

**Plan Messages:**
- `"add a new deployment"`
- `"update the service configuration"`
- `"create a configmap"`
- `"modify the ingress rules"`
- `"change the replica count"`

**Chat Messages:**
- `"what is kubernetes?"`
- `"how does helm work?"`
- `"explain deployments"`
- `"what are pods?"`
- `"tell me about services"`

**Edge Cases:**
- `""` (empty)
- `"a" * 10000` (very long)
- `"test\n\t\"'message"` (special chars)
- `"测试消息"` (unicode)

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Average Response Time | < 2s | Stopwatch/logging |
| P95 Response Time | < 3s | Percentile calculation |
| Bundle Size Reduction | 50-100KB | Build output comparison |
| Error Rate | < 1% | Error logging |
| Concurrent Requests | 10+ | Load testing |

---

## Manual Testing Checklist

### Browser Testing

- [ ] Open application in browser
- [ ] Open browser dev tools (Console, Network)
- [ ] Test prompt type classification
  - [ ] Enter plan message → Verify "plan" result
  - [ ] Enter chat message → Verify "chat" result
- [ ] Check console for errors
- [ ] Check network tab for API calls
- [ ] Verify response times acceptable
- [ ] Test error scenarios
  - [ ] Disconnect network → Verify error handling
  - [ ] Stop Go backend → Verify error handling

### Functional Testing

- [ ] Test workspace creation
- [ ] Test chat functionality
- [ ] Test plan generation
- [ ] Verify all existing features work
- [ ] Check for visual regressions

---

## Test Results Template

### Test Run: [Date]

**Environment:**
- Go Backend: [Version/Commit]
- Frontend: [Version/Commit]
- Node.js: [Version]
- Browser: [Version]

**Results:**

| Test Category | Passed | Failed | Skipped | Notes |
|--------------|--------|--------|---------|-------|
| Unit Tests (Go) | X | Y | Z | [Notes] |
| Unit Tests (Frontend) | X | Y | Z | [Notes] |
| Integration Tests | X | Y | Z | [Notes] |
| Performance Tests | X | Y | Z | [Notes] |
| Security Tests | X | Y | Z | [Notes] |
| Manual Testing | X | Y | Z | [Notes] |

**Issues Found:**
1. [Issue description]
2. [Issue description]

**Next Steps:**
- [ ] Fix issues
- [ ] Re-run tests
- [ ] Update documentation

---

**Testing Complete!** ✅

