# PR#10: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (~45 min)
  - [ ] Read `PR10_FRONTEND_ANTHROPIC_SDK_REMOVAL.md`
  - [ ] Understand architecture decisions
  - [ ] Note any questions
- [ ] Prerequisites verified
  - [ ] PR#4 complete (Go backend API infrastructure)
  - [ ] Go backend deployed and accessible
  - [ ] Access to `chartsmith-app` directory
  - [ ] Node.js and npm installed
  - [ ] Go development environment set up
- [ ] Git branch created
  ```bash
  git checkout -b feat/remove-anthropic-sdk-frontend
  ```

---

## Phase 1: Go Backend Endpoint (2-3 hours)

### 1.1: Create LLM Classification Function (1 hour)

#### Create File
- [ ] Create `pkg/llm/prompt_type.go`

#### Add Imports
- [ ] Add necessary imports
  ```go
  import (
      "context"
      "strings"
      
      "github.com/anthropics/anthropic-sdk-go/v2"
      "github.com/replicatedhq/chartsmith/pkg/param"
      "github.com/replicatedhq/chartsmith/pkg/logger"
      "go.uber.org/zap"
  )
  ```

#### Implement Classification Function
- [ ] Create `ClassifyPromptType()` function
  ```go
  func ClassifyPromptType(ctx context.Context, message string) (string, error) {
      // 1. Create Anthropic client
      // 2. Define system prompt (copy from frontend)
      // 3. Call Anthropic API
      // 4. Parse response
      // 5. Return "plan" or "chat"
  }
  ```

#### Add System Prompt
- [ ] Copy system prompt from frontend implementation
  ```go
  systemPrompt := `You are ChartSmith, an expert at creating Helm charts for Kubernetes.
You are invited to participate in an existing conversation between a user and an expert.
The expert just provided a recommendation on how to plan the Helm chart to the user.
The user is about to ask a question.
You should decide if the user is asking for a change to the plan/chart, or if they are just asking a conversational question.
Be exceptionally brief and precise in your response.
Only say "plan" or "chat" in your response.`
  ```

#### Implement LLM Call
- [ ] Create Anthropic client
  ```go
  client := anthropic.NewClient(anthropic.WithAPIKey(param.Get().AnthropicAPIKey))
  ```
- [ ] Call Messages.Create
  ```go
  msg, err := client.Messages.Create(ctx, &anthropic.MessageCreateParams{
      Model:       anthropic.ModelClaude35Sonnet20241022,
      MaxTokens:   1024,
      System:      systemPrompt,
      Messages: []anthropic.MessageParam{
          {Role: anthropic.RoleUser, Content: message},
      },
  })
  ```
- [ ] Parse response text
  ```go
  text := ""
  for _, content := range msg.Content {
      if textBlock, ok := content.(anthropic.TextBlock); ok {
          text = textBlock.Text
          break
      }
  }
  ```
- [ ] Return classification
  ```go
  if strings.Contains(strings.ToLower(text), "plan") {
      return "plan", nil
  }
  return "chat", nil
  ```

#### Add Error Handling
- [ ] Handle API errors
- [ ] Handle empty responses
- [ ] Add logging
  ```go
  logger.Debug("Classifying prompt type",
      zap.String("message", message),
      zap.String("result", result))
  ```

**Checkpoint:** Classification function implemented ✓

**Commit:** `feat(backend): add prompt type classification function`

---

### 1.2: Create HTTP Handler (45 minutes)

#### Create File
- [ ] Create `pkg/api/prompt_type.go`

#### Add Imports
- [ ] Add necessary imports
  ```go
  import (
      "encoding/json"
      "net/http"
      
      "github.com/replicatedhq/chartsmith/pkg/llm"
      "github.com/replicatedhq/chartsmith/pkg/logger"
      "go.uber.org/zap"
  )
  ```

#### Define Request/Response Types
- [ ] Create request struct
  ```go
  type PromptTypeRequest struct {
      Message string `json:"message"`
  }
  ```
- [ ] Create response struct
  ```go
  type PromptTypeResponse struct {
      Type string `json:"type"` // "plan" or "chat"
  }
  ```

#### Implement Handler Function
- [ ] Create `HandlePromptType()` function
  ```go
  func HandlePromptType(w http.ResponseWriter, r *http.Request) {
      // 1. Check method is POST
      // 2. Parse request body
      // 3. Validate message field
      // 4. Call classification function
      // 5. Return JSON response
  }
  ```

#### Add Method Check
- [ ] Verify POST method
  ```go
  if r.Method != http.MethodPost {
      http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
      return
  }
  ```

#### Parse Request Body
- [ ] Decode JSON body
  ```go
  var req PromptTypeRequest
  if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
      http.Error(w, "Invalid request body", http.StatusBadRequest)
      return
  }
  ```

#### Validate Input
- [ ] Check message is not empty
  ```go
  if req.Message == "" {
      http.Error(w, "Message is required", http.StatusBadRequest)
      return
  }
  ```

#### Call Classification
- [ ] Call LLM function
  ```go
  promptType, err := llm.ClassifyPromptType(r.Context(), req.Message)
  if err != nil {
      logger.Error("Failed to classify prompt type", zap.Error(err))
      http.Error(w, "Failed to classify prompt type", http.StatusInternalServerError)
      return
  }
  ```

#### Return Response
- [ ] Set content type header
  ```go
  w.Header().Set("Content-Type", "application/json")
  ```
- [ ] Encode JSON response
  ```go
  response := PromptTypeResponse{Type: promptType}
  json.NewEncoder(w).Encode(response)
  ```

**Checkpoint:** HTTP handler implemented ✓

**Commit:** `feat(backend): add prompt type HTTP handler`

---

### 1.3: Register Route (15 minutes)

#### Find Router File
- [ ] Locate API router file (likely `pkg/api/routes.go` or `cmd/main.go`)

#### Add Route Registration
- [ ] Register new endpoint
  ```go
  http.HandleFunc("/api/prompt-type", HandlePromptType)
  ```
  OR if using a router:
  ```go
  router.POST("/api/prompt-type", HandlePromptType)
  ```

#### Verify Route
- [ ] Check route is registered correctly
- [ ] Ensure no conflicts with existing routes
- [ ] Verify path matches frontend expectations

**Checkpoint:** Route registered ✓

**Commit:** `feat(backend): register prompt-type endpoint`

---

### 1.4: Write Unit Tests (30 minutes)

#### Create Test File
- [ ] Create `pkg/llm/prompt_type_test.go`
- [ ] Create `pkg/api/prompt_type_test.go`

#### Test Classification Function
- [ ] Test "plan" classification
  ```go
  func TestClassifyPromptType_Plan(t *testing.T) {
      // Mock Anthropic response
      // Call function
      // Assert result is "plan"
  }
  ```
- [ ] Test "chat" classification
  ```go
  func TestClassifyPromptType_Chat(t *testing.T) {
      // Mock Anthropic response
      // Call function
      // Assert result is "chat"
  }
  ```
- [ ] Test error handling
  ```go
  func TestClassifyPromptType_Error(t *testing.T) {
      // Mock API error
      // Call function
      // Assert error returned
  }
  ```

#### Test HTTP Handler
- [ ] Test successful request
  ```go
  func TestHandlePromptType_Success(t *testing.T) {
      // Create request
      // Call handler
      // Assert response is JSON with "type" field
  }
  ```
- [ ] Test invalid method
  ```go
  func TestHandlePromptType_MethodNotAllowed(t *testing.T) {
      // Send GET request
      // Assert 405 status
  }
  ```
- [ ] Test missing message
  ```go
  func TestHandlePromptType_MissingMessage(t *testing.T) {
      // Send request without message
      // Assert 400 status
  }
  ```
- [ ] Test LLM error
  ```go
  func TestHandlePromptType_LLMError(t *testing.T) {
      // Mock LLM error
      // Assert 500 status
  }
  ```

**Checkpoint:** Tests written and passing ✓

**Commit:** `test(backend): add prompt type tests`

---

## Phase 2: Next.js API Route (30 minutes)

### 2.1: Create API Route File (15 minutes)

#### Create File
- [ ] Create `chartsmith-app/app/api/prompt-type/route.ts`

#### Add Imports
- [ ] Add necessary imports
  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import { getSession } from '@/lib/auth/session';
  ```

#### Implement POST Handler
- [ ] Create POST function
  ```typescript
  export async function POST(request: NextRequest) {
      // 1. Verify authentication
      // 2. Parse request body
      // 3. Validate message
      // 4. Forward to Go backend
      // 5. Return response
  }
  ```

#### Add Authentication Check
- [ ] Get session
  ```typescript
  const session = await getSession();
  if (!session) {
      return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
      );
  }
  ```

#### Parse Request Body
- [ ] Parse JSON body
  ```typescript
  const body = await request.json();
  const { message } = body;
  ```

#### Validate Input
- [ ] Check message exists and is string
  ```typescript
  if (!message || typeof message !== 'string') {
      return NextResponse.json(
          { error: 'Message is required' },
          { status: 400 }
      );
  }
  ```

#### Forward to Go Backend
- [ ] Get backend URL from env
  ```typescript
  const goBackendUrl = process.env.GO_BACKEND_URL || 'http://localhost:8080';
  ```
- [ ] Make fetch request
  ```typescript
  const response = await fetch(`${goBackendUrl}/api/prompt-type`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`, // If needed
      },
      body: JSON.stringify({ message }),
  });
  ```
- [ ] Handle response
  ```typescript
  if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
          { error: error || 'Failed to classify prompt type' },
          { status: response.status }
      );
  }
  
  const data = await response.json();
  return NextResponse.json(data);
  ```

#### Add Error Handling
- [ ] Wrap in try-catch
  ```typescript
  try {
      // ... handler code
  } catch (error) {
      console.error('Error in prompt-type API route:', error);
      return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
      );
  }
  ```

**Checkpoint:** API route created ✓

**Commit:** `feat(frontend): add prompt-type API route`

---

### 2.2: Test API Route (15 minutes)

#### Test Locally
- [ ] Start Next.js dev server
  ```bash
  cd chartsmith-app
  npm run dev
  ```
- [ ] Test endpoint with curl or Postman
  ```bash
  curl -X POST http://localhost:3000/api/prompt-type \
    -H "Content-Type: application/json" \
    -d '{"message": "add a new deployment"}'
  ```
- [ ] Verify response format
  ```json
  {"type": "plan"}
  ```
- [ ] Test error cases
  - [ ] Missing message → 400
  - [ ] Unauthorized → 401
  - [ ] Invalid JSON → 400

**Checkpoint:** API route tested ✓

**Commit:** `test(frontend): verify prompt-type API route`

---

## Phase 3: Frontend Migration (1 hour)

### 3.1: Update prompt-type.ts (45 minutes)

#### Remove Anthropic Import
- [ ] Remove import statement
  ```typescript
  // Remove: import Anthropic from '@anthropic-ai/sdk';
  ```

#### Update Function Implementation
- [ ] Replace LLM call with API call
  ```typescript
  export async function promptType(message: string): Promise<PromptType> {
      try {
          const response = await fetch('/api/prompt-type', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ message }),
          });

          if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to classify prompt type');
          }

          const data = await response.json();
          return data.type === 'plan' ? PromptType.Plan : PromptType.Chat;
      } catch (err) {
          logger.error("Error determining prompt type", err);
          throw err;
      }
  }
  ```

#### Keep Types Unchanged
- [ ] Verify `PromptType` enum unchanged
- [ ] Verify `PromptRole` enum unchanged
- [ ] Verify `PromptIntent` interface unchanged

#### Update Error Handling
- [ ] Ensure error messages are clear
- [ ] Maintain same error behavior as before
- [ ] Log errors appropriately

**Checkpoint:** Function updated ✓

**Commit:** `feat(frontend): migrate promptType to use API route`

---

### 3.2: Test Function Works (15 minutes)

#### Test in Browser Console
- [ ] Open browser dev tools
- [ ] Import function
  ```typescript
  import { promptType } from '@/lib/llm/prompt-type';
  ```
- [ ] Test "plan" case
  ```typescript
  await promptType("add a new deployment");
  // Expected: PromptType.Plan
  ```
- [ ] Test "chat" case
  ```typescript
  await promptType("what is kubernetes?");
  // Expected: PromptType.Chat
  ```
- [ ] Test error case
  ```typescript
  await promptType("");
  // Expected: Error thrown
  ```

#### Verify No Regressions
- [ ] Check where function is used
- [ ] Test those use cases
- [ ] Verify behavior identical to before

**Checkpoint:** Function tested ✓

**Commit:** `test(frontend): verify promptType function works`

---

## Phase 4: Dependency Removal (30 minutes)

### 4.1: Remove Package from package.json (10 minutes)

#### Edit package.json
- [ ] Remove `@anthropic-ai/sdk` from dependencies
  ```json
  // Remove this line:
  "@anthropic-ai/sdk": "^0.39.0",
  ```

#### Verify Removal
- [ ] Check no other references to package
  ```bash
  grep -r "@anthropic-ai/sdk" chartsmith-app/
  ```
- [ ] Should only find in package-lock.json (will be removed next)

**Checkpoint:** Package removed from package.json ✓

**Commit:** `chore(frontend): remove @anthropic-ai/sdk dependency`

---

### 4.2: Update Lock File (10 minutes)

#### Run npm install
- [ ] Run install to update lock file
  ```bash
  cd chartsmith-app
  npm install
  ```

#### Verify Lock File Updated
- [ ] Check package-lock.json
- [ ] Verify Anthropic SDK removed
- [ ] Verify no broken dependencies

**Checkpoint:** Lock file updated ✓

**Commit:** `chore(frontend): update package-lock.json`

---

### 4.3: Verify Bundle Size Reduction (10 minutes)

#### Build Application
- [ ] Run production build
  ```bash
  npm run build
  ```

#### Check Bundle Size
- [ ] Note bundle size before (if available)
- [ ] Check current bundle size
- [ ] Verify reduction (~50-100KB expected)
- [ ] Check build output for size changes

#### Verify No SDK in Bundle
- [ ] Search bundle for Anthropic references
  ```bash
  grep -r "anthropic" .next/
  ```
- [ ] Should find no references (or only in source maps)

**Checkpoint:** Bundle size verified ✓

**Commit:** `test(frontend): verify bundle size reduction`

---

## Phase 5: Testing & Verification (1 hour)

### 5.1: Unit Tests (20 minutes)

#### Frontend Tests
- [ ] Create/update test file
  ```typescript
  // chartsmith-app/lib/llm/__tests__/prompt-type.test.ts
  ```
- [ ] Test successful API call
  ```typescript
  it('should return Plan for plan prompts', async () => {
      // Mock fetch
      // Call function
      // Assert result
  });
  ```
- [ ] Test error handling
  ```typescript
  it('should throw error on API failure', async () => {
      // Mock fetch error
      // Call function
      // Assert error thrown
  });
  ```

#### Backend Tests
- [ ] Run Go tests
  ```bash
  go test ./pkg/llm/... -v
  go test ./pkg/api/... -v
  ```
- [ ] Verify all tests pass

**Checkpoint:** Unit tests passing ✓

**Commit:** `test: add comprehensive tests for prompt type`

---

### 5.2: Integration Tests (20 minutes)

#### End-to-End Test
- [ ] Test full flow
  1. Frontend calls `promptType()`
  2. Request goes to `/api/prompt-type`
  3. Request forwarded to Go backend
  4. Go backend calls LLM
  5. Response flows back
- [ ] Verify response format correct
- [ ] Verify classification accurate

#### Error Scenarios
- [ ] Test network failure
- [ ] Test Go backend down
- [ ] Test invalid response
- [ ] Test timeout

**Checkpoint:** Integration tests passing ✓

**Commit:** `test: add integration tests for prompt type`

---

### 5.3: Manual Testing (20 minutes)

#### Test in Application
- [ ] Start dev server
  ```bash
  npm run dev
  ```
- [ ] Test prompt type classification
  - [ ] Create new workspace
  - [ ] Enter prompt that should be "plan"
  - [ ] Verify classification works
  - [ ] Enter prompt that should be "chat"
  - [ ] Verify classification works
- [ ] Check browser console
  - [ ] No errors
  - [ ] No warnings
- [ ] Check network tab
  - [ ] API calls succeed
  - [ ] Response times acceptable

#### Verify No Regressions
- [ ] Test all existing functionality
- [ ] Verify chat still works
- [ ] Verify plan generation still works
- [ ] Verify no visual changes

**Checkpoint:** Manual testing complete ✓

**Commit:** `test: manual testing complete`

---

## Completion Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] Bundle size reduced
- [ ] No Anthropic SDK in codebase
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Ready to merge

---

## Deployment Checklist

### Pre-Deploy
- [ ] All tests pass locally
- [ ] Build succeeds: `npm run build`
- [ ] No build errors/warnings
- [ ] Go backend deployed with new endpoint
- [ ] Environment variables configured

### Deploy to Staging
- [ ] Deploy frontend
- [ ] Deploy Go backend
- [ ] Verify staging works
- [ ] Smoke tests pass

### Deploy to Production
- [ ] Deploy frontend
- [ ] Deploy Go backend
- [ ] Verify production works
- [ ] Monitor for errors (24 hours)

### Post-Deploy
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Verify bundle size reduction
- [ ] Update documentation with production status

---

**PR Complete!** ✅

