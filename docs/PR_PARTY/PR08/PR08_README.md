# PR#8: Tool Call Protocol Support - Quick Start

---

## TL;DR (30 seconds)

**What:** Ensure tool calling works with AI SDK streaming protocol. Stream tool calls/results to frontend, execute tools in Go, display tool activity in chat UI.

**Why:** Tool calling is critical functionality (version lookups, file editing). Must work seamlessly with AI SDK migration.

**Time:** 8-12 hours estimated

**Complexity:** MEDIUM-HIGH

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#3, PR#4, PR#6 are complete (dependencies met)
- ✅ You have 8+ hours available
- ✅ You understand Go tool execution logic
- ✅ You're comfortable with streaming protocols

**Red Lights (Skip/defer it!):**
- ❌ Dependencies not complete (PR#3, PR#4, PR#6)
- ❌ Time-constrained (< 8 hours)
- ❌ Not familiar with Anthropic SDK tool use blocks
- ❌ Other priorities more urgent

**Decision Aid:** This PR is **required** for the AI SDK migration to be complete. Tool calling is core functionality. If dependencies aren't ready, work on those first.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#3 complete (AI SDK Streaming Adapter) - Need `AISDKStreamWriter`
- [ ] PR#4 complete (New Chat Streaming Endpoint) - Need HTTP endpoint
- [ ] PR#6 complete (useChat Hook Implementation) - Need frontend to consume events
- [ ] Go 1.21+ installed
- [ ] Understanding of Anthropic SDK `ToolUseBlock` structure
- [ ] Access to `pkg/llm` directory

### Knowledge Prerequisites
- [ ] Read `pkg/llm/conversational.go:99-230` (current tool execution)
- [ ] Understand AI SDK tool call protocol (see References)
- [ ] Know how `recommendations.GetLatestSubchartVersion()` works

### Setup Commands
```bash
# 1. Verify dependencies
git log --oneline | grep -E "PR#3|PR#4|PR#6"

# 2. Create branch
git checkout -b feat/ai-sdk-tool-calls

# 3. Review existing tool code
cat pkg/llm/conversational.go | grep -A 50 "latest_subchart_version"
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (45 minutes)
- [ ] Read this quick start (10 min)
- [ ] Read main specification `PR08_TOOL_CALL_PROTOCOL_SUPPORT.md` (30 min)
- [ ] Review existing tool implementations (5 min)
  - `pkg/llm/conversational.go:99-230`
  - `pkg/llm/execute-action.go:510-660`
- [ ] Note any questions

### Step 2: Set Up Environment (15 minutes)
- [ ] Verify Go version: `go version`
- [ ] Run existing tests: `go test ./pkg/llm -v`
- [ ] Open relevant files in editor:
  - `pkg/llm/aisdk.go`
  - `pkg/llm/conversational.go`
  - `chartsmith-app/components/ChatMessage.tsx`

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Add Tool Streaming Methods
- [ ] Commit when task complete

---

## Daily Progress Template

### Day 1 Goals (4-5 hours)
- [ ] Phase 1: Add tool streaming methods (2-3 h)
  - [ ] WriteToolCall method
  - [ ] WriteToolResult method
  - [ ] Unit tests
- [ ] Phase 2: Start tool execution handler (1-2 h)
  - [ ] Create aisdk_tools.go
  - [ ] Implement ExecuteToolAndStream skeleton

**Checkpoint:** Tool streaming methods working, basic tool execution handler created

### Day 2 Goals (4-5 hours)
- [ ] Phase 2: Complete tool execution handler (2-3 h)
  - [ ] Implement latest_subchart_version handler
  - [ ] Implement latest_kubernetes_version handler
  - [ ] Add unit tests
- [ ] Phase 3: Integrate into chat flow (2-3 h)
  - [ ] Modify StreamConversationalChat
  - [ ] Add tool detection and streaming
  - [ ] Test integration

**Checkpoint:** Tools execute and stream correctly in chat flow

### Day 3 Goals (2-3 hours)
- [ ] Phase 4: Frontend tool display (1-2 h)
  - [ ] Update ChatMessage component
  - [ ] Add tool invocation display
- [ ] Phase 5: Testing & bug fixes (1-2 h)
  - [ ] Run all tests
  - [ ] Fix any bugs
  - [ ] E2E testing

**Checkpoint:** Complete! All tools work, display correctly, tests pass

---

## Common Issues & Solutions

### Issue 1: Tool Call Not Streaming
**Symptoms:** Tool executes but no tool-call event in response  
**Cause:** Not calling `WriteToolCall` before execution  
**Solution:** Ensure `WriteToolCall` is called immediately after detecting tool use block
```go
// ✅ Correct order
writer.WriteToolCall(toolUse.ID, toolUse.Name, input)
result := executeTool(toolUse)
writer.WriteToolResult(toolUse.ID, result)
```

### Issue 2: Tool Result Format Mismatch
**Symptoms:** Frontend doesn't recognize tool result  
**Cause:** Result format doesn't match AI SDK spec  
**Solution:** Ensure result is valid JSON-serializable value
```go
// ✅ Correct format
result := "1.2.3"  // String
// or
result := map[string]interface{}{"version": "1.2.3"}  // Object
```

### Issue 3: Multi-Turn Conversation Breaks
**Symptoms:** Conversation stops after tool execution  
**Cause:** Tool results not added to conversation correctly  
**Solution:** Ensure tool results are added as user message with ToolResultBlock
```go
// ✅ Correct format
toolResults = append(toolResults, anthropic.NewToolResultBlock(
    toolUse.ID,
    resultString,
    false,
))
messages = append(messages, anthropic.NewUserMessage(toolResults...))
```

### Issue 4: Frontend Tool Display Not Showing
**Symptoms:** Tools execute but not visible in UI  
**Cause:** `useChat` hook not providing `toolInvocations`  
**Solution:** Check that API route streams tool events correctly, verify `useChat` configuration

### Issue 5: Tool Execution Error Not Handled
**Symptoms:** Tool fails but no error visible  
**Cause:** Error not streamed as tool result  
**Solution:** Stream error as tool result:
```go
if err != nil {
    writer.WriteToolResult(toolUse.ID, map[string]string{"error": err.Error()})
    return "", err
}
```

---

## Quick Reference

### Key Files
- `pkg/llm/aisdk.go` - Streaming writer (add WriteToolCall/WriteToolResult)
- `pkg/llm/aisdk_tools.go` - Tool execution handler (new file)
- `pkg/llm/conversational.go` - Chat flow (integrate tool streaming)
- `chartsmith-app/components/ChatMessage.tsx` - UI display (show tool invocations)

### Key Functions
- `WriteToolCall()` - Stream tool call event
- `WriteToolResult()` - Stream tool result event
- `ExecuteToolAndStream()` - Execute tool and stream events
- `StreamConversationalChat()` - Main chat function (modified)

### Key Concepts
- **Tool Use Block:** Anthropic SDK structure containing tool call (ID, name, input)
- **Tool Result Block:** Anthropic SDK structure containing tool result (ID, result)
- **AI SDK Protocol:** SSE format with tool-call and tool-result events
- **Multi-Turn:** Conversation continues after tool execution with tool results

### Useful Commands
```bash
# Run tests
go test ./pkg/llm -v -run Tool

# Test specific function
go test ./pkg/llm -v -run TestWriteToolCall

# Check coverage
go test ./pkg/llm -cover -run Tool

# Build
go build ./pkg/llm/...

# Run worker (for integration testing)
ENABLE_AI_SDK_CHAT=true make run-worker
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] Tool-call events appear in HTTP response stream
- [ ] Tool-result events appear in HTTP response stream
- [ ] Tools execute correctly (same results as before)
- [ ] Tool invocations visible in chat UI
- [ ] Multi-turn conversations work correctly
- [ ] All tests pass

**Performance Targets:**
- Tool execution time: < 100ms (same as before)
- Tool streaming latency: < 50ms (from execution to frontend)
- Multi-turn conversation: < 5 seconds total

---

## Help & Support

### Stuck?

1. **Check main planning doc** - `PR08_TOOL_CALL_PROTOCOL_SUPPORT.md` has detailed explanations
2. **Review existing tool code** - `pkg/llm/conversational.go:99-230` shows current implementation
3. **Check AI SDK docs** - https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#tool-calls
4. **Review PR#10 doc** - `docs/prs/PR-10-tool-calling.md` has similar implementation details

### Want to Skip a Feature?

- **Tool display in UI** - Can be deferred, tools still work without it
- **Error styling** - Can use default styling initially
- **Collapsible tool details** - Nice-to-have, not required

### Running Out of Time?

**Priority Order:**
1. **Must Have:** Tool streaming (Phase 1-3) - Core functionality
2. **Should Have:** Tool display (Phase 4) - Better UX
3. **Nice to Have:** Enhanced styling, collapsible details

**Minimum Viable:** Phases 1-3 complete, tools work even if UI display is basic

---

## Motivation

**You've got this!** 💪

Tool calling is one of the most interesting parts of the AI SDK migration. You're making Claude's capabilities visible to users, showing them exactly what tools are being called and what results are returned. This transparency improves the user experience and makes the AI feel more trustworthy.

The existing tool execution logic is proven and works well - you're just adding streaming visibility. The hard part (tool execution) is already done!

---

## Next Steps

**When ready:**
1. Verify prerequisites (5 min)
2. Read main spec (45 min)
3. Start Phase 1 from checklist
4. Commit early and often

**Status:** Ready to build! 🚀

---

## References

- **Main Spec:** `PR08_TOOL_CALL_PROTOCOL_SUPPORT.md`
- **Checklist:** `PR08_IMPLEMENTATION_CHECKLIST.md`
- **AI SDK Tool Protocol:** https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#tool-calls
- **Current Tool Code:** `pkg/llm/conversational.go:99-230`
- **Text Editor Tool:** `pkg/llm/execute-action.go:510-660`
- **Related PR:** `docs/prs/PR-10-tool-calling.md`

