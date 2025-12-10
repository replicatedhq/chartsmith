# PR#9: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (30 minutes)

- [ ] Read main planning document (~45 min)
  - [ ] Read `PR09_REMOVE_FEATURE_FLAGS_LEGACY_CODE.md`
  - [ ] Understand what code to remove
  - [ ] Note dependencies (PR#1-8 must be complete)
- [ ] Prerequisites verified
  - [ ] PR#1-8 all merged and working
  - [ ] AI SDK chat validated in production/staging
  - [ ] Feature flag set to `true` everywhere
  - [ ] No regressions reported
- [ ] Git branch created
  ```bash
  git checkout -b feat/ai-sdk-cleanup
  ```
- [ ] Baseline measurements taken
  - [ ] Run test suite (note pass rate)
  - [ ] Measure bundle size
  - [ ] Check for console errors

**Checkpoint:** Ready to start cleanup ✓

---

## Phase 1: Pre-Removal Verification (30 minutes)

### 1.1: Verify AI SDK Chat Works (10 minutes)

- [ ] Test chat in browser
  - [ ] Send a message
  - [ ] Verify streaming works
  - [ ] Verify response appears correctly
- [ ] Test tool calling
  - [ ] Verify tools are called
  - [ ] Verify tool results appear
- [ ] Test error handling
  - [ ] Verify errors display correctly
- [ ] Check browser console
  - [ ] No errors
  - [ ] No warnings

**Checkpoint:** AI SDK chat working ✓

**Commit:** `test(pr09): verify AI SDK chat before cleanup`

---

### 1.2: Verify Plans/Renders Still Work (10 minutes)

- [ ] Test plan generation
  - [ ] Create a plan
  - [ ] Verify plan updates via Centrifugo
  - [ ] Verify plan appears in UI
- [ ] Test render operations
  - [ ] Trigger a render
  - [ ] Verify render updates via Centrifugo
  - [ ] Verify render status appears
- [ ] Check Centrifugo connections
  - [ ] Verify WebSocket connected
  - [ ] Verify plan channel subscribed
  - [ ] Verify render channel subscribed

**Checkpoint:** Plans/renders working ✓

---

### 1.3: Run Full Test Suite (10 minutes)

- [ ] Run frontend tests
  ```bash
  cd chartsmith-app
  npm test
  ```
- [ ] Run backend tests
  ```bash
  go test ./... -v
  ```
- [ ] Run E2E tests (if available)
  ```bash
  npm run test:e2e
  ```
- [ ] Note test results
  - [ ] All tests passing: Yes/No
  - [ ] Test count: ___
  - [ ] Coverage: ___%

**Checkpoint:** All tests passing ✓

---

## Phase 2: Remove Feature Flag Infrastructure (45 minutes)

### 2.1: Find All Feature Flag References (10 minutes)

- [ ] Search for feature flag imports
  ```bash
  cd chartsmith-app
  grep -r "feature-flags" --include="*.ts" --include="*.tsx"
  grep -r "featureFlags" --include="*.ts" --include="*.tsx"
  grep -r "enableAISDKChat" --include="*.ts" --include="*.tsx"
  grep -r "ENABLE_AI_SDK_CHAT" --include="*.ts" --include="*.tsx" --include="*.env*"
  ```
- [ ] List all files that reference feature flags
  - [ ] File 1: `_________________`
  - [ ] File 2: `_________________`
  - [ ] File 3: `_________________`
  - [ ] File 4: `_________________`
  - [ ] File 5: `_________________`

**Checkpoint:** All references found ✓

---

### 2.2: Remove Feature Flag File (5 minutes)

- [ ] Delete feature flag file
  ```bash
  rm chartsmith-app/lib/config/feature-flags.ts
  ```
- [ ] Delete feature flag tests (if separate)
  ```bash
  rm chartsmith-app/lib/config/__tests__/feature-flags.test.ts
  ```
- [ ] Verify file deleted
  ```bash
  ls chartsmith-app/lib/config/feature-flags.ts
  # Should show: No such file or directory
  ```

**Checkpoint:** Feature flag file deleted ✓

**Commit:** `refactor(pr09): remove feature flag infrastructure`

---

### 2.3: Remove Feature Flag Imports (10 minutes)

- [ ] Remove import from `hooks/useAIChat.ts`
  ```typescript
  // DELETE: import { featureFlags } from '@/lib/config/feature-flags';
  ```
- [ ] Remove import from `components/ChatContainer.tsx`
  ```typescript
  // DELETE: import { featureFlags } from '@/lib/config/feature-flags';
  ```
- [ ] Remove import from any other files found
  - [ ] File: `_________________`
  - [ ] File: `_________________`
- [ ] Verify no import errors
  ```bash
  npx tsc --noEmit
  ```

**Checkpoint:** All imports removed ✓

---

### 2.4: Remove Feature Flag Conditionals (15 minutes)

- [ ] Update `hooks/useAIChat.ts`
  ```typescript
  // BEFORE:
  if (featureFlags.enableAISDKChat) {
    return useChat({ ... });
  }
  return useLegacyChat({ ... });
  
  // AFTER:
  return useChat({ ... });
  ```
- [ ] Update `components/ChatContainer.tsx`
  ```typescript
  // BEFORE:
  if (featureFlags.enableAISDKChat) {
    return <ChatContainerAISDK />;
  }
  return <LegacyChatContainer />;
  
  // AFTER:
  return <ChatContainerAISDK />;
  ```
- [ ] Update any other conditionals found
  - [ ] File: `_________________`
  - [ ] File: `_________________`
- [ ] Verify code compiles
  ```bash
  npm run build
  ```

**Checkpoint:** All conditionals removed ✓

**Commit:** `refactor(pr09): remove feature flag conditionals`

---

### 2.5: Remove Environment Variable References (5 minutes)

- [ ] Update `.env.example`
  ```bash
  # DELETE: NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=false
  ```
- [ ] Update `.env.local` (if exists)
  ```bash
  # DELETE: NEXT_PUBLIC_ENABLE_AI_SDK_CHAT=true
  ```
- [ ] Update TypeScript env types (if exists)
  ```typescript
  // DELETE: NEXT_PUBLIC_ENABLE_AI_SDK_CHAT?: string;
  ```
- [ ] Search for any remaining references
  ```bash
  grep -r "ENABLE_AI_SDK_CHAT" --include="*"
  ```

**Checkpoint:** Environment variables removed ✓

**Commit:** `refactor(pr09): remove feature flag environment variables`

---

## Phase 3: Remove Legacy Frontend Code (1 hour)

### 3.1: Remove Centrifugo Chat Subscription (20 minutes)

- [ ] Open `hooks/useCentrifugo.ts`
- [ ] Find chat channel subscription
  ```typescript
  // FIND: const chatChannel = `workspace:${workspaceId}:chat`;
  ```
- [ ] Remove chat subscription code
  ```typescript
  // DELETE:
  const chatChannel = `workspace:${workspaceId}:chat`;
  const chatSub = centrifuge.subscribe(chatChannel, handleChatMessageUpdated);
  ```
- [ ] Remove chat unsubscribe
  ```typescript
  // DELETE: chatSub.unsubscribe();
  ```
- [ ] Keep plan/render subscriptions
  ```typescript
  // KEEP: plan subscription
  // KEEP: render subscription
  ```
- [ ] Verify code compiles
  ```bash
  npx tsc --noEmit
  ```

**Checkpoint:** Chat subscription removed ✓

**Commit:** `refactor(pr09): remove Centrifugo chat subscription`

---

### 3.2: Update handleChatMessageUpdated (15 minutes)

- [ ] Review `handleChatMessageUpdated` function
- [ ] Determine if still needed
  - [ ] If only used for render tracking: KEEP and rename
  - [ ] If used for chat messages: REMOVE
- [ ] If keeping for render tracking:
  ```typescript
  // RENAME: handleChatMessageUpdated -> handleRenderTracking
  // REMOVE: chat message handling logic
  // KEEP: render ID tracking logic
  ```
- [ ] If removing entirely:
  ```typescript
  // DELETE: entire function
  ```
- [ ] Update references
  - [ ] Remove from subscription (if deleted)
  - [ ] Update call sites (if renamed)

**Checkpoint:** Function updated/removed ✓

**Commit:** `refactor(pr09): update or remove handleChatMessageUpdated`

---

### 3.3: Remove Legacy Chat Components (10 minutes)

- [ ] Search for legacy components
  ```bash
  find chartsmith-app/components -name "*Legacy*" -o -name "*legacy*"
  ```
- [ ] Delete legacy chat components (if exist)
  ```bash
  rm chartsmith-app/components/LegacyChatContainer.tsx
  rm chartsmith-app/components/LegacyChatMessage.tsx
  ```
- [ ] Search for legacy hooks
  ```bash
  find chartsmith-app/hooks -name "*Legacy*" -o -name "*legacy*"
  ```
- [ ] Delete legacy hooks (if exist)
  ```bash
  rm chartsmith-app/hooks/useLegacyChat.ts
  ```
- [ ] Verify no import errors
  ```bash
  npx tsc --noEmit
  ```

**Checkpoint:** Legacy components removed ✓

**Commit:** `refactor(pr09): remove legacy chat components`

---

### 3.4: Clean Up useAIChat Hook (15 minutes)

- [ ] Open `hooks/useAIChat.ts`
- [ ] Remove feature flag check (if not done in Phase 2)
- [ ] Remove legacy implementation path
- [ ] Simplify hook to only use AI SDK
  ```typescript
  // BEFORE: Complex conditional logic
  // AFTER: Direct useChat usage
  ```
- [ ] Remove unused imports
- [ ] Remove unused types
- [ ] Verify hook works
  ```bash
  npm run build
  ```

**Checkpoint:** Hook cleaned up ✓

**Commit:** `refactor(pr09): simplify useAIChat hook`

---

## Phase 4: Remove Legacy Backend Code (1 hour)

### 4.1: Find Legacy Go Chat Code (15 minutes)

- [ ] Search for legacy streaming code
  ```bash
  cd /path/to/chartsmith
  grep -r "Centrifugo.*chat" --include="*.go"
  grep -r "PublishChat" --include="*.go"
  grep -r "ChatChannel" --include="*.go"
  grep -r "conversational.*stream" --include="*.go" -i
  ```
- [ ] List files to modify
  - [ ] File 1: `_________________`
  - [ ] File 2: `_________________`
  - [ ] File 3: `_________________`
- [ ] Review each file
  - [ ] Identify legacy code paths
  - [ ] Identify code to keep (plans/renders)

**Checkpoint:** Legacy code identified ✓

---

### 4.2: Remove Legacy Conversational Streaming (20 minutes)

- [ ] Open `pkg/listener/conversational.go` (or equivalent)
- [ ] Find legacy streaming function
  ```go
  // FIND: func StreamConversationalViaCentrifugo(...)
  ```
- [ ] Remove legacy streaming code
  ```go
  // DELETE: Centrifugo publishing for chat
  // KEEP: Any code used for plans/renders
  ```
- [ ] Remove feature flag check (if exists)
  ```go
  // DELETE: if !isAISDKEnabled() { ... }
  ```
- [ ] Simplify to AI SDK only
  ```go
  // AFTER: Direct AI SDK streaming
  ```
- [ ] Verify Go compiles
  ```bash
  go build ./...
  ```

**Checkpoint:** Legacy streaming removed ✓

**Commit:** `refactor(pr09): remove legacy conversational streaming`

---

### 4.3: Remove Legacy Chat Routes (10 minutes)

- [ ] Find route definitions
  ```bash
  grep -r "chat" pkg/api/ --include="*.go" -i
  ```
- [ ] Identify legacy routes
  - [ ] Route 1: `_________________`
  - [ ] Route 2: `_________________`
- [ ] Remove legacy routes
  ```go
  // DELETE: router.POST("/api/v1/chat", handlers.HandleLegacyChat)
  // KEEP: router.POST("/api/v1/chat/stream", handlers.HandleChatStream)
  ```
- [ ] Remove legacy handlers (if separate file)
  ```bash
  rm pkg/api/handlers/legacy_chat.go
  ```
- [ ] Verify routes compile
  ```bash
  go build ./pkg/api/...
  ```

**Checkpoint:** Legacy routes removed ✓

**Commit:** `refactor(pr09): remove legacy chat routes`

---

### 4.4: Clean Up Centrifugo Client (15 minutes)

- [ ] Open `pkg/realtime/centrifugo.go` (or equivalent)
- [ ] Find chat-specific methods
  ```go
  // FIND: func PublishChatMessage(...)
  ```
- [ ] Remove chat-specific methods
  ```go
  // DELETE: func PublishChatMessage(...)
  ```
- [ ] Keep plan/render methods
  ```go
  // KEEP: func PublishPlanUpdate(...)
  // KEEP: func PublishRenderUpdate(...)
  ```
- [ ] Remove unused imports
- [ ] Verify Go compiles
  ```bash
  go build ./...
  ```

**Checkpoint:** Centrifugo client cleaned ✓

**Commit:** `refactor(pr09): remove chat methods from Centrifugo client`

---

## Phase 5: Cleanup & Verification (1 hour)

### 5.1: Remove Unused Imports (15 minutes)

- [ ] Run linter
  ```bash
  cd chartsmith-app
  npm run lint
  ```
- [ ] Fix unused import warnings
  - [ ] File 1: `_________________`
  - [ ] File 2: `_________________`
- [ ] Run Go linter
  ```bash
  golangci-lint run ./...
  ```
- [ ] Fix unused import warnings
  - [ ] File 1: `_________________`
  - [ ] File 2: `_________________`

**Checkpoint:** Unused imports removed ✓

**Commit:** `refactor(pr09): remove unused imports`

---

### 5.2: Remove Unused Types (10 minutes)

- [ ] Search for unused types
  ```bash
  # Look for types only used in deleted code
  ```
- [ ] Remove unused types
  - [ ] Type 1: `_________________`
  - [ ] Type 2: `_________________`
- [ ] Verify TypeScript compiles
  ```bash
  npx tsc --noEmit
  ```

**Checkpoint:** Unused types removed ✓

**Commit:** `refactor(pr09): remove unused types`

---

### 5.3: Run Full Test Suite (20 minutes)

- [ ] Run frontend tests
  ```bash
  cd chartsmith-app
  npm test
  ```
- [ ] Verify all tests pass
  - [ ] Pass rate: ___%
  - [ ] Failed tests: ___
- [ ] Run backend tests
  ```bash
  go test ./... -v
  ```
- [ ] Verify all tests pass
  - [ ] Pass rate: ___%
  - [ ] Failed tests: ___
- [ ] Run E2E tests (if available)
  ```bash
  npm run test:e2e
  ```
- [ ] Fix any failing tests
  - [ ] Test 1: `_________________`
  - [ ] Test 2: `_________________`

**Checkpoint:** All tests passing ✓

**Commit:** `test(pr09): verify all tests pass after cleanup`

---

### 5.4: Verify Bundle Size Reduction (10 minutes)

- [ ] Build production bundle
  ```bash
  cd chartsmith-app
  npm run build
  ```
- [ ] Measure bundle size
  - [ ] Before: ___ KB
  - [ ] After: ___ KB
  - [ ] Reduction: ___ KB
- [ ] Verify reduction
  - [ ] Expected: 50-100KB reduction
  - [ ] Actual: ___ KB reduction

**Checkpoint:** Bundle size reduced ✓

---

### 5.5: Manual Testing (15 minutes)

- [ ] Test chat functionality
  - [ ] Send message
  - [ ] Verify streaming
  - [ ] Verify response
- [ ] Test tool calling
  - [ ] Verify tools work
- [ ] Test plans
  - [ ] Create plan
  - [ ] Verify plan updates
- [ ] Test renders
  - [ ] Trigger render
  - [ ] Verify render updates
- [ ] Check browser console
  - [ ] No errors
  - [ ] No warnings

**Checkpoint:** Manual testing complete ✓

**Commit:** `test(pr09): manual testing complete`

---

### 5.6: Update Documentation (10 minutes)

- [ ] Update ARCHITECTURE.md
  - [ ] Remove feature flag references
  - [ ] Update chat architecture section
- [ ] Update CONTRIBUTING.md (if needed)
  - [ ] Remove feature flag setup instructions
- [ ] Update README.md (if needed)
  - [ ] Remove feature flag mentions
- [ ] Update code comments
  - [ ] Remove outdated comments
  - [ ] Update relevant comments

**Checkpoint:** Documentation updated ✓

**Commit:** `docs(pr09): update documentation after cleanup`

---

## Testing Phase (30 minutes)

### Unit Tests
- [ ] Verify feature flag file doesn't exist
- [ ] Verify no feature flag imports
- [ ] Verify useAIChat works without flag
- [ ] Verify Centrifugo still works for plans/renders

### Integration Tests
- [ ] Chat flow works end-to-end
- [ ] Plans still update via Centrifugo
- [ ] Renders still update via Centrifugo
- [ ] No regressions in existing functionality

### Manual Testing
- [ ] Chat works in browser
- [ ] Streaming works correctly
- [ ] Plans appear correctly
- [ ] Renders appear correctly
- [ ] No console errors
- [ ] No TypeScript errors

### Performance Testing
- [ ] Bundle size: ___ KB (target: reduced by 50-100KB) ✓
- [ ] Test pass rate: ___% (target: 100%) ✓

---

## Bug Fixing (If needed)

### Bug #1: [Title]
- [ ] Reproduced
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Tested
- [ ] Documented in bug analysis doc

---

## Documentation Phase (10 minutes)

- [ ] JSDoc comments updated
- [ ] README updated (if needed)
- [ ] ARCHITECTURE.md updated
- [ ] Code comments updated

---

## Deployment Phase (Optional - if deploying)

### Pre-Deploy Checklist
- [ ] All tests passing
- [ ] No console errors
- [ ] Build successful locally
- [ ] Bundle size acceptable

### Deploy to Staging
- [ ] Build: `npm run build`
- [ ] Deploy: `[deploy command]`
- [ ] Verify staging works
- [ ] Smoke tests pass

### Deploy to Production
- [ ] Build production
- [ ] Deploy to production
- [ ] Verify production works
- [ ] Monitor for errors (24 hours)

---

## Completion Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] Bundle size reduced
- [ ] No console errors
- [ ] Documentation updated
- [ ] Code review approved
- [ ] Ready to merge
- [ ] Celebration! 🎉

---

**Total Time:** ___ hours (estimated: 3-5 hours)

