# PR#10: Frontend Anthropic SDK Removal

**Estimated Time:** 3-5 hours  
**Complexity:** MEDIUM  
**Dependencies:** PR#4 (New Chat Streaming Endpoint), PR#6 (useChat Hook Implementation)  
**Success Criteria:** G2 (Migrate from @anthropic-ai/sdk to AI SDK Core)

---

## Overview

### What We're Building

This PR completes the frontend migration away from direct Anthropic SDK usage by:

1. **Migrating `promptType()` function** - Move from frontend Anthropic SDK call to Go backend endpoint
2. **Removing `@anthropic-ai/sdk` dependency** - Eliminate the package from `package.json` and bundle
3. **Maintaining functionality** - Ensure prompt type classification works identically to before

### Why It Matters

This PR is the final step in removing Anthropic SDK from the frontend, achieving:
- **Smaller bundle size** - Remove ~50-100KB from frontend bundle
- **Consistency** - All LLM calls go through Go backend, enabling better rate limiting and error handling
- **Provider flexibility** - Backend can switch providers without frontend changes
- **Security** - API keys stay on backend, never exposed to frontend

### Success in One Sentence

"This PR is successful when `promptType()` works without `@anthropic-ai/sdk`, the package is removed from `package.json`, and all functionality remains unchanged."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Migration Path for `promptType()`
**Options Considered:**
1. **Use AI SDK's Anthropic provider** - Keep frontend call, use `@ai-sdk/anthropic` instead
2. **Create Go backend endpoint** - Move logic to Go, frontend calls API
3. **Use existing Go intent classification** - Adapt `GetChatMessageIntent()` for this use case

**Chosen:** Option 2 - Create Go backend endpoint

**Rationale:**
- Consistent with migration strategy (all LLM calls via Go backend)
- Reduces bundle size (no SDK needed)
- Centralizes API key management
- Enables better error handling and retries
- Allows future provider switching without frontend changes

**Trade-offs:**
- Gain: Smaller bundle, better architecture, centralized logic
- Lose: Additional network call (acceptable - this is infrequent)

#### Decision 2: Endpoint Design
**Options Considered:**
1. **New dedicated endpoint** (`/api/prompt-type`) - Simple, clear purpose
2. **Extend existing chat endpoint** - Reuse infrastructure, but mixes concerns
3. **Add to intent classification** - Reuse existing logic, but different use case

**Chosen:** Option 1 - New dedicated endpoint

**Rationale:**
- Clear separation of concerns
- Simple to implement and test
- Easy to optimize independently
- Matches RESTful API patterns

**Trade-offs:**
- Gain: Simplicity, clarity, testability
- Lose: Slight code duplication (minimal)

#### Decision 3: Response Format
**Options Considered:**
1. **Simple string** (`"plan"` or `"chat"`) - Minimal, matches current return type
2. **JSON object** - More extensible, but overkill for this use case
3. **Match AI SDK format** - Consistent with other endpoints, but unnecessary

**Chosen:** Option 1 - Simple string response

**Rationale:**
- Matches current function signature exactly
- Minimal changes to calling code
- Simple to parse and handle
- No need for extensibility (this is a simple classification)

**Trade-offs:**
- Gain: Simplicity, minimal changes
- Lose: Less extensible (acceptable - unlikely to need more)

### Data Model

**No database changes** - This PR only affects API endpoints and frontend code.

### API Design

#### New Endpoint: `/api/prompt-type`

**Request:**
```typescript
POST /api/prompt-type
Content-Type: application/json

{
  "message": "string"  // The user's prompt message
}
```

**Response:**
```typescript
200 OK
Content-Type: application/json

{
  "type": "plan" | "chat"  // Classification result
}
```

**Error Response:**
```typescript
500 Internal Server Error
Content-Type: application/json

{
  "error": "string"  // Error message
}
```

#### Go Backend Implementation

**New Function:**
```go
// pkg/api/prompt_type.go
func HandlePromptType(w http.ResponseWriter, r *http.Request) {
    // Parse request body
    // Call LLM for classification
    // Return JSON response
}
```

**LLM Call:**
- Use existing Anthropic client from `pkg/llm/`
- Reuse system prompt logic (similar to current frontend)
- Return simple "plan" or "chat" classification

### Component Hierarchy

**No component changes** - Only function implementation changes.

```
lib/llm/prompt-type.ts
├── promptType() - Now calls /api/prompt-type instead of Anthropic SDK
└── Types remain unchanged (PromptType enum, PromptIntent interface)
```

---

## Implementation Details

### File Structure

**New Files:**
```
pkg/api/prompt_type.go (~100 lines)
  - HTTP handler for prompt type classification
  - Request/response parsing
  - LLM integration

chartsmith-app/app/api/prompt-type/route.ts (~50 lines)
  - Next.js API route proxy
  - Forwards to Go backend
  - Error handling
```

**Modified Files:**
```
chartsmith-app/lib/llm/prompt-type.ts (~30 lines changed)
  - Remove Anthropic SDK import
  - Replace LLM call with fetch to /api/prompt-type
  - Update error handling

chartsmith-app/package.json (~2 lines changed)
  - Remove "@anthropic-ai/sdk" dependency

chartsmith-app/package-lock.json (~100+ lines changed)
  - Remove Anthropic SDK and dependencies
```

### Key Implementation Steps

#### Phase 1: Go Backend Endpoint (2-3 hours)
1. Create `pkg/api/prompt_type.go` file
2. Implement HTTP handler function
3. Add LLM classification logic (reuse Anthropic client)
4. Add request/response parsing
5. Add error handling
6. Register route in API router
7. Write unit tests

#### Phase 2: Next.js API Route (30 minutes)
1. Create `app/api/prompt-type/route.ts`
2. Implement POST handler
3. Forward request to Go backend
4. Stream response back to client
5. Add error handling
6. Add authentication check

#### Phase 3: Frontend Migration (1 hour)
1. Update `prompt-type.ts` to call API route
2. Remove Anthropic SDK import
3. Update error handling
4. Test function works correctly
5. Verify no regressions

#### Phase 4: Dependency Removal (30 minutes)
1. Remove `@anthropic-ai/sdk` from `package.json`
2. Run `npm install` to update lock file
3. Verify bundle size reduction
4. Check for any remaining imports
5. Clean up unused types if any

### Code Examples

#### Example 1: Go Backend Handler
```go
// pkg/api/prompt_type.go
package api

import (
    "encoding/json"
    "net/http"
    
    "github.com/replicatedhq/chartsmith/pkg/llm"
    "github.com/replicatedhq/chartsmith/pkg/logger"
)

type PromptTypeRequest struct {
    Message string `json:"message"`
}

type PromptTypeResponse struct {
    Type string `json:"type"` // "plan" or "chat"
}

func HandlePromptType(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req PromptTypeRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    if req.Message == "" {
        http.Error(w, "Message is required", http.StatusBadRequest)
        return
    }

    // Call LLM for classification
    promptType, err := llm.ClassifyPromptType(r.Context(), req.Message)
    if err != nil {
        logger.Error("Failed to classify prompt type", err)
        http.Error(w, "Failed to classify prompt type", http.StatusInternalServerError)
        return
    }

    response := PromptTypeResponse{Type: promptType}
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}
```

#### Example 2: LLM Classification Function
```go
// pkg/llm/prompt_type.go (new file)
package llm

import (
    "context"
    "strings"
    
    "github.com/anthropics/anthropic-sdk-go/v2"
    "github.com/replicatedhq/chartsmith/pkg/param"
)

func ClassifyPromptType(ctx context.Context, message string) (string, error) {
    client := anthropic.NewClient(anthropic.WithAPIKey(param.Get().AnthropicAPIKey))
    
    systemPrompt := `You are ChartSmith, an expert at creating Helm charts for Kubernetes.
You are invited to participate in an existing conversation between a user and an expert.
The expert just provided a recommendation on how to plan the Helm chart to the user.
The user is about to ask a question.
You should decide if the user is asking for a change to the plan/chart, or if they are just asking a conversational question.
Be exceptionally brief and precise in your response.
Only say "plan" or "chat" in your response.`

    msg, err := client.Messages.Create(ctx, &anthropic.MessageCreateParams{
        Model:       anthropic.ModelClaude35Sonnet20241022,
        MaxTokens:   1024,
        System:      systemPrompt,
        Messages: []anthropic.MessageParam{
            {Role: anthropic.RoleUser, Content: message},
        },
    })
    
    if err != nil {
        return "", err
    }

    text := ""
    for _, content := range msg.Content {
        if textBlock, ok := content.(anthropic.TextBlock); ok {
            text = textBlock.Text
            break
        }
    }

    if strings.Contains(strings.ToLower(text), "plan") {
        return "plan", nil
    }
    return "chat", nil
}
```

#### Example 3: Next.js API Route
```typescript
// chartsmith-app/app/api/prompt-type/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Forward to Go backend
    const goBackendUrl = process.env.GO_BACKEND_URL || 'http://localhost:8080';
    const response = await fetch(`${goBackendUrl}/api/prompt-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`, // If needed
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to classify prompt type' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in prompt-type API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### Example 4: Updated Frontend Function
```typescript
// chartsmith-app/lib/llm/prompt-type.ts
import { logger } from "@/lib/utils/logger";

export enum PromptType {
  Plan = "plan",
  Chat = "chat",
}

export enum PromptRole {
  Packager = "packager",
  User = "user",
}

export interface PromptIntent {
  intent: PromptType;
  role: PromptRole;
}

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

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- Go handler: Request parsing, error handling, response formatting
- LLM function: Classification logic, error cases
- Frontend function: API call, response parsing, error handling

**Integration Tests:**
- End-to-end: Frontend → API route → Go backend → LLM → Response
- Error scenarios: Network failures, invalid requests, LLM errors

**Edge Cases:**
- Empty message
- Very long message
- Special characters in message
- Network timeout
- LLM API errors
- Invalid JSON responses

**Performance Tests:**
- Response time < 2 seconds (LLM call)
- No memory leaks
- Concurrent requests handled correctly

---

## Success Criteria

**Feature is complete when:**
- [ ] `promptType()` function works without Anthropic SDK
- [ ] `@anthropic-ai/sdk` removed from `package.json`
- [ ] No Anthropic SDK imports in frontend code
- [ ] Bundle size reduced by expected amount (~50-100KB)
- [ ] All existing functionality works identically
- [ ] Tests pass (unit, integration, E2E)
- [ ] No console errors
- [ ] Error handling works correctly

**Performance Targets:**
- Response time: < 2 seconds (same as before)
- Bundle size: Reduced by 50-100KB
- Error rate: < 1% (same as before)

**Quality Gates:**
- Zero regressions
- Test coverage maintained or improved
- No new console errors
- TypeScript strict mode passes

---

## Risk Assessment

### Risk 1: Functionality Regression
**Likelihood:** Medium  
**Impact:** High  
**Mitigation:**
- Comprehensive testing before/after
- Side-by-side comparison of responses
- Feature flag to rollback if needed
- Monitor error rates after deployment

**Status:** 🟡 MEDIUM

### Risk 2: Network Latency
**Likelihood:** Low  
**Impact:** Medium  
**Mitigation:**
- This is an infrequent call (only on initial prompts)
- Network overhead minimal compared to LLM call time
- Can add caching if needed
- Monitor performance metrics

**Status:** 🟢 LOW

### Risk 3: Go Backend Not Ready
**Likelihood:** Low  
**Impact:** High  
**Mitigation:**
- Verify PR#4 is complete before starting
- Check Go backend is deployed
- Test endpoint availability
- Have fallback plan

**Status:** 🟢 LOW

### Risk 4: Bundle Size Not Reduced
**Likelihood:** Low  
**Impact:** Low  
**Mitigation:**
- Verify package removal with `npm ls`
- Check bundle analyzer output
- Ensure no other imports of Anthropic SDK
- Tree-shaking should remove unused code

**Status:** 🟢 LOW

---

## Open Questions

1. **Question 1:** Should we cache prompt type results?
   - **Option A:** No caching - Keep it simple
   - **Option B:** Cache by message hash - Reduce LLM calls
   - **Decision needed by:** Phase 1
   - **Recommendation:** Start without caching, add if needed

2. **Question 2:** Should we use existing `GetChatMessageIntent()` instead?
   - **Option A:** Create new simple function - Matches current behavior exactly
   - **Option B:** Reuse existing function - More complex but unified
   - **Decision needed by:** Phase 1
   - **Recommendation:** Create new simple function for clarity

---

## Timeline

**Total Estimate:** 3-5 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Go Backend Endpoint | 2-3 h | ⏳ |
| 2 | Next.js API Route | 30 min | ⏳ |
| 3 | Frontend Migration | 1 h | ⏳ |
| 4 | Dependency Removal | 30 min | ⏳ |
| 5 | Testing & Verification | 1 h | ⏳ |

---

## Dependencies

**Requires:**
- [ ] PR#4 complete (Go backend has API infrastructure)
- [ ] Go backend deployed and accessible
- [ ] Anthropic API key available in Go backend environment

**Blocks:**
- None (this is a cleanup PR)

**Parallel With:**
- Can work in parallel with other PRs (no conflicts)

---

## References

- Related PR: PR#4 (New Chat Streaming Endpoint)
- Related PR: PR#6 (useChat Hook Implementation)
- PRD: [Vercel AI SDK Migration](../PRD-vercel-ai-sdk-migration.md)
- Current implementation: `chartsmith-app/lib/llm/prompt-type.ts`
- Go intent classification: `pkg/llm/intent.go`

---

## Appendix

### A. Current `promptType()` Usage

The function is currently used to classify user prompts as either:
- **"plan"** - User wants to modify the chart/plan
- **"chat"** - User is asking a conversational question

This classification happens before the main chat flow to determine routing.

### B. Anthropic SDK Removal Impact

**Before:**
- Frontend bundle includes `@anthropic-ai/sdk` (~50-100KB)
- API key potentially exposed in frontend code
- Direct LLM calls from frontend

**After:**
- No Anthropic SDK in frontend bundle
- API keys only on backend
- All LLM calls via backend API

### C. Migration Checklist

- [ ] Go backend endpoint created
- [ ] Next.js API route created
- [ ] Frontend function updated
- [ ] Package removed from package.json
- [ ] Tests written and passing
- [ ] Bundle size verified reduced
- [ ] No remaining imports
- [ ] Documentation updated

