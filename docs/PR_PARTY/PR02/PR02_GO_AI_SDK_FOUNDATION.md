# PR#2: Go AI SDK Library Integration

**Estimated Time:** 2-3 hours  
**Complexity:** LOW  
**Dependencies:** None (can start immediately)  
**Parallel With:** PR#1, PR#3  
**Success Criteria:** G2 (Migrate from direct `@anthropic-ai/sdk` usage to AI SDK Core)

---

## Overview

### What We're Building

This PR establishes the Go backend foundation for the Vercel AI SDK migration. We will:

1. **Add aisdk-go dependency** - Install `github.com/coder/aisdk-go` to enable AI SDK protocol support
2. **Create adapter shell** - Build `pkg/llm/aisdk.go` with the basic structure for converting Anthropic streams to AI SDK format
3. **Add type definitions** - Create `pkg/llm/types/aisdk.go` for AI SDK protocol types
4. **No functional changes** - This PR adds infrastructure only; no existing functionality changes

### Why It Matters

This foundational PR enables the Go backend to output the Vercel AI SDK Data Stream Protocol. By establishing the infrastructure early, we can:

- Incrementally build the adapter without breaking existing functionality
- Test protocol conversion in isolation
- Build confidence in the `aisdk-go` library before full integration
- Enable parallel work on frontend (PR#1) and backend (PR#2)

### Success in One Sentence

"This PR is successful when `aisdk-go` is installed, adapter shell exists with proper types, and all existing Go functionality continues to work unchanged."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Library Selection
**Options Considered:**
1. `github.com/coder/aisdk-go` - Official Go implementation, maintained by Coder
2. Custom implementation - Full control, but significant effort
3. Fork/modify existing library - Complex maintenance burden

**Chosen:** `github.com/coder/aisdk-go`

**Rationale:**
- Official Go implementation of AI SDK protocol
- Maintained by Coder (production-tested)
- Well-documented and actively maintained
- Matches Vercel AI SDK spec exactly
- Used in production by Coder's own products

**Trade-offs:**
- Gain: Production-ready, well-tested, maintained
- Lose: External dependency (acceptable for standard protocol)

#### Decision 2: Adapter Location
**Options Considered:**
1. `pkg/llm/aisdk.go` - Co-located with other LLM code
2. `pkg/aisdk/` - Separate package
3. `pkg/llm/adapters/aisdk.go` - Subdirectory

**Chosen:** `pkg/llm/aisdk.go`

**Rationale:**
- Keeps AI SDK adapter close to existing LLM code
- Follows existing pattern (all LLM code in `pkg/llm/`)
- Easy to find and maintain
- Clear that it's part of LLM package

**Trade-offs:**
- Gain: Co-location, simplicity
- Lose: Slightly larger file (acceptable)

#### Decision 3: Type Definitions Location
**Options Considered:**
1. `pkg/llm/types/aisdk.go` - Separate types file
2. Inline in `aisdk.go` - Simpler, but less organized
3. `pkg/llm/aisdk_types.go` - Separate file in same package

**Chosen:** `pkg/llm/types/aisdk.go`

**Rationale:**
- Follows existing pattern (`pkg/llm/types/types.go` exists)
- Keeps types organized and discoverable
- Easy to reference from other files
- Clear separation of concerns

**Trade-offs:**
- Gain: Organization, follows existing patterns
- Lose: One more file (minimal overhead)

### Data Model

**No database changes** - This PR only affects Go dependencies and code structure.

### API Design

**No API changes** - This PR only adds Go infrastructure. The adapter will be used in future PRs.

### Component Hierarchy

```
pkg/llm/
├── aisdk.go (new)          # AI SDK adapter shell
├── aisdk_test.go (new)     # Unit tests
├── types/
│   └── aisdk.go (new)      # AI SDK type definitions
├── conversational.go        # Existing (unchanged)
├── plan.go                  # Existing (unchanged)
└── ... (other existing files)
```

---

## Implementation Details

### File Structure

**New Files:**
```
pkg/llm/
├── aisdk.go (~100 lines)           # Adapter shell with basic structure
├── aisdk_test.go (~50 lines)      # Basic unit tests
└── types/
    └── aisdk.go (~50 lines)        # Type definitions
```

**Modified Files:**
- `go.mod` (+1 dependency) - Add `github.com/coder/aisdk-go`
- `go.sum` (auto-generated) - Dependency checksums

### Key Implementation Steps

#### Phase 1: Dependency Setup (15 minutes)
1. Add `github.com/coder/aisdk-go` to `go.mod`
2. Run `go mod tidy` to download and verify
3. Verify no conflicts with existing dependencies

#### Phase 2: Type Definitions (30 minutes)
1. Create `pkg/llm/types/aisdk.go`
2. Define types for AI SDK protocol:
   - Message types (user, assistant, system)
   - Stream event types (text-delta, tool-call, tool-result, finish)
   - Adapter interfaces

#### Phase 3: Adapter Shell (45 minutes)
1. Create `pkg/llm/aisdk.go`
2. Define `AISDKStreamWriter` struct
3. Add stub methods:
   - `WriteTextDelta(text string) error`
   - `WriteToolCall(id, name string, args interface{}) error`
   - `WriteToolResult(id string, result interface{}) error`
   - `WriteFinish(reason string) error`
4. Add helper functions for message conversion

#### Phase 4: Basic Tests (30 minutes)
1. Create `pkg/llm/aisdk_test.go`
2. Test type definitions compile correctly
3. Test adapter struct can be created
4. Test basic message conversion helpers

### Code Examples

**Example 1: Type Definitions**
```go
// pkg/llm/types/aisdk.go
package types

import (
    "github.com/coder/aisdk-go"
)

// AISDKMessage wraps AI SDK message format
type AISDKMessage struct {
    Role    string `json:"role"`    // "user", "assistant", "system"
    Content string `json:"content"`
}

// AISDKStreamEvent represents a single stream event
type AISDKStreamEvent struct {
    Type string      `json:"type"` // "text-delta", "tool-call", "tool-result", "finish"
    Data interface{} `json:"-"`     // Type-specific data
}
```

**Example 2: Adapter Shell**
```go
// pkg/llm/aisdk.go
package llm

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    
    "github.com/coder/aisdk-go"
    workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

// AISDKStreamWriter wraps HTTP response writer to output AI SDK protocol
type AISDKStreamWriter struct {
    writer  http.ResponseWriter
    flusher http.Flusher
}

// NewAISDKStreamWriter creates a new AI SDK stream writer
func NewAISDKStreamWriter(w http.ResponseWriter) *AISDKStreamWriter {
    flusher, _ := w.(http.Flusher)
    return &AISDKStreamWriter{
        writer:  w,
        flusher: flusher,
    }
}

// WriteTextDelta writes a text delta event
func (w *AISDKStreamWriter) WriteTextDelta(text string) error {
    event := aisdk.TextDeltaEvent{
        Type:      "text-delta",
        TextDelta: text,
    }
    return w.writeEvent(event)
}

// WriteToolCall writes a tool call event
func (w *AISDKStreamWriter) WriteToolCall(id, name string, args interface{}) error {
    event := aisdk.ToolCallEvent{
        Type:       "tool-call",
        ToolCallID: id,
        ToolName:   name,
        Args:       args,
    }
    return w.writeEvent(event)
}

// WriteToolResult writes a tool result event
func (w *AISDKStreamWriter) WriteToolResult(id string, result interface{}) error {
    event := aisdk.ToolResultEvent{
        Type:       "tool-result",
        ToolCallID: id,
        Result:     result,
    }
    return w.writeEvent(event)
}

// WriteFinish writes a finish event
func (w *AISDKStreamWriter) WriteFinish(reason string) error {
    event := aisdk.FinishEvent{
        Type:         "finish",
        FinishReason: reason,
    }
    return w.writeEvent(event)
}

// writeEvent writes a single SSE event
func (w *AISDKStreamWriter) writeEvent(event interface{}) error {
    data, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("failed to marshal event: %w", err)
    }
    
    _, err = fmt.Fprintf(w.writer, "data: %s\n\n", data)
    if err != nil {
        return fmt.Errorf("failed to write event: %w", err)
    }
    
    if w.flusher != nil {
        w.flusher.Flush()
    }
    
    return nil
}

// ConvertAnthropicToAISDK converts Anthropic message format to AI SDK format
func ConvertAnthropicToAISDK(anthropicMsg anthropic.MessageParam) ([]aisdk.Message, error) {
    // Stub implementation - will be filled in PR#3
    return nil, fmt.Errorf("not implemented")
}
```

**Example 3: Basic Test**
```go
// pkg/llm/aisdk_test.go
package llm

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestNewAISDKStreamWriter(t *testing.T) {
    w := httptest.NewRecorder()
    writer := NewAISDKStreamWriter(w)
    
    if writer == nil {
        t.Fatal("expected non-nil writer")
    }
    
    if writer.writer != w {
        t.Error("writer not set correctly")
    }
}

func TestWriteTextDelta(t *testing.T) {
    w := httptest.NewRecorder()
    writer := NewAISDKStreamWriter(w)
    
    err := writer.WriteTextDelta("Hello")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    
    // Verify SSE format
    body := w.Body.String()
    if body == "" {
        t.Error("expected non-empty body")
    }
}
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- `TestNewAISDKStreamWriter` - Adapter creation
- `TestWriteTextDelta` - Text delta event formatting
- `TestWriteToolCall` - Tool call event formatting
- `TestWriteToolResult` - Tool result event formatting
- `TestWriteFinish` - Finish event formatting
- `TestWriteEvent` - SSE format validation

**Integration Tests:**
- None in this PR (adapter not yet connected)

**Edge Cases:**
- Nil writer handling
- Missing flusher (non-Flusher ResponseWriter)
- JSON marshaling errors
- Write errors

**Performance Tests:**
- None in this PR (no performance-critical paths yet)

---

## Success Criteria

**Feature is complete when:**
- [ ] `aisdk-go` dependency added to `go.mod`
- [ ] `go mod tidy` runs successfully
- [ ] `pkg/llm/aisdk.go` exists with adapter shell
- [ ] `pkg/llm/types/aisdk.go` exists with type definitions
- [ ] `pkg/llm/aisdk_test.go` exists with basic tests
- [ ] All tests pass
- [ ] Go code compiles without errors
- [ ] No existing functionality broken
- [ ] Code follows existing patterns in `pkg/llm/`

**Performance Targets:**
- N/A (no performance-critical code in this PR)

**Quality Gates:**
- Zero compilation errors
- All new tests pass
- No linter errors
- Code follows Go best practices

---

## Risk Assessment

### Risk 1: Dependency Conflicts
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:** 
- Check `go.mod` for existing dependencies
- Run `go mod tidy` to verify compatibility
- Test compilation before committing

**Status:** 🟢 LOW RISK

### Risk 2: Protocol Mismatch
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:**
- Use official `aisdk-go` library (matches spec)
- Reference AI SDK documentation
- Will be validated in PR#3 when adapter is implemented

**Status:** 🟢 LOW RISK

### Risk 3: Breaking Existing Code
**Likelihood:** LOW  
**Impact:** HIGH  
**Mitigation:**
- No changes to existing files
- Only adding new files
- All existing tests should pass
- Verify with `go test ./pkg/llm/...`

**Status:** 🟢 LOW RISK

---

## Open Questions

1. **Question 1:** What version of `aisdk-go` should we use?
   - **Answer:** Use latest stable version. Check GitHub releases for latest tag.
   - **Decision needed by:** Phase 1

2. **Question 2:** Should we pin the version or use latest?
   - **Answer:** Pin specific version in `go.mod` for reproducibility
   - **Decision needed by:** Phase 1

---

## Timeline

**Total Estimate:** 2-3 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Dependency Setup | 15 min | ⏳ |
| 2 | Type Definitions | 30 min | ⏳ |
| 3 | Adapter Shell | 45 min | ⏳ |
| 4 | Basic Tests | 30 min | ⏳ |
| 5 | Verification | 15 min | ⏳ |

---

## Dependencies

**Requires:**
- [ ] Go 1.23+ (already required by project)
- [ ] Access to GitHub (for `aisdk-go`)

**Blocks:**
- PR#3 (AI SDK Streaming Adapter) - needs this foundation
- PR#4 (New Chat Streaming Endpoint) - needs adapter from PR#3

---

## References

- Related PR: [#1](../PR01/PR01_FRONTEND_AI_SDK_SETUP.md) - Frontend foundation (parallel)
- Related PR: [#3](../PR03/PR03_AI_SDK_STREAMING_ADAPTER.md) - Uses this foundation
- AI SDK Protocol: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
- aisdk-go: https://github.com/coder/aisdk-go
- PRD: [Vercel AI SDK Migration](../../PRD-vercel-ai-sdk-migration.md)
- Architecture: [Architecture Comparison](../../architecture-comparison.md)

