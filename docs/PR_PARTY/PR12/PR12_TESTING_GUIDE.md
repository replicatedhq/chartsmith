# PR#12: Testing Guide

**Purpose:** Comprehensive testing strategy for provider switching infrastructure

---

## Test Categories

### 1. Unit Tests

#### Provider Configuration Tests
**File:** `pkg/llm/config_test.go`

**Test Cases:**
- [ ] **TestDefaultProvider:** When `LLM_PROVIDER` not set, defaults to `anthropic`
- [ ] **TestProviderFromEnv:** When `LLM_PROVIDER` set, uses that provider
- [ ] **TestInvalidProvider:** When `LLM_PROVIDER` is invalid, returns error
- [ ] **TestMissingAPIKey:** When provider API key not set, returns error
- [ ] **TestCustomModel:** When `*_MODEL` env var set, uses custom model
- [ ] **TestConfigValidation:** Config validation works correctly

**Example:**
```go
func TestDefaultProvider(t *testing.T) {
    os.Unsetenv("LLM_PROVIDER")
    config, err := LoadProviderConfig()
    assert.NoError(t, err)
    assert.Equal(t, "anthropic", config.Provider)
}

func TestInvalidProvider(t *testing.T) {
    os.Setenv("LLM_PROVIDER", "invalid")
    _, err := LoadProviderConfig()
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "unknown provider")
}
```

#### Provider Factory Tests
**File:** `pkg/llm/provider_test.go`

**Test Cases:**
- [ ] **TestNewProviderAnthropic:** Creates Anthropic provider correctly
- [ ] **TestNewProviderOpenAI:** Creates OpenAI provider correctly
- [ ] **TestNewProviderInvalid:** Returns error for invalid provider
- [ ] **TestNewProviderMissingKey:** Returns error when API key missing

**Example:**
```go
func TestNewProviderAnthropic(t *testing.T) {
    config := ProviderConfig{
        Provider: "anthropic",
        APIKey:   "test-key",
        Model:    "claude-3-5-sonnet-20241022",
    }
    provider, err := NewProvider(context.Background(), config)
    assert.NoError(t, err)
    assert.IsType(t, &AnthropicProvider{}, provider)
    assert.Equal(t, "anthropic", provider.Name())
}
```

#### Message Conversion Tests
**File:** `pkg/llm/providers/common_test.go` (or provider-specific test files)

**Test Cases:**
- [ ] **TestConvertUserMessage:** User message converts correctly
- [ ] **TestConvertAssistantMessage:** Assistant message converts correctly
- [ ] **TestConvertSystemMessage:** System message converts correctly
- [ ] **TestConvertToolCallMessage:** Tool call message converts correctly
- [ ] **TestConvertToolResultMessage:** Tool result message converts correctly
- [ ] **TestRoundTripConversion:** AI SDK → Provider → AI SDK preserves data

**Example:**
```go
func TestConvertUserMessage(t *testing.T) {
    aiSDKMsg := aisdk.Message{
        Role:    "user",
        Content: "Hello, how are you?",
    }
    
    anthropicMsg := convertAISDKMessageToAnthropic(aiSDKMsg)
    assert.NotNil(t, anthropicMsg)
    // Verify Anthropic format
}

func TestRoundTripConversion(t *testing.T) {
    original := aisdk.Message{
        Role:    "user",
        Content: "Test message",
    }
    
    anthropicMsg := convertAISDKMessageToAnthropic(original)
    convertedBack := convertAnthropicMessageToAISDK(anthropicMsg)
    
    assert.Equal(t, original.Role, convertedBack.Role)
    assert.Equal(t, original.Content, convertedBack.Content)
}
```

#### Tool Conversion Tests
**File:** `pkg/llm/providers/common_test.go`

**Test Cases:**
- [ ] **TestConvertToolDefinition:** Tool definition converts correctly
- [ ] **TestConvertToolCall:** Tool call converts correctly
- [ ] **TestConvertToolResult:** Tool result converts correctly
- [ ] **TestRoundTripToolConversion:** AI SDK → Provider → AI SDK preserves tool data

**Example:**
```go
func TestConvertToolDefinition(t *testing.T) {
    aiSDKTool := aisdk.Tool{
        Type: "function",
        Function: aisdk.FunctionDefinition{
            Name:        "latest_kubernetes_version",
            Description: "Get latest Kubernetes version",
            Parameters: map[string]interface{}{
                "type": "object",
                "properties": map[string]interface{}{
                    "semver_field": map[string]interface{}{
                        "type": "string",
                    },
                },
            },
        },
    }
    
    anthropicTool := convertAISDKToolToAnthropic(aiSDKTool)
    assert.NotNil(t, anthropicTool)
    assert.Equal(t, "latest_kubernetes_version", anthropicTool.Name)
}
```

#### Provider Validation Tests
**File:** `pkg/llm/providers/anthropic_test.go`, `pkg/llm/providers/openai_test.go`

**Test Cases:**
- [ ] **TestAnthropicValidateConfig:** Valid Anthropic config passes validation
- [ ] **TestAnthropicValidateConfigMissingKey:** Missing API key fails validation
- [ ] **TestOpenAIValidateConfig:** Valid OpenAI config passes validation
- [ ] **TestOpenAIValidateConfigMissingKey:** Missing API key fails validation

---

### 2. Integration Tests

#### End-to-End Chat Tests
**File:** `pkg/llm/integration_test.go`

**Test Cases:**
- [ ] **TestChatWithAnthropic:** End-to-end chat with Anthropic provider
- [ ] **TestChatWithOpenAI:** End-to-end chat with OpenAI provider
- [ ] **TestChatToolCallingAnthropic:** Tool calling works with Anthropic
- [ ] **TestChatToolCallingOpenAI:** Tool calling works with OpenAI
- [ ] **TestChatStreamingAnthropic:** Streaming works with Anthropic
- [ ] **TestChatStreamingOpenAI:** Streaming works with OpenAI

**Example:**
```go
func TestChatWithAnthropic(t *testing.T) {
    // Setup
    config := ProviderConfig{
        Provider: "anthropic",
        APIKey:   os.Getenv("ANTHROPIC_API_KEY"),
        Model:    "claude-3-5-sonnet-20241022",
    }
    provider, err := NewProvider(context.Background(), config)
    require.NoError(t, err)
    
    // Test
    messages := []aisdk.Message{
        {Role: "user", Content: "Hello, how are you?"},
    }
    
    var streamedContent strings.Builder
    w := &mockAISDKStreamWriter{
        onTextDelta: func(text string) {
            streamedContent.WriteString(text)
        },
    }
    
    err = provider.StreamChat(context.Background(), w, messages, nil, StreamChatOpts{})
    assert.NoError(t, err)
    assert.NotEmpty(t, streamedContent.String())
}
```

#### Provider Switching Tests
**File:** `pkg/llm/integration_test.go`

**Test Cases:**
- [ ] **TestProviderSwitchAnthropicToOpenAI:** Switch from Anthropic to OpenAI works
- [ ] **TestProviderSwitchOpenAIToAnthropic:** Switch from OpenAI to Anthropic works
- [ ] **TestProviderSwitchInvalid:** Invalid provider switch fails gracefully

**Example:**
```go
func TestProviderSwitchAnthropicToOpenAI(t *testing.T) {
    // Test with Anthropic
    config1 := ProviderConfig{Provider: "anthropic", APIKey: os.Getenv("ANTHROPIC_API_KEY")}
    provider1, err := NewProvider(context.Background(), config1)
    require.NoError(t, err)
    assert.Equal(t, "anthropic", provider1.Name())
    
    // Test with OpenAI
    config2 := ProviderConfig{Provider: "openai", APIKey: os.Getenv("OPENAI_API_KEY")}
    provider2, err := NewProvider(context.Background(), config2)
    require.NoError(t, err)
    assert.Equal(t, "openai", provider2.Name())
    
    // Both should work identically
    messages := []aisdk.Message{{Role: "user", Content: "Test"}}
    // ... test both providers with same messages
}
```

---

### 3. Manual Tests

#### Provider Switching
**Steps:**
1. [ ] Set `LLM_PROVIDER=anthropic`, restart worker
2. [ ] Send chat message, verify response
3. [ ] Set `LLM_PROVIDER=openai`, restart worker
4. [ ] Send same chat message, verify response
5. [ ] Compare responses (should be similar, may differ slightly)

**Expected:** Chat works identically with both providers

#### Tool Calling
**Steps:**
1. [ ] With Anthropic provider, ask question requiring tool (e.g., "What's the latest Kubernetes version?")
2. [ ] Verify tool is called and result appears
3. [ ] Switch to OpenAI provider
4. [ ] Ask same question
5. [ ] Verify tool is called and result appears

**Expected:** Tool calling works with both providers

#### Streaming
**Steps:**
1. [ ] With Anthropic provider, send chat message
2. [ ] Observe streaming behavior (smooth, incremental)
3. [ ] Switch to OpenAI provider
4. [ ] Send same message
5. [ ] Observe streaming behavior (should be similar)

**Expected:** Streaming works smoothly with both providers

#### Error Handling
**Steps:**
1. [ ] Set invalid `LLM_PROVIDER` value
2. [ ] Restart worker
3. [ ] Verify error message is clear
4. [ ] Set valid provider but invalid API key
5. [ ] Send chat message
6. [ ] Verify error message is clear

**Expected:** Clear error messages for misconfiguration

---

### 4. Performance Tests

#### Latency Comparison
**Test:** Compare chat latency between providers

**Steps:**
1. [ ] Measure Anthropic chat latency (time to first token, total time)
2. [ ] Measure OpenAI chat latency (time to first token, total time)
3. [ ] Compare results
4. [ ] Document differences

**Target:** No significant regression (<10% difference)

#### Streaming Smoothness
**Test:** Compare streaming smoothness between providers

**Steps:**
1. [ ] Observe Anthropic streaming (tokens per second, smoothness)
2. [ ] Observe OpenAI streaming (tokens per second, smoothness)
3. [ ] Compare results
4. [ ] Document differences

**Target:** No degradation vs. current implementation

---

### 5. Edge Cases

#### Empty Messages
- [ ] Test with empty message array
- [ ] Test with empty message content
- [ ] Verify error handling

#### Large Messages
- [ ] Test with very long message (>10K tokens)
- [ ] Test with many messages (>100 messages)
- [ ] Verify performance acceptable

#### Special Characters
- [ ] Test with special characters in messages
- [ ] Test with unicode characters
- [ ] Verify encoding correct

#### Tool Call Edge Cases
- [ ] Test with tool that has no arguments
- [ ] Test with tool that has complex nested arguments
- [ ] Test with tool call that fails
- [ ] Verify error handling

---

## Acceptance Criteria

### Functional Criteria
- [ ] Provider interface defined and implemented
- [ ] Anthropic provider adapter works
- [ ] OpenAI provider adapter works
- [ ] Provider can be switched via `LLM_PROVIDER` env var
- [ ] Chat works identically with both providers
- [ ] Tool calling works with both providers
- [ ] Streaming works smoothly with both providers
- [ ] Error handling is clear and helpful

### Performance Criteria
- [ ] Chat latency: Same or better than current (within 10%)
- [ ] Streaming smoothness: No degradation vs. current
- [ ] Provider switching: <1 second (restart required)

### Quality Criteria
- [ ] Test coverage >80% for new code
- [ ] No console errors
- [ ] Documentation complete
- [ ] Code is clean and maintainable

---

## Test Execution Plan

### Phase 1: Unit Tests (2 hours)
1. Write provider configuration tests
2. Write provider factory tests
3. Write message conversion tests
4. Write tool conversion tests
5. Write provider validation tests
6. Run all unit tests, fix failures

### Phase 2: Integration Tests (2 hours)
1. Write end-to-end chat tests
2. Write provider switching tests
3. Run integration tests, fix failures
4. Verify both providers work

### Phase 3: Manual Tests (1 hour)
1. Test provider switching manually
2. Test tool calling manually
3. Test streaming manually
4. Test error handling manually

### Phase 4: Performance Tests (30 minutes)
1. Benchmark latency
2. Benchmark streaming
3. Compare providers
4. Document results

---

## Test Data

### Test Messages
```go
var testMessages = []aisdk.Message{
    {Role: "user", Content: "Hello, how are you?"},
    {Role: "assistant", Content: "I'm doing well, thank you!"},
    {Role: "user", Content: "What's the latest Kubernetes version?"},
}
```

### Test Tools
```go
var testTools = []aisdk.Tool{
    {
        Type: "function",
        Function: aisdk.FunctionDefinition{
            Name:        "latest_kubernetes_version",
            Description: "Get latest Kubernetes version",
            Parameters: map[string]interface{}{
                "type": "object",
                "properties": map[string]interface{}{
                    "semver_field": map[string]interface{}{
                        "type": "string",
                    },
                },
            },
        },
    },
}
```

---

## Continuous Integration

### CI Test Commands
```bash
# Run all unit tests
go test ./pkg/llm/... -v

# Run integration tests (requires API keys)
go test ./pkg/llm/... -tags=integration -v

# Run with coverage
go test ./pkg/llm/... -cover -coverprofile=coverage.out

# View coverage
go tool cover -html=coverage.out
```

### CI Environment Variables
```bash
# Required for integration tests
ANTHROPIC_API_KEY=test-key
OPENAI_API_KEY=test-key
LLM_PROVIDER=anthropic  # or "openai" for OpenAI tests
```

---

## Test Checklist

### Before Starting Implementation
- [ ] Test plan reviewed
- [ ] Test data prepared
- [ ] API keys available
- [ ] Test environment set up

### During Implementation
- [ ] Write tests alongside code
- [ ] Run tests frequently
- [ ] Fix failures immediately
- [ ] Maintain test coverage

### Before Completion
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual tests completed
- [ ] Performance tests completed
- [ ] Test coverage >80%
- [ ] Documentation updated

---

**Remember:** Thorough testing of message/tool conversion is critical. This is where most bugs will occur.

