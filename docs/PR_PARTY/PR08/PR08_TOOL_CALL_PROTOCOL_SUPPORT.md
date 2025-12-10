# PR#8: Tool Call Protocol Support

**Estimated Time:** 8-12 hours  
**Complexity:** MEDIUM-HIGH  
**Dependencies:** PR#3 (AI SDK Streaming Adapter), PR#4 (New Chat Streaming Endpoint), PR#6 (useChat Hook Implementation)  
**Success Criteria:** G5 (All existing features work)

---

## Overview

### What We're Building

This PR ensures that tool calling functionality works correctly with the Vercel AI SDK streaming protocol. We will:

1. **Stream tool calls** - When Claude requests a tool, stream the tool call event to the frontend in AI SDK format
2. **Execute tools in Go** - Keep existing tool execution logic unchanged (proven and working)
3. **Stream tool results** - Send tool execution results back to frontend in AI SDK format
4. **Support all existing tools** - `latest_subchart_version`, `latest_kubernetes_version`, and `text_editor` must continue working identically
5. **Display tool activity** - Optionally show tool calls/results in the chat UI for better visibility

### Why It Matters

Tool calling is critical functionality that enables:
- **Version lookups** - Users can ask "What's the latest nginx chart version?" and get accurate answers
- **File editing** - Plans can execute file modifications via the `text_editor` tool
- **Multi-turn conversations** - Tools enable Claude to gather information and continue the conversation

Without proper tool call support, the AI SDK migration would break core features. This PR ensures seamless transition while maintaining all existing capabilities.

### Success in One Sentence

"This PR is successful when all three tools (`latest_subchart_version`, `latest_kubernetes_version`, `text_editor`) work identically to before, tool calls/results stream correctly in AI SDK format, and users can see tool activity in the chat UI."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Tool Execution Location
**Options Considered:**
1. Execute tools in Go backend (current approach) - Proven, tested, maintains state
2. Execute tools in Next.js API route - Would require rewriting tool logic
3. Execute tools in frontend - Security risk, requires exposing internal APIs

**Chosen:** Execute tools in Go backend (keep current approach)

**Rationale:**
- Existing tool execution logic is proven and complex (especially `text_editor` with fuzzy matching)
- Go backend has access to database, file system, and external APIs
- Maintains security boundaries (tools don't expose internal state to frontend)
- No need to rewrite working code

**Trade-offs:**
- Gain: No risk of breaking existing functionality, faster implementation
- Lose: Tool execution remains server-side only (acceptable, as it should be)

#### Decision 2: Tool Call Streaming Format
**Options Considered:**
1. Stream complete tool call when received - Simple, but delays visibility
2. Stream tool call incrementally - More complex, but better UX
3. Stream tool call only after execution - Simple, but less transparent

**Chosen:** Stream complete tool call when received from Anthropic

**Rationale:**
- AI SDK protocol supports complete tool call events
- Anthropic returns complete tool calls (not incremental)
- Simpler implementation matches protocol capabilities
- Frontend can display "Calling tool X..." immediately

**Trade-offs:**
- Gain: Simpler implementation, matches protocol
- Lose: Can't show incremental tool call building (not needed)

#### Decision 3: Tool Result Streaming
**Options Considered:**
1. Stream tool result immediately after execution - Best UX, shows progress
2. Stream tool result only after all tools complete - Simpler, but less transparent
3. Stream tool result as part of final response - Simplest, but no visibility

**Chosen:** Stream tool result immediately after execution

**Rationale:**
- AI SDK protocol supports tool-result events
- Better UX - users see tool activity in real-time
- Matches current behavior where tools execute and results are visible
- Enables frontend to show "Tool X returned Y"

**Trade-offs:**
- Gain: Better UX, transparency, matches protocol
- Lose: Slightly more complex streaming logic (worth it)

#### Decision 4: Tool Display in UI
**Options Considered:**
1. Show tool calls/results in chat - Transparent, educational
2. Hide tool calls/results - Cleaner UI, but less transparent
3. Collapsible tool details - Best of both worlds, but more work

**Chosen:** Show tool calls/results in chat (Phase 1), make collapsible later if needed

**Rationale:**
- AI SDK `useChat` hook provides `toolInvocations` in messages
- Users benefit from seeing what tools are being called
- Can simplify UI later if needed (non-breaking change)
- Matches industry standard (ChatGPT shows tool usage)

**Trade-offs:**
- Gain: Transparency, better UX, uses AI SDK features
- Lose: Slightly more verbose chat (acceptable)

### Data Model

**No database changes** - Tool execution and results are handled in-memory during the conversation. Only the final response is persisted to `workspace_chat` table.

**Message Format:**
- **Tool Call Event:** Streamed as AI SDK `tool-call` event
- **Tool Result Event:** Streamed as AI SDK `tool-result` event
- **Final Response:** Saved to database as before (no change)

### API Design

**New Functions:**

```go
// pkg/llm/aisdk.go

/**
 * WriteToolCall streams a tool call event to the frontend
 * @param toolCallID - Unique identifier for this tool call (from Anthropic)
 * @param toolName - Name of the tool being called
 * @param args - Tool arguments (parsed from Anthropic tool_use block)
 * @returns error if streaming fails
 */
func (s *AISDKStreamWriter) WriteToolCall(toolCallID, toolName string, args interface{}) error

/**
 * WriteToolResult streams a tool result event to the frontend
 * @param toolCallID - Same ID as the corresponding tool call
 * @param result - Tool execution result (can be string, object, or error)
 * @returns error if streaming fails
 */
func (s *AISDKStreamWriter) WriteToolResult(toolCallID string, result interface{}) error
```

**Modified Functions:**

```go
// pkg/llm/conversational.go

/**
 * StreamConversationalChat streams chat with tool support
 * Modified to stream tool calls/results in AI SDK format
 */
func StreamConversationalChat(
    ctx context.Context,
    writer *AISDKStreamWriter,
    ws *workspacetypes.Workspace,
    history []workspacetypes.Chat,
    prompt string,
) error
```

### Component Hierarchy

```
ChatContainer (unchanged)
└── ChatMessage (modified)
    ├── Message content (unchanged)
    └── ToolInvocations (new)
        ├── ToolCall display
        └── ToolResult display
```

---

## Implementation Details

### File Structure

**Modified Files:**
- `pkg/llm/aisdk.go` (+150/-20 lines) - Add tool call/result streaming methods
- `pkg/llm/conversational.go` (+200/-100 lines) - Integrate tool streaming into chat flow
- `pkg/llm/execute-action.go` (+50/-10 lines) - Add tool streaming for text_editor (if needed)
- `chartsmith-app/components/ChatMessage.tsx` (+100/-20 lines) - Display tool invocations

**New Files:**
- `pkg/llm/aisdk_tools.go` (~200 lines) - Tool execution handler with streaming
- `pkg/llm/aisdk_tools_test.go` (~150 lines) - Unit tests for tool execution

### Key Implementation Steps

#### Phase 1: Add Tool Streaming Methods (2-3 hours)

1. **Add WriteToolCall method** to `AISDKStreamWriter`
   - Format: `{"type":"tool-call","toolCallId":"...","toolName":"...","args":{...}}`
   - Validate toolCallID and toolName are non-empty
   - Handle JSON marshaling errors

2. **Add WriteToolResult method** to `AISDKStreamWriter`
   - Format: `{"type":"tool-result","toolCallId":"...","result":{...}}`
   - Support string, object, and error results
   - Handle JSON marshaling errors

3. **Add unit tests** for both methods
   - Test valid tool calls
   - Test valid tool results
   - Test error handling
   - Test JSON formatting

#### Phase 2: Create Tool Execution Handler (3-4 hours)

1. **Create ExecuteToolAndStream function**
   - Takes tool use block from Anthropic
   - Streams tool call event
   - Executes tool (reuse existing logic)
   - Streams tool result event
   - Returns result for conversation continuation

2. **Handle each tool type:**
   - `latest_subchart_version` - Call `recommendations.GetLatestSubchartVersion()`
   - `latest_kubernetes_version` - Return hardcoded version based on semver_field
   - `text_editor` - Handle separately (used in plan execution, not conversational chat)

3. **Error handling:**
   - Stream error as tool result if execution fails
   - Log errors appropriately
   - Continue conversation with error result

4. **Add unit tests:**
   - Test each tool execution
   - Test error handling
   - Test streaming output

#### Phase 3: Integrate Tool Streaming into Chat Flow (2-3 hours)

1. **Modify StreamConversationalChat function**
   - Detect tool use blocks from Anthropic stream
   - Stream tool call events when received
   - Execute tools and stream results
   - Continue conversation with tool results
   - Handle multi-turn tool conversations

2. **Tool execution loop:**
   - After each Anthropic response, check for tool use blocks
   - If tools found, execute and stream results
   - Add tool results to conversation
   - Continue Anthropic stream
   - Repeat until no more tool calls

3. **Preserve existing behavior:**
   - Tool execution logic unchanged
   - Error handling unchanged
   - Multi-turn conversation handling unchanged

#### Phase 4: Frontend Tool Display (1-2 hours)

1. **Update ChatMessage component**
   - Check for `toolInvocations` in message
   - Display tool calls with name and args
   - Display tool results
   - Style consistently with existing message UI

2. **Optional enhancements:**
   - Collapsible tool details
   - Tool call status (pending/complete/error)
   - Tool execution time

### Code Examples

**Example 1: Tool Call Streaming**

```go
// pkg/llm/aisdk.go

func (s *AISDKStreamWriter) WriteToolCall(toolCallID, toolName string, args interface{}) error {
    event := map[string]interface{}{
        "type":       "tool-call",
        "toolCallId": toolCallID,
        "toolName":   toolName,
        "args":       args,
    }
    return s.writeEvent(event)
}
```

**Example 2: Tool Execution with Streaming**

```go
// pkg/llm/aisdk_tools.go

func ExecuteToolAndStream(
    ctx context.Context,
    writer *AISDKStreamWriter,
    toolUse anthropic.ToolUseBlock,
) (string, error) {
    // Parse tool input
    var input map[string]interface{}
    if err := json.Unmarshal(toolUse.Input, &input); err != nil {
        return "", fmt.Errorf("failed to parse tool input: %w", err)
    }

    // Stream tool call event
    if err := writer.WriteToolCall(toolUse.ID, toolUse.Name, input); err != nil {
        return "", fmt.Errorf("failed to stream tool call: %w", err)
    }

    // Execute tool
    var result interface{}
    var err error
    
    switch toolUse.Name {
    case "latest_subchart_version":
        chartName, _ := input["chart_name"].(string)
        version, err := recommendations.GetLatestSubchartVersion(chartName)
        if err == recommendations.ErrNoArtifactHubPackage {
            result = "?"
        } else if err != nil {
            result = map[string]string{"error": err.Error()}
        } else {
            result = version
        }
    case "latest_kubernetes_version":
        semverField, _ := input["semver_field"].(string)
        switch semverField {
        case "major":
            result = "1"
        case "minor":
            result = "1.32"
        case "patch":
            result = "1.32.1"
        }
    default:
        err = fmt.Errorf("unknown tool: %s", toolUse.Name)
    }

    // Stream tool result
    if err := writer.WriteToolResult(toolUse.ID, result); err != nil {
        return "", fmt.Errorf("failed to stream tool result: %w", err)
    }

    // Return result for conversation continuation
    resultStr, _ := json.Marshal(result)
    return string(resultStr), nil
}
```

**Example 3: Frontend Tool Display**

```typescript
// chartsmith-app/components/ChatMessage.tsx

function ChatMessage({ message }: { message: Message }) {
  return (
    <div className="message">
      <div className="message-content">
        {message.content}
      </div>
      
      {message.toolInvocations && message.toolInvocations.length > 0 && (
        <div className="tool-invocations">
          {message.toolInvocations.map((tool, idx) => (
            <div key={idx} className="tool-call">
              <div className="tool-name">
                🔧 {tool.toolName}
              </div>
              {tool.args && (
                <div className="tool-args">
                  {JSON.stringify(tool.args, null, 2)}
                </div>
              )}
              {tool.result && (
                <div className="tool-result">
                  Result: {typeof tool.result === 'string' 
                    ? tool.result 
                    : JSON.stringify(tool.result, null, 2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- `WriteToolCall` - Valid tool call formats, error handling
- `WriteToolResult` - Valid tool result formats, error handling
- `ExecuteToolAndStream` - Each tool type, error cases, streaming output

**Integration Tests:**
- Tool call → execution → result flow
- Multi-turn tool conversations
- Tool error handling and recovery
- Tool results in final response

**E2E Tests:**
- User asks about chart version → tool called → result displayed
- User asks about Kubernetes version → tool called → result displayed
- Multi-turn conversation with tools

**Edge Cases:**
- Tool execution fails → error streamed correctly
- Multiple tools in one turn → all executed and streamed
- Tool result is empty string → handled correctly
- Tool result is large object → streamed correctly

### Performance Tests

- Tool execution time < 100ms (for simple tools)
- Tool streaming latency < 50ms (from execution to frontend)
- Multi-turn tool conversation < 5 seconds total

---

## Success Criteria

**Feature is complete when:**
- [ ] Tool calls stream correctly in AI SDK format
- [ ] Tool results stream correctly in AI SDK format
- [ ] `latest_subchart_version` tool works identically to before
- [ ] `latest_kubernetes_version` tool works identically to before
- [ ] `text_editor` tool works (if used in conversational chat)
- [ ] Tool invocations visible in chat UI (optional but recommended)
- [ ] Multi-turn tool conversations work correctly
- [ ] Tool errors handled gracefully
- [ ] All tests pass
- [ ] No regressions in existing functionality

**Performance Targets:**
- Tool execution time: Same as before (< 100ms for simple tools)
- Tool streaming latency: < 50ms from execution to frontend
- Multi-turn conversations: < 5 seconds total

**Quality Gates:**
- Zero regressions in tool functionality
- Test coverage > 80% for new code
- No console errors in browser
- Tool calls/results visible in network tab

---

## Risk Assessment

### Risk 1: Tool Execution Logic Breaks
**Likelihood:** LOW  
**Impact:** HIGH  
**Mitigation:** 
- Don't modify existing tool execution logic
- Only change streaming format
- Comprehensive tests for each tool
- Feature flag allows rollback

**Status:** 🟢 LOW RISK

### Risk 2: Multi-Turn Tool Conversations Fail
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Preserve existing conversation loop logic
- Test multi-turn scenarios thoroughly
- Handle tool results correctly in conversation context

**Status:** 🟡 MEDIUM RISK

### Risk 3: Tool Streaming Format Mismatch
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:**
- Follow AI SDK protocol spec exactly
- Test with real AI SDK frontend
- Validate JSON format matches spec

**Status:** 🟢 LOW RISK

### Risk 4: Frontend Tool Display Breaks UI
**Likelihood:** LOW  
**Impact:** LOW  
**Mitigation:**
- Tool display is optional (can hide if needed)
- Style consistently with existing UI
- Test on different screen sizes

**Status:** 🟢 LOW RISK

### Risk 5: Performance Regression
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:**
- Benchmark before/after
- Tool execution unchanged (no performance impact)
- Streaming overhead minimal

**Status:** 🟢 LOW RISK

---

## Open Questions

1. **Question:** Should `text_editor` tool be supported in conversational chat, or only in plan execution?
   - **Current State:** `text_editor` is used in `execute-action.go` for plan execution
   - **Decision Needed:** If conversational chat needs file editing, we'll need to add it
   - **Recommendation:** Start with `latest_subchart_version` and `latest_kubernetes_version` only, add `text_editor` later if needed

2. **Question:** How should tool errors be displayed in the UI?
   - **Options:** Show error message, hide tool call, show with error styling
   - **Decision Needed:** Before Phase 4 (Frontend Display)
   - **Recommendation:** Show tool call with error result, styled differently

3. **Question:** Should tool calls be collapsible in the UI?
   - **Options:** Always visible, collapsible by default, expandable on click
   - **Decision Needed:** Before Phase 4 (Frontend Display)
   - **Recommendation:** Start with always visible, make collapsible later if needed

---

## Timeline

**Total Estimate:** 8-12 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Add tool streaming methods | 2-3 h | ⏳ |
| 2 | Create tool execution handler | 3-4 h | ⏳ |
| 3 | Integrate into chat flow | 2-3 h | ⏳ |
| 4 | Frontend tool display | 1-2 h | ⏳ |
| 5 | Testing & bug fixes | 2-3 h | ⏳ |

---

## Dependencies

**Requires:**
- [ ] PR#3 complete (AI SDK Streaming Adapter) - Need `AISDKStreamWriter` with basic streaming
- [ ] PR#4 complete (New Chat Streaming Endpoint) - Need HTTP endpoint for streaming
- [ ] PR#6 complete (useChat Hook Implementation) - Need frontend to consume tool events

**Blocks:**
- PR#9 (Remove Feature Flags) - Can't remove flags until tool calling works
- PR#11 (Documentation Updates) - Should document tool calling in architecture docs

**Parallel With:**
- Can work on frontend display (Phase 4) while backend is being tested

---

## References

- **AI SDK Tool Calling Spec:** https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#tool-calls
- **Related PR:** PR#10 (older doc, similar scope)
- **Current Tool Implementation:** `pkg/llm/conversational.go:99-230`
- **Text Editor Tool:** `pkg/llm/execute-action.go:510-660`
- **Architecture Comparison:** `docs/architecture-comparison.md` (Tool Calling section)

---

## Appendix

### A. AI SDK Tool Call Protocol

**Tool Call Event:**
```json
{
  "type": "tool-call",
  "toolCallId": "call_abc123",
  "toolName": "latest_subchart_version",
  "args": {
    "chart_name": "nginx"
  }
}
```

**Tool Result Event:**
```json
{
  "type": "tool-result",
  "toolCallId": "call_abc123",
  "result": "1.2.3"
}
```

**Tool Error Result:**
```json
{
  "type": "tool-result",
  "toolCallId": "call_abc123",
  "result": {
    "error": "Chart not found"
  }
}
```

### B. Current Tool Definitions

**Conversational Tools** (`pkg/llm/conversational.go:99-128`):
- `latest_subchart_version` - Get latest Helm chart version from ArtifactHub
- `latest_kubernetes_version` - Get latest Kubernetes version (hardcoded)

**Plan Execution Tools** (`pkg/llm/execute-action.go:510-532`):
- `text_editor_20241022` / `text_editor_20250124` - File editing (view, str_replace, create)

### C. Tool Execution Flow

```
1. User sends message: "What's the latest nginx chart version?"
2. Go calls Anthropic with tools defined
3. Anthropic returns tool_use block:
   {
     "id": "tool_123",
     "name": "latest_subchart_version",
     "input": {"chart_name": "nginx"}
   }
4. Go streams tool-call event to frontend
5. Go executes tool: recommendations.GetLatestSubchartVersion("nginx")
6. Go streams tool-result event: "1.2.3"
7. Go adds tool result to conversation and continues
8. Anthropic returns final text: "The latest nginx chart version is 1.2.3"
9. Go streams text-delta events
10. Go streams finish event
```

---

*This document is part of the Vercel AI SDK migration. See `docs/PRD-vercel-ai-sdk-migration.md` for overall context.*

