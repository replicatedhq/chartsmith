# PR-12: Remove Legacy Chat Streaming

**Branch:** `cleanup/remove-legacy-chat-streaming`
**Dependencies:** PR-08, PR-09, PR-10, PR-11 (All AI SDK features working)
**Parallel With:** PR-13 (can work together after validation)
**Estimated Complexity:** Medium
**Success Criteria:** G2 (Remove @anthropic-ai/sdk), G6 (Tests pass)

---

## Overview

Remove the legacy Centrifugo-based chat streaming infrastructure from the Go backend now that AI SDK streaming is in place. This reduces code complexity and maintenance burden.

## Prerequisites

- PR-08, PR-09, PR-10, PR-11 all merged
- AI SDK chat fully working in production
- Feature flag validated with real traffic
- No regressions identified

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Removal approach | Incremental with verification | Safe removal |
| Centrifugo | Keep for non-chat events | Still used for plans/renders |
| Feature flag | Remove after cleanup | No longer needed |

---

## Pre-Removal Verification

Before starting removal, verify:

1. **AI SDK streaming works end-to-end**
   ```bash
   # Test in staging with feature flag ON
   curl -X POST https://staging.example.com/api/chat \
     -H "Content-Type: application/json" \
     -d '{"messages": [...], "workspaceId": "..."}'
   ```

2. **All existing chat features work**
   - Basic chat responses
   - Tool calling (latest_subchart_version, latest_kubernetes_version)
   - Streaming text display
   - Error handling

3. **Message persistence works**
   - History loads on workspace open
   - New messages save correctly

---

## Step-by-Step Instructions

### Step 1: Identify Legacy Chat Code in Go

Files to review and modify:

```bash
# Find Centrifugo chat-related code
grep -r "centrifugo" pkg/llm/ --include="*.go"
grep -r "PublishChat" pkg/ --include="*.go"
grep -r "ChatChannel" pkg/ --include="*.go"
```

Expected files:
- `pkg/llm/conversational.go` - Legacy streaming
- `pkg/centrifugo/client.go` - May have chat-specific methods
- `pkg/api/handlers/` - Legacy endpoints

### Step 2: Remove Legacy Conversational Streaming

```go
// pkg/llm/conversational.go

// BEFORE: Contains Centrifugo streaming for chat
func StreamConversational(ctx context.Context, ...) error {
    // ... publishes to Centrifugo
}

// AFTER: Remove or mark deprecated
// Delete the StreamConversational function if it's chat-only
// If it handles other cases, extract chat portion

// If this file is ONLY for legacy chat, delete it entirely:
// rm pkg/llm/conversational.go
```

### Step 3: Update or Remove Legacy Chat Handler

```go
// pkg/api/handlers/chat.go (legacy handler)

// BEFORE: Handles chat via Centrifugo
func HandleChat(w http.ResponseWriter, r *http.Request) {
    // ... uses Centrifugo for streaming
}

// AFTER: Remove the handler
// Delete the file or remove the chat handler function
// rm pkg/api/handlers/chat.go

// OR if file has other handlers, just remove chat:
// Delete: func HandleChat(...)
// Keep: func HandleOtherThing(...)
```

### Step 4: Remove Legacy Chat Routes

```go
// pkg/api/router.go or similar

// BEFORE
router.POST("/api/v1/chat", handlers.HandleChat)
router.POST("/api/v1/chat/stream", handlers.HandleChatStream) // New AI SDK
router.POST("/api/v1/workspace/:id/chat", handlers.HandleWorkspaceChat)

// AFTER
// Remove legacy routes, keep AI SDK route
router.POST("/api/v1/chat/stream", handlers.HandleChatStream) // AI SDK
// DELETE: router.POST("/api/v1/chat", handlers.HandleChat)
// DELETE: router.POST("/api/v1/workspace/:id/chat", handlers.HandleWorkspaceChat)
```

### Step 5: Clean Up Centrifugo Chat Channels

If Centrifugo has chat-specific channel logic:

```go
// pkg/centrifugo/client.go

// BEFORE: Has chat channel methods
func (c *Client) PublishChatMessage(workspaceID string, msg Message) error {
    channel := fmt.Sprintf("workspace:%s:chat", workspaceID)
    return c.Publish(channel, msg)
}

// AFTER: Remove chat-specific methods
// DELETE: func (c *Client) PublishChatMessage(...)
// KEEP: func (c *Client) PublishPlanUpdate(...) - Still used for plans
// KEEP: func (c *Client) PublishRenderUpdate(...) - Still used for renders
```

### Step 6: Remove Legacy Message Types

```go
// pkg/llm/types.go or similar

// BEFORE: Chat-specific types for Centrifugo
type CentrifugoChatMessage struct {
    Type    string `json:"type"`
    Content string `json:"content"`
    Done    bool   `json:"done"`
}

// AFTER: Remove if only used for legacy chat
// DELETE: type CentrifugoChatMessage
// KEEP: Any types still used by AI SDK streaming
```

### Step 7: Update Tests

Remove tests for deleted code, update tests for modified code:

```go
// pkg/llm/conversational_test.go
// DELETE this file if conversational.go was deleted

// pkg/api/handlers/chat_test.go
// KEEP tests for chat_stream.go (AI SDK endpoint)
// DELETE tests for legacy chat handler
```

```bash
# Find and review all chat-related tests
grep -r "Chat" pkg/ --include="*_test.go" -l
```

### Step 8: Remove Feature Flag (After Validation)

Once legacy code is removed and verified:

```go
// pkg/config/feature_flags.go

// BEFORE
type FeatureFlags struct {
    EnableAISDKChat bool `envconfig:"ENABLE_AI_SDK_CHAT" default:"false"`
}

// AFTER: Remove the flag (AI SDK is now default)
type FeatureFlags struct {
    // EnableAISDKChat removed - AI SDK is now the only path
}
```

```typescript
// chartsmith-app/lib/config/feature-flags.ts

// BEFORE
export const featureFlags = {
  enableAISDKChat: process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT === 'true',
};

// AFTER: Remove or always return true
export const featureFlags = {
  // enableAISDKChat removed - always use AI SDK
};
```

### Step 9: Update Conditional Rendering

```typescript
// chartsmith-app/components/ChatContainer.tsx

// BEFORE: Conditional based on feature flag
export function ChatContainer(props: ChatContainerProps) {
  if (featureFlags.enableAISDKChat) {
    return <ChatContainerAISDK {...props} />;
  }
  return <LegacyChatContainer {...props} />;
}

// AFTER: Only AI SDK version
export function ChatContainer(props: ChatContainerProps) {
  return <ChatContainerAISDK {...props} />;
}

// Or rename ChatContainerAISDK to ChatContainer
```

### Step 10: Remove Legacy Frontend Components

```bash
# Files to delete (if they exist as separate legacy versions)
rm chartsmith-app/components/LegacyChatContainer.tsx
rm chartsmith-app/components/LegacyChatMessage.tsx
rm chartsmith-app/hooks/useLegacyChat.ts
```

### Step 11: Remove Frontend Centrifugo Chat Subscription

```typescript
// chartsmith-app/hooks/useCentrifugo.ts

// BEFORE: Subscribes to chat channel
useEffect(() => {
  const chatChannel = `workspace:${workspaceId}:chat`;
  const sub = centrifuge.subscribe(chatChannel, handleChatMessage);
  // ...
}, [workspaceId]);

// AFTER: Remove chat subscription, keep plan/render subscriptions
useEffect(() => {
  // KEEP: Plan updates subscription
  const planChannel = `workspace:${workspaceId}:plan`;
  const planSub = centrifuge.subscribe(planChannel, handlePlanUpdate);

  // KEEP: Render updates subscription
  const renderChannel = `workspace:${workspaceId}:render`;
  const renderSub = centrifuge.subscribe(renderChannel, handleRenderUpdate);

  // DELETE: Chat subscription code
}, [workspaceId]);
```

### Step 12: Run Full Test Suite

```bash
# Go tests
cd /path/to/chartsmith
go test ./... -v

# Frontend tests
cd chartsmith-app
npm test

# Build verification
make build
npm run build

# E2E tests if available
npm run test:e2e
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `pkg/llm/conversational.go` | Deleted | Legacy chat streaming |
| `pkg/api/handlers/chat.go` | Deleted/Modified | Legacy handler |
| `pkg/api/router.go` | Modified | Remove legacy routes |
| `pkg/centrifugo/client.go` | Modified | Remove chat methods |
| `pkg/config/feature_flags.go` | Modified | Remove flag |
| `chartsmith-app/lib/config/feature-flags.ts` | Modified | Remove flag |
| `chartsmith-app/components/ChatContainer.tsx` | Modified | Remove conditional |
| `chartsmith-app/hooks/useCentrifugo.ts` | Modified | Remove chat subscription |
| Various `*_test.go` files | Deleted/Modified | Update tests |

---

## Acceptance Criteria

- [ ] Legacy chat streaming code removed from Go
- [ ] Legacy chat handlers removed
- [ ] Legacy routes removed
- [ ] Centrifugo chat channels removed
- [ ] Feature flag removed
- [ ] Frontend conditionals removed
- [ ] Legacy components removed
- [ ] All tests pass
- [ ] Build succeeds
- [ ] E2E chat still works

---

## Verification Checklist

Before marking complete, verify:

- [ ] Can send chat messages
- [ ] Streaming text displays correctly
- [ ] Tool calling works
- [ ] Error handling works
- [ ] Message history loads
- [ ] New messages persist
- [ ] No console errors
- [ ] No 404s to removed endpoints
- [ ] Build times improved (less code)

---

## Testing Instructions

1. Unit tests:
   ```bash
   go test ./... -v
   npm test
   ```

2. Build verification:
   ```bash
   make build
   npm run build
   ```

3. Manual testing:
   - Open workspace
   - Send multiple messages
   - Test tool calling ("What's the latest nginx chart version?")
   - Refresh and verify history
   - Check network tab for clean requests

---

## Rollback Plan

If issues are found:

1. **Git revert** - Revert the cleanup commit
2. **Re-add feature flag** - Set to false to use legacy
3. **Deploy previous version** - Emergency rollback

Keep a backup branch before cleanup:
```bash
git checkout main
git checkout -b backup/pre-cleanup-legacy-chat
git checkout cleanup/remove-legacy-chat-streaming
```

---

## PR Checklist

- [ ] All AI SDK PRs merged and verified
- [ ] Backup branch created
- [ ] Legacy Go code removed
- [ ] Legacy frontend code removed
- [ ] Feature flag removed
- [ ] Tests updated
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Manual verification complete
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- This is a deletion-heavy PR - review for accidental removals
- Centrifugo is still used for plans/renders - only chat removed
- Feature flag removal means no rollback via flag
- Ensure backup branch exists before merge
- Consider deploying to staging first
