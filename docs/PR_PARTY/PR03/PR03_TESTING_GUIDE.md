# PR#3: Testing Guide

---

## Test Categories

### 1. Unit Tests: Stream Writer

**Function:** `NewAISDKStreamWriter()`
- [ ] Test case 1: Valid ResponseWriter
  - **Input:** `httptest.NewRecorder()` (implements Flusher)
  - **Expected:** Returns `*AISDKStreamWriter`, no error
  - **Actual:** [Record result]
- [ ] Test case 2: Non-Flusher ResponseWriter
  - **Input:** Custom ResponseWriter without Flusher
  - **Expected:** Returns error
  - **Actual:** [Record result]
- [ ] Test case 3: Headers set correctly
  - **Input:** Valid ResponseWriter
  - **Expected:** Content-Type, Cache-Control, Connection headers set
  - **Actual:** [Record result]

**Function:** `WriteTextDelta()`
- [ ] Test case 1: Single text delta
  - **Input:** `"Hello"`
  - **Expected:** Writes `{"type":"text-delta","textDelta":"Hello"}` in SSE format
  - **Actual:** [Record result]
- [ ] Test case 2: Multiple text deltas
  - **Input:** `"Hello"`, `" "`, `"world"`
  - **Expected:** Three separate SSE events
  - **Actual:** [Record result]
- [ ] Test case 3: Empty text delta
  - **Input:** `""`
  - **Expected:** Still writes event (may be empty, but doesn't crash)
  - **Actual:** [Record result]
- [ ] Test case 4: Large text delta
  - **Input:** 10KB string
  - **Expected:** Writes correctly, no truncation
  - **Actual:** [Record result]

**Function:** `WriteToolCallStart()`
- [ ] Test case 1: Valid tool call
  - **Input:** `toolCallID="call_123"`, `toolName="get_weather"`
  - **Expected:** Writes `{"type":"tool-call","toolCallId":"call_123","toolName":"get_weather","args":{}}`
  - **Actual:** [Record result]
- [ ] Test case 2: Empty tool name
  - **Input:** `toolCallID="call_123"`, `toolName=""`
  - **Expected:** Writes event (may be invalid, but doesn't crash)
  - **Actual:** [Record result]

**Function:** `WriteToolCallDelta()`
- [ ] Test case 1: Partial JSON
  - **Input:** `toolCallID="call_123"`, `argsJson="{\"city\":"`
  - **Expected:** Writes `{"type":"tool-call-delta","toolCallId":"call_123","argsTextDelta":"{\"city\":"}`
  - **Actual:** [Record result]
- [ ] Test case 2: Complete JSON
  - **Input:** `toolCallID="call_123"`, `argsJson="{\"city\":\"NYC\"}"`
  - **Expected:** Writes delta correctly
  - **Actual:** [Record result]

**Function:** `WriteToolResult()`
- [ ] Test case 1: String result
  - **Input:** `toolCallID="call_123"`, `result="72°F"`
  - **Expected:** Writes `{"type":"tool-result","toolCallId":"call_123","result":"72°F"}`
  - **Actual:** [Record result]
- [ ] Test case 2: Object result
  - **Input:** `toolCallID="call_123"`, `result=map[string]interface{}{"temp":72}`
  - **Expected:** Writes result as JSON object
  - **Actual:** [Record result]
- [ ] Test case 3: Nil result
  - **Input:** `toolCallID="call_123"`, `result=nil`
  - **Expected:** Writes result as null
  - **Actual:** [Record result]

**Function:** `WriteFinish()`
- [ ] Test case 1: Stop reason "stop"
  - **Input:** `reason="stop"`
  - **Expected:** Writes `{"type":"finish","finishReason":"stop"}`
  - **Actual:** [Record result]
- [ ] Test case 2: Stop reason "length"
  - **Input:** `reason="length"`
  - **Expected:** Writes finish event with "length" reason
  - **Actual:** [Record result]
- [ ] Test case 3: Stop reason "tool-calls"
  - **Input:** `reason="tool-calls"`
  - **Expected:** Writes finish event with "tool-calls" reason
  - **Actual:** [Record result]

**Function:** `WriteError()`
- [ ] Test case 1: Standard error
  - **Input:** `err=fmt.Errorf("test error")`
  - **Expected:** Writes `{"type":"error","error":"test error"}`
  - **Actual:** [Record result]
- [ ] Test case 2: Wrapped error
  - **Input:** `err=fmt.Errorf("wrapped: %w", originalErr)`
  - **Expected:** Writes error message correctly
  - **Actual:** [Record result]

**Function:** `Close()`
- [ ] Test case 1: Close prevents writes
  - **Input:** Close writer, then try to write
  - **Expected:** Write returns error
  - **Actual:** [Record result]
- [ ] Test case 2: Multiple closes
  - **Input:** Close writer multiple times
  - **Expected:** No panic, idempotent
  - **Actual:** [Record result]

### 2. Unit Tests: SSE Format Compliance

**SSE Format Validation**
- [ ] Test case 1: Correct format
  - **Input:** Write multiple events
  - **Expected:** Each event is `"data: {json}\n\n"`
  - **Actual:** [Record result]
- [ ] Test case 2: Valid JSON
  - **Input:** Write event
  - **Expected:** JSON after "data: " prefix is valid
  - **Actual:** [Record result]
- [ ] Test case 3: Double newline separator
  - **Input:** Write multiple events
  - **Expected:** Events separated by `\n\n`
  - **Actual:** [Record result]
- [ ] Test case 4: No buffering
  - **Input:** Write event
  - **Expected:** Flush called immediately
  - **Actual:** [Record result]

### 3. Unit Tests: HTTP Headers

**Header Validation**
- [ ] Test case 1: Content-Type
  - **Input:** Create writer
  - **Expected:** `Content-Type: text/event-stream`
  - **Actual:** [Record result]
- [ ] Test case 2: Cache-Control
  - **Input:** Create writer
  - **Expected:** `Cache-Control: no-cache`
  - **Actual:** [Record result]
- [ ] Test case 3: Connection
  - **Input:** Create writer
  - **Expected:** `Connection: keep-alive`
  - **Actual:** [Record result]
- [ ] Test case 4: X-Accel-Buffering
  - **Input:** Create writer
  - **Expected:** `X-Accel-Buffering: no`
  - **Actual:** [Record result]

### 4. Unit Tests: Thread Safety

**Concurrent Access**
- [ ] Test case 1: Concurrent writes
  - **Input:** Multiple goroutines writing simultaneously
  - **Expected:** No race conditions, all writes succeed
  - **Actual:** [Record result]
- [ ] Test case 2: Race detector
  - **Input:** Run tests with `-race` flag
  - **Expected:** No race conditions detected
  - **Actual:** [Record result]
- [ ] Test case 3: Concurrent close
  - **Input:** Multiple goroutines closing simultaneously
  - **Expected:** No panic, idempotent
  - **Actual:** [Record result]

### 5. Unit Tests: Stop Reason Mapping

**Function:** `mapAnthropicStopReason()`
- [ ] Test case 1: "end_turn" → "stop"
  - **Input:** `"end_turn"`
  - **Expected:** `"stop"`
  - **Actual:** [Record result]
- [ ] Test case 2: "tool_use" → "tool-calls"
  - **Input:** `"tool_use"`
  - **Expected:** `"tool-calls"`
  - **Actual:** [Record result]
- [ ] Test case 3: "max_tokens" → "length"
  - **Input:** `"max_tokens"`
  - **Expected:** `"length"`
  - **Actual:** [Record result]
- [ ] Test case 4: "stop_sequence" → "stop"
  - **Input:** `"stop_sequence"`
  - **Expected:** `"stop"`
  - **Actual:** [Record result]
- [ ] Test case 5: Unknown reason → "unknown"
  - **Input:** `"unknown_reason"`
  - **Expected:** `"unknown"`
  - **Actual:** [Record result]

### 6. Integration Tests: Anthropic Event Conversion

**StreamAnthropicToAISDK()**

**Note:** These tests require mocking Anthropic stream or using test helpers.

- [ ] Test case 1: Text streaming
  - **Input:** Mock Anthropic stream with text deltas
  - **Expected:** Converts to `text-delta` events
  - **Actual:** [Record result]
- [ ] Test case 2: Tool call streaming
  - **Input:** Mock Anthropic stream with tool use
  - **Expected:** Converts to `tool-call` and `tool-call-delta` events
  - **Actual:** [Record result]
- [ ] Test case 3: Tool result streaming
  - **Input:** Mock Anthropic stream with tool results
  - **Expected:** Converts to `tool-result` events
  - **Actual:** [Record result]
- [ ] Test case 4: Finish event
  - **Input:** Mock Anthropic stream with stop reason
  - **Expected:** Converts to `finish` event with mapped reason
  - **Actual:** [Record result]
- [ ] Test case 5: Error handling
  - **Input:** Mock Anthropic stream with error
  - **Expected:** Converts to `error` event
  - **Actual:** [Record result]
- [ ] Test case 6: Full sequence
  - **Input:** Mock Anthropic stream with text → tool → result → finish
  - **Expected:** All events converted correctly in sequence
  - **Actual:** [Record result]

### 7. Edge Cases

**Edge Case Tests**
- [ ] Test case 1: Empty text deltas
  - **Input:** Text delta with empty string
  - **Expected:** Handles gracefully (may skip or write empty)
  - **Actual:** [Record result]
- [ ] Test case 2: Large text deltas
  - **Input:** 100KB text delta
  - **Expected:** Writes correctly, no truncation
  - **Actual:** [Record result]
- [ ] Test case 3: Multiple tool calls
  - **Input:** Stream with multiple tool calls
  - **Expected:** All tool calls tracked correctly
  - **Actual:** [Record result]
- [ ] Test case 4: Tool call without result
  - **Input:** Tool call but no result event
  - **Expected:** Handles gracefully (may be incomplete, but doesn't crash)
  - **Actual:** [Record result]
- [ ] Test case 5: Stream interruption
  - **Input:** Stream closes unexpectedly
  - **Expected:** Error event written, no panic
  - **Actual:** [Record result]
- [ ] Test case 6: Invalid JSON in tool args
  - **Input:** Tool call delta with invalid JSON
  - **Expected:** Handles gracefully (may write as-is or error)
  - **Actual:** [Record result]
- [ ] Test case 7: Connection drop
  - **Input:** Write fails (simulated)
  - **Expected:** Error returned, no panic
  - **Actual:** [Record result]

### 8. Performance Tests

**Performance Benchmarks**
- [ ] Benchmark 1: WriteTextDelta throughput
  - **Metric:** Events per second
  - **Target:** > 10,000 events/sec
  - **Actual:** [Record result]
- [ ] Benchmark 2: Memory usage per stream
  - **Metric:** Memory per active stream
  - **Target:** < 1MB per stream
  - **Actual:** [Record result]
- [ ] Benchmark 3: Concurrent streams
  - **Metric:** Number of simultaneous streams
  - **Target:** Support 100+ streams
  - **Actual:** [Record result]

---

## Acceptance Criteria

**Feature is complete when:**
- [ ] All unit tests pass (90%+ coverage)
- [ ] All event types tested
- [ ] SSE format compliance verified
- [ ] HTTP headers tested
- [ ] Thread safety verified (race detector)
- [ ] Stop reason mapping tested
- [ ] Edge cases covered
- [ ] Performance targets met (if applicable)
- [ ] Integration tests pass (if implemented)
- [ ] Code review approved

---

## Test Execution

### Run All Tests
```bash
# Run all AISDK tests
go test ./pkg/llm/... -v -run AISDK

# Run with coverage
go test ./pkg/llm/... -cover -run AISDK

# Run with race detector
go test ./pkg/llm/... -race -run AISDK

# Run specific test
go test ./pkg/llm/... -v -run TestAISDKStreamWriter_WriteTextDelta
```

### Test Coverage Goal
- **Target:** 90%+ code coverage
- **Critical paths:** 100% coverage (all event types, error paths)
- **Edge cases:** All identified edge cases tested

### Test Organization
- **File:** `pkg/llm/aisdk_test.go`
- **Naming:** `TestAISDKStreamWriter_<Method>` for stream writer tests
- **Naming:** `TestMapAnthropicStopReason` for mapping tests
- **Naming:** `TestStreamAnthropicToAISDK_<Scenario>` for converter tests

---

## Test Data

### Sample Events

**Text Delta:**
```json
{"type":"text-delta","textDelta":"Hello"}
```

**Tool Call Start:**
```json
{"type":"tool-call","toolCallId":"call_123","toolName":"get_weather","args":{}}
```

**Tool Call Delta:**
```json
{"type":"tool-call-delta","toolCallId":"call_123","argsTextDelta":"{\"city\":"}
```

**Tool Result:**
```json
{"type":"tool-result","toolCallId":"call_123","result":{"temp":72}}
```

**Finish:**
```json
{"type":"finish","finishReason":"stop"}
```

**Error:**
```json
{"type":"error","error":"connection failed"}
```

---

## Regression Testing

**Before merging, verify:**
- [ ] No existing tests broken
- [ ] No performance regressions
- [ ] No memory leaks
- [ ] No race conditions introduced
- [ ] Build still succeeds
- [ ] Linting still passes

---

*This document is part of the PR_PARTY documentation system. See `PR_PARTY/README.md` for more information.*

