# Product Requirements Document: Vercel AI SDK Migration

**Document Version:** 1.0
**Last Updated:** December 9, 2025
**Author:** Engineering Team
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Background & Motivation](#background--motivation)
3. [Goals & Non-Goals](#goals--non-goals)
4. [Technical Strategy](#technical-strategy)
5. [Epics & User Stories](#epics--user-stories)
6. [PR Structure & Implementation Plan](#pr-structure--implementation-plan)
7. [Success Metrics](#success-metrics)
8. [Risks & Mitigations](#risks--mitigations)
9. [Dependencies](#dependencies)
10. [Appendix](#appendix)

---

## Executive Summary

This PRD outlines the migration of Chartsmith's chat and LLM implementation from a custom Anthropic SDK integration to the Vercel AI SDK. The migration will modernize our frontend chat experience using the `useChat` hook while preserving our proven Go backend LLM orchestration by implementing the AI SDK Data Stream Protocol.

**Key Decision:** We will pursue **Option A (Keep Go Backend)** — adapting our Go streaming infrastructure to output the Vercel AI SDK Data Stream Protocol format, rather than rewriting LLM logic in TypeScript.

**Expected Outcome:** A cleaner, more maintainable chat implementation with industry-standard patterns, improved streaming UX, and the foundation for easy provider switching in the future.

### Project Constraints & Considerations

This is a **refactoring project** with clear before/after states. The following considerations guide this work:

| Consideration | How This PRD Addresses It |
|---------------|---------------------------|
| **Design Flexibility** | The approach (Option A: Keep Go Backend) is documented with alternatives evaluated. See [Decision Analysis](#decision-analysis) in the companion architecture document. |
| **Architecture Decisions** | All significant decisions are documented with rationale. The choice to keep Go backend vs. moving to Next.js API routes is explicitly justified. |
| **Trade-offs** | Each major trade-off is documented in [Trade-offs & Reasoning](#trade-offs--reasoning) in the companion architecture document. |

**Companion Document:** See `docs/architecture-comparison.md` for detailed before/after architecture diagrams, component-by-component comparisons, and decision analysis.

---

## Background & Motivation

### Current State

Chartsmith currently uses a custom implementation for LLM interactions:

- **Frontend:** Custom chat components (`ChatContainer.tsx`, `ChatMessage.tsx`) with manual state management via Jotai atoms
- **Backend:** Go worker processes LLM requests using `github.com/anthropics/anthropic-sdk-go`
- **Realtime:** Centrifugo WebSocket pub/sub for streaming responses from Go to frontend
- **Providers:** Anthropic (Claude) for generation, Groq (Llama) for intent classification, Voyage for embeddings

### Pain Points

1. **Custom streaming logic** — We maintain bespoke code for SSE-like streaming that could use standard patterns
2. **Tight coupling** — Chat UI is tightly coupled to our specific message format and Centrifugo events
3. **Provider lock-in** — Switching LLM providers requires significant refactoring
4. **Missing optimizations** — No built-in support for optimistic updates, automatic retries, or stream recovery

### Why Vercel AI SDK?

1. **Industry standard** — Widely adopted, well-documented, actively maintained
2. **React-first** — `useChat` hook provides excellent DX with built-in state management
3. **Provider agnostic** — Easy switching between Anthropic, OpenAI, Google, and others
4. **Streaming optimized** — Built-in support for the Data Stream Protocol with tool calls
5. **Go compatibility** — `coder/aisdk-go` library enables Go backends to speak the same protocol

---

## Goals & Non-Goals

### Must Have Goals

These are the required success criteria for this migration:

| ID | Goal | Success Criteria | Validation Method |
|----|------|------------------|-------------------|
| G1 | Replace custom chat UI with Vercel AI SDK | `ChatContainer` and `ChatMessage` use `useChat` hook | Code review, manual testing |
| G2 | Migrate from direct `@anthropic-ai/sdk` usage to AI SDK Core | No direct Anthropic SDK imports in frontend | Bundle analysis, grep check |
| G3 | Maintain all existing chat functionality | Streaming, messages, and history work identically | E2E tests, manual QA |
| G4 | Keep existing system prompts and behavior | User roles (auto/developer/operator), chart context preserved | Regression tests |
| G5 | All existing features continue to work | Tool calling, file context, plan generation work | Feature-specific tests |
| G6 | Tests pass or are updated | CI/CD green, no coverage regression | Test reports |

### Nice-to-Have Goals

| ID | Goal | Success Criteria | Validation Method |
|----|------|------------------|-------------------|
| N1 | Demonstrate easy provider switching | Document showing how to swap Anthropic for OpenAI | Documentation review |
| N2 | Improve streaming experience using AI SDK optimizations | Faster time-to-first-token, smoother rendering | Performance benchmarks |
| N3 | Simplify state management with AI SDK patterns | Reduced lines of code in chat components | Code metrics |

### Success Criteria Traceability Matrix

| Success Criterion | Epic | User Stories | PRs |
|-------------------|------|--------------|-----|
| G1: Replace chat UI with AI SDK | Epic 1, 3 | US-1.1, US-3.4, US-3.5 | PR 1, 6, 7 |
| G2: Migrate from @anthropic-ai/sdk | Epic 5 | US-5.2 | PR 10 |
| G3: Maintain chat functionality | Epic 2, 3 | US-2.4, US-3.2, US-3.3 | PR 3, 4, 5, 6 |
| G4: Keep system prompts/behavior | Epic 2 | US-2.5 (new) | PR 3, 4 |
| G5: Existing features work | Epic 4 | US-4.1, US-4.2, US-4.3 | PR 8 |
| G6: Tests pass | Epic 5 | US-5.3 | PR 11 |
| N1: Provider switching | Epic 6 | US-6.1, US-6.2 | PR 12 |
| N2: Improved streaming | Epic 3 | US-3.6 (new) | PR 6, 7 |
| N3: Simplified state | Epic 1 | US-1.4 (new) | PR 1, 6 |

### Non-Goals

| ID | Non-Goal | Rationale |
|----|----------|-----------|
| NG1 | Rewrite Go LLM logic in TypeScript | Too risky, Go logic is proven and complex |
| NG2 | Change Helm execution architecture | Out of scope, works well |
| NG3 | Migrate embeddings/vector search | Voyage integration stays in Go |
| NG4 | Replace Centrifugo entirely | Still needed for non-chat events (plans, renders) |
| NG5 | Change authentication/authorization | Out of scope |

---

## Technical Strategy

### Architecture: Before & After

```
BEFORE:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Chat    │────▶│   Server Action │────▶│   PostgreSQL    │
│   Components    │     │   + pg_notify   │     │   work_queue    │
└────────▲────────┘     └─────────────────┘     └────────┬────────┘
         │                                               │
         │ Centrifugo                                    ▼
         │ WebSocket                            ┌─────────────────┐
         │                                      │    Go Worker    │
         └──────────────────────────────────────│  (Anthropic SDK)│
                                                └─────────────────┘

AFTER:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   useChat Hook  │────▶│  /api/chat      │────▶│    Go Worker    │
│   (AI SDK)      │◀────│  (proxy/stream) │◀────│  (aisdk-go)     │
└────────▲────────┘     └─────────────────┘     └─────────────────┘
         │
         │ Centrifugo (non-chat events only)
         │
┌────────┴────────┐
│  Plan/Render    │
│  Updates        │
└─────────────────┘
```

### Key Technical Decisions

1. **Go backend stays** — Use `coder/aisdk-go` to output AI SDK Data Stream Protocol
2. **New API route** — Create `/api/chat` endpoint that proxies to Go worker
3. **Hybrid approach** — `useChat` for chat, Centrifugo for plans/renders/artifacts
4. **Feature flags** — Roll out incrementally with ability to rollback
5. **Preserve message format** — Adapt AI SDK messages to our existing DB schema

---

## Epics & User Stories

### Epic 1: Frontend Foundation

**Description:** Set up the Vercel AI SDK infrastructure on the frontend without changing existing functionality.

#### User Stories

**US-1.1: Install AI SDK Dependencies**
> As a developer, I want the AI SDK packages installed so that I can start building with `useChat`.

**Acceptance Criteria:**
- [ ] `@ai-sdk/react` package installed
- [ ] `ai` package installed
- [ ] `@ai-sdk/anthropic` package installed (for future use)
- [ ] No breaking changes to existing functionality
- [ ] Package versions pinned in package.json

**US-1.2: Create Chat Hook Abstraction**
> As a developer, I want an abstraction layer over chat functionality so that we can swap implementations without changing components.

**Acceptance Criteria:**
- [ ] New `useAIChat.ts` hook created
- [ ] Hook exposes same interface whether using old or new implementation
- [ ] Feature flag controls which implementation is active
- [ ] TypeScript types defined for chat interface

**US-1.3: Feature Flag Infrastructure**
> As a developer, I want a feature flag to toggle between old and new chat implementations so that we can safely roll out changes.

**Acceptance Criteria:**
- [ ] Environment variable `ENABLE_AI_SDK_CHAT` controls feature
- [ ] Flag defaults to `false` (old implementation)
- [ ] Flag can be toggled without code changes
- [ ] Both paths have test coverage

**US-1.4: Simplify State Management** *(Nice-to-Have N3)*
> As a developer, I want to leverage AI SDK's built-in state management patterns so that we have less custom code to maintain.

**Acceptance Criteria:**
- [ ] Chat message state managed by `useChat` instead of custom Jotai atoms
- [ ] Loading/streaming state from `useChat`'s `isLoading` instead of custom atoms
- [ ] Error handling via `useChat`'s `error` state instead of try/catch
- [ ] Input state managed by `useChat` instead of `useState`
- [ ] Reduced lines of code in chat-related components (measurable via git diff)
- [ ] Chat-specific Jotai atoms removed or simplified

---

### Epic 2: Go Backend AI SDK Protocol

**Description:** Implement the Vercel AI SDK Data Stream Protocol in the Go worker.

#### User Stories

**US-2.1: Add aisdk-go Dependency**
> As a developer, I want the aisdk-go library available so that I can output AI SDK compatible streams.

**Acceptance Criteria:**
- [ ] `github.com/coder/aisdk-go` added to go.mod
- [ ] Library compiles and is accessible
- [ ] No conflicts with existing dependencies

**US-2.2: Create AI SDK Stream Adapter**
> As a developer, I want an adapter that converts our Anthropic streaming to AI SDK format so that the frontend can consume it.

**Acceptance Criteria:**
- [ ] New `pkg/llm/aisdk.go` file created
- [ ] Adapter handles text streaming
- [ ] Adapter handles tool calls
- [ ] Adapter handles tool results
- [ ] Unit tests for adapter logic

**US-2.3: New Streaming Endpoint**
> As a developer, I want a new HTTP endpoint that streams AI SDK formatted responses so that `useChat` can connect to it.

**Acceptance Criteria:**
- [ ] Endpoint accepts POST with messages array
- [ ] Endpoint streams AI SDK Data Stream Protocol
- [ ] Endpoint handles authentication
- [ ] Endpoint handles errors gracefully
- [ ] Endpoint logs appropriately

**US-2.4: Conversational Chat Migration**
> As a user, I want my conversational questions to stream using the new protocol so that I get the improved experience.

**Acceptance Criteria:**
- [ ] `ConversationalChatMessage` outputs AI SDK format when flag enabled
- [ ] Tool calls (`latest_subchart_version`, `latest_kubernetes_version`) work
- [ ] Response streams to frontend correctly
- [ ] Messages saved to database correctly

**US-2.5: Preserve System Prompts and Behavior** *(Success Criterion G4)*
> As a user, I want my existing system prompts, user roles, and chart context to work exactly as before so that AI responses maintain the same quality and relevance.

**Acceptance Criteria:**
- [ ] All system prompts from `pkg/llm/system.go` are preserved unchanged
- [ ] User role selection (auto/developer/operator) continues to affect prompt context
- [ ] Chart structure context is included in prompts as before
- [ ] Relevant file selection via embeddings works unchanged
- [ ] Previous chat history is included in context correctly
- [ ] Regression tests validate prompt behavior matches

---

### Epic 3: Frontend-Backend Integration

**Description:** Connect the frontend `useChat` hook to the Go backend streaming endpoint.

#### User Stories

**US-3.1: Create API Route Proxy**
> As a developer, I want a Next.js API route that proxies to the Go streaming endpoint so that `useChat` has a standard endpoint.

**Acceptance Criteria:**
- [ ] `/api/chat` route created
- [ ] Route forwards requests to Go worker
- [ ] Route streams responses back to client
- [ ] Route handles authentication
- [ ] Route handles CORS if needed

**US-3.2: Wire useChat to Backend**
> As a developer, I want `useChat` configured to use our backend so that chat messages flow through the new system.

**Acceptance Criteria:**
- [ ] `useChat` hook configured with `/api/chat` endpoint
- [ ] Messages send correctly
- [ ] Responses stream correctly
- [ ] Error states handled
- [ ] Loading states work

**US-3.3: Message Format Adaptation**
> As a developer, I want AI SDK messages converted to our database format so that message history continues to work.

**Acceptance Criteria:**
- [ ] AI SDK message format mapped to `workspace_chat` schema
- [ ] Historical messages load correctly
- [ ] New messages save correctly
- [ ] Message IDs preserved/generated correctly

**US-3.4: Migrate ChatContainer Component**
> As a user, I want the chat input to use the new `useChat` hook so that I get the improved typing experience.

**Acceptance Criteria:**
- [ ] `ChatContainer.tsx` uses `useChat` when flag enabled
- [ ] Input handling works identically
- [ ] Submit on Enter works
- [ ] Role selector continues to work
- [ ] Disabled state during streaming works

**US-3.5: Migrate ChatMessage Component**
> As a user, I want chat messages to display correctly with the new system so that I can read AI responses.

**Acceptance Criteria:**
- [ ] `ChatMessage.tsx` renders AI SDK messages
- [ ] Streaming text displays incrementally
- [ ] Markdown rendering works
- [ ] Plan references work
- [ ] Render references work

**US-3.6: Improve Streaming Experience** *(Nice-to-Have N2)*
> As a user, I want faster and smoother streaming responses so that the chat feels more responsive.

**Acceptance Criteria:**
- [ ] Time-to-first-token is same or better than current implementation
- [ ] Token rendering is smooth without jank or flicker
- [ ] AI SDK's built-in streaming optimizations are utilized
- [ ] Performance benchmark shows improvement or parity

---

### Epic 4: Tool Calling Migration

**Description:** Ensure all tool calling functionality works with the AI SDK protocol.

#### User Stories

**US-4.1: Adapt Tool Definitions**
> As a developer, I want tool definitions compatible with AI SDK so that Claude can still use tools.

**Acceptance Criteria:**
- [ ] Tool schemas output in AI SDK format
- [ ] Tool names preserved
- [ ] Tool descriptions preserved
- [ ] Input schemas preserved

**US-4.2: Stream Tool Calls**
> As a user, I want to see when tools are being called so that I understand what the AI is doing.

**Acceptance Criteria:**
- [ ] Tool call events stream to frontend
- [ ] Tool name visible in UI (if applicable)
- [ ] Tool results incorporated into response

**US-4.3: Text Editor Tool Migration**
> As a user, I want file editing via the text_editor tool to continue working so that plans can be executed.

**Acceptance Criteria:**
- [ ] `text_editor` tool calls stream correctly
- [ ] `view` command works
- [ ] `str_replace` command works
- [ ] `create` command works
- [ ] Fuzzy matching preserved

---

### Epic 5: Cleanup & Polish

**Description:** Remove legacy code, update tests, and finalize the migration.

#### User Stories

**US-5.1: Remove Old Streaming Code**
> As a developer, I want old streaming code removed so that we don't maintain two implementations.

**Acceptance Criteria:**
- [ ] Old Centrifugo chat streaming removed
- [ ] Old chat message handlers removed
- [ ] Feature flags removed (default to new)
- [ ] Dead code eliminated

**US-5.2: Migrate promptType to AI SDK**
> As a developer, I want the frontend `promptType()` function to use AI SDK so that we can remove `@anthropic-ai/sdk` from the frontend.

**Acceptance Criteria:**
- [ ] `chartsmith-app/lib/llm/prompt-type.ts` uses AI SDK
- [ ] `@anthropic-ai/sdk` removed from frontend package.json
- [ ] Functionality unchanged

**US-5.3: Update Tests**
> As a developer, I want tests updated for the new implementation so that we maintain quality.

**Acceptance Criteria:**
- [ ] Unit tests for new hooks
- [ ] Integration tests for chat flow
- [ ] E2E tests pass
- [ ] Test coverage maintained or improved

**US-5.4: Update Documentation**
> As a developer, I want documentation updated so that the team understands the new architecture.

**Acceptance Criteria:**
- [ ] ARCHITECTURE.md updated
- [ ] CONTRIBUTING.md updated if needed
- [ ] Code comments added where helpful
- [ ] Migration notes documented

---

### Epic 6: Provider Flexibility (Nice-to-Have)

**Description:** Demonstrate and document provider switching capability.

#### User Stories

**US-6.1: Provider Configuration**
> As an operator, I want to configure which LLM provider to use so that I can choose based on cost/performance.

**Acceptance Criteria:**
- [ ] Environment variable for provider selection
- [ ] Go adapter supports multiple providers
- [ ] Default remains Anthropic Claude

**US-6.2: Provider Switching Documentation**
> As a developer, I want documentation on how to switch providers so that future changes are easy.

**Acceptance Criteria:**
- [ ] README section on provider configuration
- [ ] Example showing OpenAI configuration
- [ ] Notes on provider-specific considerations

---

## PR Structure & Implementation Plan

### Phase 1: Foundation (Week 1-2)

#### PR 1: Frontend AI SDK Setup
**Branch:** `feat/ai-sdk-frontend-foundation`

**Scope:**
- Install packages (`@ai-sdk/react`, `ai`)
- Create `useAIChat.ts` hook shell
- Add feature flag infrastructure
- No functional changes

**Files Changed:**
```
chartsmith-app/package.json
chartsmith-app/package-lock.json
chartsmith-app/hooks/useAIChat.ts (new)
chartsmith-app/lib/config/feature-flags.ts (new)
```

**Testing:**
- Existing tests pass
- New hook compiles
- Feature flag works

**Reviewer Checklist:**
- [ ] Packages at latest stable versions
- [ ] No security vulnerabilities introduced
- [ ] TypeScript types correct
- [ ] Feature flag defaults to off

---

#### PR 2: Go AI SDK Library Integration
**Branch:** `feat/ai-sdk-go-foundation`

**Scope:**
- Add `coder/aisdk-go` dependency
- Create adapter shell in `pkg/llm/aisdk.go`
- Add types for AI SDK protocol
- No functional changes

**Files Changed:**
```
go.mod
go.sum
pkg/llm/aisdk.go (new)
pkg/llm/aisdk_test.go (new)
pkg/llm/types/aisdk.go (new)
```

**Testing:**
- Go builds successfully
- Unit tests for type conversions
- No impact on existing functionality

**Reviewer Checklist:**
- [ ] aisdk-go version pinned
- [ ] Adapter interface well-defined
- [ ] Types match AI SDK spec
- [ ] Tests cover edge cases

---

### Phase 2: Backend Protocol (Week 2-3)

#### PR 3: AI SDK Streaming Adapter
**Branch:** `feat/ai-sdk-streaming-adapter`

**Scope:**
- Implement text streaming in AI SDK format
- Implement tool call streaming
- Implement tool result streaming
- Unit tests for all scenarios

**Files Changed:**
```
pkg/llm/aisdk.go
pkg/llm/aisdk_test.go
pkg/llm/conversational.go (add adapter call path)
```

**Testing:**
- Unit tests for each stream type
- Integration test with mock Anthropic response
- Verify protocol compliance

**Reviewer Checklist:**
- [ ] Protocol matches AI SDK spec exactly
- [ ] Error handling comprehensive
- [ ] Streaming is efficient (no buffering)
- [ ] Tests cover tool calling scenarios

---

#### PR 4: New Chat Streaming Endpoint
**Branch:** `feat/ai-sdk-chat-endpoint`

**Scope:**
- Create HTTP endpoint for AI SDK streaming
- Wire to conversational chat function
- Add authentication
- Feature flag controls activation

**Files Changed:**
```
pkg/api/routes.go (or equivalent)
pkg/api/chat.go (new)
pkg/listener/conversational.go (conditional path)
```

**Testing:**
- Endpoint responds to POST
- Streams AI SDK format
- Authentication works
- Errors return proper format

**Reviewer Checklist:**
- [ ] Endpoint follows REST conventions
- [ ] Authentication matches existing patterns
- [ ] Logging is appropriate
- [ ] Feature flag respected

---

### Phase 3: Frontend Integration (Week 3-4)

#### PR 5: Next.js API Route Proxy
**Branch:** `feat/ai-sdk-api-route`

**Scope:**
- Create `/api/chat` route
- Proxy to Go streaming endpoint
- Handle authentication forwarding
- Stream response to client

**Files Changed:**
```
chartsmith-app/app/api/chat/route.ts (new)
```

**Testing:**
- Route proxies correctly
- Streaming works end-to-end
- Auth forwarded correctly
- Errors handled gracefully

**Reviewer Checklist:**
- [ ] Follows Next.js 14+ patterns
- [ ] No request body size limits issues
- [ ] Timeout handling appropriate
- [ ] CORS not needed (same origin)

---

#### PR 6: useChat Hook Implementation
**Branch:** `feat/ai-sdk-use-chat`

**Scope:**
- Implement `useAIChat` with real `useChat`
- Message format conversion
- Integration with existing Jotai atoms
- Feature flag controls activation

**Files Changed:**
```
chartsmith-app/hooks/useAIChat.ts
chartsmith-app/lib/types/chat.ts (new or modified)
chartsmith-app/atoms/workspace.ts (adapter functions)
```

**Testing:**
- Hook sends messages correctly
- Hook receives streaming responses
- State updates correctly
- Works alongside Centrifugo

**Reviewer Checklist:**
- [ ] useChat configured correctly
- [ ] Message format conversion tested
- [ ] No memory leaks in subscriptions
- [ ] Error boundaries in place

---

#### PR 7: Chat UI Component Migration
**Branch:** `feat/ai-sdk-chat-ui`

**Scope:**
- Update `ChatContainer.tsx` to use new hook
- Update `ChatMessage.tsx` for new message format
- Preserve all existing UI/UX
- Feature flag controls activation

**Files Changed:**
```
chartsmith-app/components/ChatContainer.tsx
chartsmith-app/components/ChatMessage.tsx
chartsmith-app/components/ChatInput.tsx (if separated)
```

**Testing:**
- Chat input works as before
- Messages display correctly
- Streaming text renders smoothly
- All interactive elements work

**Reviewer Checklist:**
- [ ] No visual regressions
- [ ] Accessibility preserved
- [ ] Loading states correct
- [ ] Error states correct

---

### Phase 4: Tool Calling (Week 4-5)

#### PR 8: Tool Call Protocol Support
**Branch:** `feat/ai-sdk-tool-calls`

**Scope:**
- Ensure tool calls stream in AI SDK format
- Frontend displays tool activity (if applicable)
- Tool results incorporated correctly
- All existing tools work

**Files Changed:**
```
pkg/llm/aisdk.go (tool streaming)
pkg/llm/conversational.go (tool definitions)
pkg/llm/execute-action.go (text_editor tool)
chartsmith-app/components/ChatMessage.tsx (tool display)
```

**Testing:**
- `latest_subchart_version` tool works
- `latest_kubernetes_version` tool works
- `text_editor` tool works
- Tool results appear in chat

**Reviewer Checklist:**
- [ ] Tool call format matches spec
- [ ] Tool results format matches spec
- [ ] No regression in tool functionality
- [ ] Error handling for failed tools

---

### Phase 5: Cleanup (Week 5-6)

#### PR 9: Remove Feature Flags & Legacy Code
**Branch:** `feat/ai-sdk-cleanup`

**Scope:**
- Remove feature flags (new is default)
- Remove old Centrifugo chat handlers
- Remove old streaming code paths
- Clean up unused imports/types

**Files Changed:**
```
chartsmith-app/hooks/useCentrifugo.ts (remove chat handling)
chartsmith-app/lib/config/feature-flags.ts (remove)
pkg/listener/conversational.go (remove old path)
Various files (cleanup)
```

**Testing:**
- All tests pass
- No dead code
- No unused dependencies

**Reviewer Checklist:**
- [ ] No feature flag references remain
- [ ] Old code paths removed
- [ ] No console warnings
- [ ] Bundle size same or smaller

---

#### PR 10: Frontend Anthropic SDK Removal
**Branch:** `feat/remove-anthropic-sdk-frontend`

**Scope:**
- Migrate `promptType()` to use AI SDK or Go backend
- Remove `@anthropic-ai/sdk` from frontend
- Update any remaining direct Anthropic calls

**Files Changed:**
```
chartsmith-app/package.json
chartsmith-app/lib/llm/prompt-type.ts
```

**Testing:**
- `promptType()` works correctly
- No `@anthropic-ai/sdk` in bundle
- Build succeeds

**Reviewer Checklist:**
- [ ] No Anthropic SDK in package.json
- [ ] Functionality unchanged
- [ ] Bundle size reduced

---

#### PR 11: Documentation & Final Testing
**Branch:** `feat/ai-sdk-docs`

**Scope:**
- Update ARCHITECTURE.md
- Update CONTRIBUTING.md if needed
- Add migration notes
- Final E2E testing

**Files Changed:**
```
ARCHITECTURE.md
CONTRIBUTING.md
docs/ai-sdk-migration.md (new, optional)
```

**Testing:**
- Full E2E test suite passes
- Manual testing of all chat flows
- Performance testing

**Reviewer Checklist:**
- [ ] Documentation accurate
- [ ] No missing steps for new developers
- [ ] Architecture diagram updated

---

### Phase 6: Nice-to-Have (Week 6+)

#### PR 12: Provider Switching Infrastructure (Optional)
**Branch:** `feat/ai-sdk-provider-switching`

**Scope:**
- Add provider configuration
- Create provider adapters in Go
- Document provider switching

**Files Changed:**
```
pkg/llm/providers.go (new)
pkg/llm/anthropic.go (refactor)
pkg/llm/openai.go (new, optional)
docs/provider-configuration.md (new)
```

---

## Success Metrics

### Functional Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Chat functionality parity | 100% | All existing features work |
| Test pass rate | 100% | CI/CD pipeline |
| Zero regressions | 0 bugs | QA testing |

### Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first token | Same or better | Stopwatch/logging |
| Streaming smoothness | No jank | Visual inspection |
| Bundle size | Same or smaller | Build output |

### Code Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test coverage | ≥ current | Coverage reports |
| TypeScript strict mode | Pass | Build |
| Linting | Pass | ESLint/golint |

---

## Risks & Mitigations

### Risk 1: Protocol Mismatch
**Risk:** AI SDK protocol may have nuances not covered by `coder/aisdk-go`
**Likelihood:** Medium
**Impact:** High
**Mitigation:**
- Review aisdk-go source code
- Create comprehensive protocol tests
- Have fallback to custom implementation

### Risk 2: Message Format Incompatibility
**Risk:** Existing messages in DB may not map cleanly to AI SDK format
**Likelihood:** Low
**Impact:** Medium
**Mitigation:**
- Create adapter layer for message conversion
- Handle both formats during transition
- Don't modify existing DB schema

### Risk 3: Performance Regression
**Risk:** Additional abstraction layers may slow streaming
**Likelihood:** Low
**Impact:** Medium
**Mitigation:**
- Benchmark before/after
- Optimize hot paths
- Feature flag allows rollback

### Risk 4: Centrifugo Interaction
**Risk:** Hybrid system (useChat + Centrifugo) may have race conditions
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- Clear separation of concerns
- Chat via useChat, other events via Centrifugo
- Comprehensive integration testing

### Risk 5: Tool Calling Complexity
**Risk:** `text_editor` tool has complex fuzzy matching that may break
**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Don't modify tool implementation
- Only change streaming format
- Extensive tool testing

---

## Dependencies

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@ai-sdk/react` | ^latest | Frontend useChat hook |
| `ai` | ^latest | AI SDK core |
| `@ai-sdk/anthropic` | ^latest | Anthropic provider (future) |
| `github.com/coder/aisdk-go` | ^latest | Go AI SDK protocol |

### Internal Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Go worker running | Required | Must be deployed |
| Centrifugo | Required | Stays for non-chat events |
| PostgreSQL | Required | Message storage |

### Team Dependencies

| Team/Person | Dependency | Notes |
|-------------|------------|-------|
| Frontend | PR reviews | React/Next.js expertise |
| Backend | PR reviews | Go expertise |
| DevOps | Deployment | Feature flag config |
| QA | Testing | E2E validation |

---

## Appendix

### A. AI SDK Data Stream Protocol Reference

The AI SDK uses a specific SSE format for streaming:

```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"tool-call","toolCallId":"call_123","toolName":"get_weather","args":{}}

data: {"type":"tool-result","toolCallId":"call_123","result":{"temp":72}}

data: {"type":"finish","finishReason":"stop"}
```

Full spec: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol

### B. Current Message Schema

```sql
CREATE TABLE workspace_chat (
  id VARCHAR PRIMARY KEY,
  workspace_id VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL,
  sent_by VARCHAR NOT NULL,
  prompt TEXT,
  response TEXT,
  revision_number INTEGER,
  is_canceled BOOLEAN,
  is_intent_complete BOOLEAN,
  -- ... additional fields
);
```

### C. Glossary

| Term | Definition |
|------|------------|
| AI SDK | Vercel AI SDK - library for AI chat applications |
| useChat | React hook from @ai-sdk/react for chat state |
| Data Stream Protocol | SSE format for streaming AI responses |
| aisdk-go | Go library implementing AI SDK protocol |
| Centrifugo | WebSocket pub/sub server for realtime events |

### D. Related Documents

- [ARCHITECTURE.md](/ARCHITECTURE.md) - System architecture
- [chartsmith-app/ARCHITECTURE.md](/chartsmith-app/ARCHITECTURE.md) - Frontend architecture
- [CONTRIBUTING.md](/CONTRIBUTING.md) - Development setup

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| Product Manager | | | |
| Tech Lead | | | |

---

*This is a living document. Updates should be made as implementation progresses and learnings emerge.*
