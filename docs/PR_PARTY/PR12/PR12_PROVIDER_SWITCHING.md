# PR#12: Provider Switching Infrastructure

**Estimated Time:** 8-12 hours  
**Complexity:** MEDIUM  
**Dependencies:** PR#3 (AI SDK Streaming Adapter), PR#4 (New Chat Streaming Endpoint), PR#6 (useChat Hook Implementation)  
**Status:** 📋 PLANNED

---

## Overview

### What We're Building

This PR adds infrastructure to enable easy switching between LLM providers (Anthropic Claude, OpenAI GPT, Google Gemini, etc.) for the conversational chat functionality. It demonstrates the flexibility gained from migrating to the Vercel AI SDK protocol and provides a foundation for future provider selection based on cost, performance, or feature requirements.

### Why It Matters

**Business Value:**
- **Cost Optimization:** Different providers have different pricing models. Being able to switch enables cost optimization.
- **Performance Flexibility:** Some providers may be faster or slower depending on workload.
- **Reliability:** Provider diversity reduces single point of failure risk.
- **Feature Access:** Different providers offer different capabilities (e.g., longer context windows, different models).

**Technical Value:**
- **Demonstrates Migration Success:** Shows that the AI SDK migration achieved its goal of provider flexibility.
- **Architecture Validation:** Proves the adapter pattern works for multiple providers.
- **Future-Proofing:** Makes it easy to adopt new providers as they emerge.

### Success in One Sentence

"This PR is successful when an operator can switch the chat provider from Anthropic to OpenAI (or another provider) by changing a single environment variable, and chat continues to work identically."

---

## Technical Design

### Architecture Decisions

#### Decision 1: Provider Configuration Strategy
**Options Considered:**
1. **Environment Variable** - Single `LLM_PROVIDER` env var (e.g., `anthropic`, `openai`)
2. **Config File** - YAML/JSON config file with provider settings
3. **Database Setting** - Per-workspace provider preference stored in DB
4. **Runtime Selection** - User-selectable provider in UI

**Chosen:** Option 1 (Environment Variable)

**Rationale:**
- Simplest implementation
- Consistent with existing pattern (API keys via env vars)
- No UI changes required
- Easy to test and validate
- Can extend to other options later if needed

**Trade-offs:**
- Gain: Simple, immediate provider switching
- Lose: No per-workspace customization (can add later)
- Lose: Requires deployment to change (acceptable for MVP)

#### Decision 2: Provider Adapter Pattern
**Options Considered:**
1. **Interface-Based** - Common `LLMProvider` interface with implementations
2. **Factory Pattern** - Provider factory creates appropriate client
3. **Strategy Pattern** - Provider-specific strategy objects
4. **Direct Conditional** - If/else based on provider name

**Chosen:** Option 1 (Interface-Based)

**Rationale:**
- Clean separation of concerns
- Easy to add new providers
- Testable in isolation
- Type-safe
- Follows Go best practices

**Trade-offs:**
- Gain: Clean, extensible architecture
- Lose: Slightly more code upfront
- Gain: Easy to test each provider independently

#### Decision 3: Provider Scope
**Options Considered:**
1. **Chat Only** - Only conversational chat uses provider switching
2. **All LLM Calls** - Plans, executes, intent classification all switchable
3. **Selective** - Chat + plans switchable, intent/embeddings stay fixed

**Chosen:** Option 1 (Chat Only)

**Rationale:**
- Chat is the primary user-facing feature
- Other LLM calls (intent, embeddings) are optimized for specific providers
- Reduces complexity and risk
- Can extend later if needed
- Aligns with PRD scope (Epic 6: Provider Flexibility)

**Trade-offs:**
- Gain: Focused scope, lower risk
- Lose: Not all LLM calls are switchable (acceptable for MVP)
- Gain: Can validate pattern before expanding

### Data Model

**No Database Changes Required**

The provider selection is configuration-only, not stored in the database. Messages continue to use the same schema regardless of provider.

**Configuration Model:**
```go
// Provider configuration (in-memory, from env vars)
type ProviderConfig struct {
    Provider     string  // "anthropic", "openai", "google"
    APIKey       string  // Provider-specific API key
    Model        string  // Model name (e.g., "claude-3-5-sonnet", "gpt-4")
    BaseURL      string  // Optional: custom endpoint
    MaxTokens    int     // Optional: max tokens for this provider
}
```

### API Design

**New Provider Interface:**
```go
// pkg/llm/provider.go
package llm

// LLMProvider defines the interface for LLM providers
type LLMProvider interface {
    // Name returns the provider identifier
    Name() string
    
    // StreamChat streams a conversational response
    StreamChat(
        ctx context.Context,
        w *AISDKStreamWriter,
        messages []aisdk.Message,
        tools []aisdk.Tool,
        opts StreamChatOpts,
    ) error
    
    // ValidateConfig checks if provider is properly configured
    ValidateConfig() error
}

// StreamChatOpts contains options for streaming chat
type StreamChatOpts struct {
    MaxTokens    int
    Temperature  float64
    SystemPrompt string
    UserRole     string // "auto", "developer", "operator"
}
```

**Provider Factory:**
```go
// NewProvider creates a provider instance based on configuration
func NewProvider(ctx context.Context, config ProviderConfig) (LLMProvider, error) {
    switch config.Provider {
    case "anthropic":
        return NewAnthropicProvider(ctx, config)
    case "openai":
        return NewOpenAIProvider(ctx, config)
    case "google":
        return NewGoogleProvider(ctx, config)
    default:
        return nil, fmt.Errorf("unknown provider: %s", config.Provider)
    }
}
```

**Provider Implementations:**
```go
// AnthropicProvider implements LLMProvider for Anthropic Claude
type AnthropicProvider struct {
    client *anthropic.Client
    config ProviderConfig
}

func (p *AnthropicProvider) StreamChat(ctx context.Context, w *AISDKStreamWriter, messages []aisdk.Message, tools []aisdk.Tool, opts StreamChatOpts) error {
    // Convert AI SDK messages to Anthropic format
    anthropicMessages := convertToAnthropicMessages(messages)
    
    // Convert AI SDK tools to Anthropic format
    anthropicTools := convertToAnthropicTools(tools)
    
    // Stream using Anthropic SDK
    stream := p.client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
        Model:     anthropic.F(anthropic.Model(opts.Model)),
        MaxTokens: anthropic.F(int64(opts.MaxTokens)),
        Messages:  anthropic.F(anthropicMessages),
        Tools:     anthropic.F(anthropicTools),
    })
    
    // Convert Anthropic stream events to AI SDK format
    return p.streamToAISDK(ctx, stream, w)
}

// OpenAIProvider implements LLMProvider for OpenAI GPT
type OpenAIProvider struct {
    client *openai.Client
    config ProviderConfig
}

func (p *OpenAIProvider) StreamChat(ctx context.Context, w *AISDKStreamWriter, messages []aisdk.Message, tools []aisdk.Tool, opts StreamChatOpts) error {
    // Convert AI SDK messages to OpenAI format
    openaiMessages := convertToOpenAIMessages(messages)
    
    // Convert AI SDK tools to OpenAI format
    openaiTools := convertToOpenAITools(tools)
    
    // Stream using OpenAI SDK
    stream, err := p.client.ChatCompletions.CreateStream(ctx, openai.ChatCompletionRequest{
        Model:       opts.Model,
        Messages:    openaiMessages,
        Tools:       openaiTools,
        MaxTokens:   opts.MaxTokens,
        Temperature: opts.Temperature,
    })
    
    // Convert OpenAI stream events to AI SDK format
    return p.streamToAISDK(ctx, stream, w)
}
```

### Component Hierarchy

```
pkg/llm/
├── provider.go (new)
│   ├── LLMProvider interface
│   ├── StreamChatOpts struct
│   └── NewProvider factory
│
├── providers/
│   ├── anthropic.go (new)
│   │   ├── AnthropicProvider struct
│   │   ├── StreamChat implementation
│   │   └── Message/tool conversion helpers
│   │
│   ├── openai.go (new)
│   │   ├── OpenAIProvider struct
│   │   ├── StreamChat implementation
│   │   └── Message/tool conversion helpers
│   │
│   └── google.go (new, optional)
│       ├── GoogleProvider struct
│       └── StreamChat implementation
│
├── config.go (new)
│   ├── ProviderConfig struct
│   ├── LoadProviderConfig function
│   └── ValidateProviderConfig function
│
└── conversational_aisdk.go (modified)
    └── Uses provider interface instead of direct Anthropic calls
```

---

## Implementation Details

### File Structure

**New Files:**
```
pkg/llm/
├── provider.go (~200 lines)
│   └── Provider interface and factory
│
├── providers/
│   ├── anthropic.go (~300 lines)
│   │   └── Anthropic provider implementation
│   │
│   ├── openai.go (~300 lines)
│   │   └── OpenAI provider implementation
│   │
│   └── common.go (~150 lines)
│       └── Shared conversion utilities
│
└── config.go (~100 lines)
    └── Provider configuration loading
```

**Modified Files:**
- `pkg/llm/conversational_aisdk.go` (~50 lines changed)
  - Replace direct `newAnthropicClient()` call with `NewProvider()`
  - Use provider interface instead of Anthropic-specific code
- `pkg/param/param.go` (~20 lines changed)
  - Add `LLM_PROVIDER` env var support
  - Add provider-specific API key env vars
- `chart/chartsmith/templates/chatsmith-worker-deployment.yaml` (~30 lines changed)
  - Add `LLM_PROVIDER` env var
  - Add `OPENAI_API_KEY` env var (optional)
  - Add `GOOGLE_API_KEY` env var (optional)

**Total:** ~1,000 lines new, ~100 lines modified

### Key Implementation Steps

#### Phase 1: Provider Interface & Configuration (2-3 hours)
1. Create `provider.go` with `LLMProvider` interface
2. Create `config.go` for provider configuration loading
3. Add environment variable support in `pkg/param`
4. Create provider factory function
5. Add validation logic

#### Phase 2: Anthropic Provider Adapter (2-3 hours)
1. Create `providers/anthropic.go`
2. Implement `AnthropicProvider` struct
3. Implement `StreamChat` method
4. Create message/tool conversion helpers
5. Extract existing Anthropic streaming logic
6. Unit tests for conversion functions

#### Phase 3: OpenAI Provider Adapter (3-4 hours)
1. Add OpenAI SDK dependency (`github.com/openai/openai-go`)
2. Create `providers/openai.go`
3. Implement `OpenAIProvider` struct
4. Implement `StreamChat` method
5. Create OpenAI message/tool conversion helpers
6. Handle OpenAI-specific streaming format
7. Unit tests for OpenAI provider

#### Phase 4: Integration & Testing (1-2 hours)
1. Update `conversational_aisdk.go` to use provider interface
2. Update Helm chart with new env vars
3. Integration tests with both providers
4. Manual testing with provider switching
5. Documentation updates

### Code Examples

**Example 1: Provider Configuration Loading**
```go
// pkg/llm/config.go
func LoadProviderConfig() (ProviderConfig, error) {
    provider := os.Getenv("LLM_PROVIDER")
    if provider == "" {
        provider = "anthropic" // Default
    }
    
    config := ProviderConfig{
        Provider: provider,
    }
    
    switch provider {
    case "anthropic":
        config.APIKey = param.Get().AnthropicAPIKey
        config.Model = getEnvOrDefault("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    case "openai":
        config.APIKey = os.Getenv("OPENAI_API_KEY")
        config.Model = getEnvOrDefault("OPENAI_MODEL", "gpt-4-turbo-preview")
    case "google":
        config.APIKey = os.Getenv("GOOGLE_API_KEY")
        config.Model = getEnvOrDefault("GOOGLE_MODEL", "gemini-pro")
    default:
        return config, fmt.Errorf("unknown provider: %s", provider)
    }
    
    if config.APIKey == "" {
        return config, fmt.Errorf("API key not set for provider: %s", provider)
    }
    
    return config, nil
}
```

**Example 2: Using Provider in Conversational Handler**
```go
// pkg/llm/conversational_aisdk.go (modified)
func ConversationalChatMessageAISDK(
    ctx context.Context,
    w http.ResponseWriter,
    workspace *workspacetypes.Workspace,
    messages []aisdk.Message,
) error {
    // Load provider configuration
    config, err := LoadProviderConfig()
    if err != nil {
        return fmt.Errorf("load provider config: %w", err)
    }
    
    // Create provider instance
    provider, err := NewProvider(ctx, config)
    if err != nil {
        return fmt.Errorf("create provider: %w", err)
    }
    
    // Get system prompt based on user role
    systemPrompt := getSystemPrompt(workspace.MessageFromPersona)
    
    // Get tools
    tools := getConversationalTools()
    
    // Create AI SDK stream writer
    streamWriter := NewAISDKStreamWriter(w)
    
    // Stream using provider
    opts := StreamChatOpts{
        MaxTokens:    8192,
        Temperature:  0.7,
        SystemPrompt: systemPrompt,
        UserRole:     workspace.MessageFromPersona,
    }
    
    return provider.StreamChat(ctx, streamWriter, messages, tools, opts)
}
```

**Example 3: Anthropic Provider Implementation**
```go
// pkg/llm/providers/anthropic.go
func (p *AnthropicProvider) StreamChat(
    ctx context.Context,
    w *AISDKStreamWriter,
    messages []aisdk.Message,
    tools []aisdk.Tool,
    opts StreamChatOpts,
) error {
    // Convert AI SDK messages to Anthropic format
    anthropicMessages := make([]anthropic.MessageParam, 0, len(messages))
    for _, msg := range messages {
        anthropicMsg := convertAISDKMessageToAnthropic(msg)
        anthropicMessages = append(anthropicMessages, anthropicMsg)
    }
    
    // Convert AI SDK tools to Anthropic format
    anthropicTools := make([]anthropic.ToolParam, 0, len(tools))
    for _, tool := range tools {
        anthropicTool := convertAISDKToolToAnthropic(tool)
        anthropicTools = append(anthropicTools, anthropicTool)
    }
    
    // Add system prompt if provided
    if opts.SystemPrompt != "" {
        anthropicMessages = append([]anthropic.MessageParam{
            anthropic.NewSystemMessage(anthropic.NewTextBlock(opts.SystemPrompt)),
        }, anthropicMessages...)
    }
    
    // Create streaming request
    stream := p.client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
        Model:     anthropic.F(anthropic.Model(p.config.Model)),
        MaxTokens: anthropic.F(int64(opts.MaxTokens)),
        Messages:  anthropic.F(anthropicMessages),
        Tools:     anthropic.F(anthropicTools),
    })
    
    // Stream and convert to AI SDK format
    return p.streamToAISDK(ctx, stream, w)
}

func (p *AnthropicProvider) streamToAISDK(
    ctx context.Context,
    stream *anthropic.MessageStream,
    w *AISDKStreamWriter,
) error {
    var currentToolCallID string
    var currentToolName string
    var toolArgsBuffer strings.Builder
    
    for stream.Next() {
        event := stream.Current()
        
        switch e := event.AsUnion().(type) {
        case anthropic.ContentBlockDeltaEvent:
            if e.Delta.Text != "" {
                // Text delta
                w.WriteTextDelta(e.Delta.Text)
            } else if e.Delta.Type == "tool_use" {
                // Tool call argument delta
                if e.Delta.PartialJSON != "" {
                    toolArgsBuffer.WriteString(e.Delta.PartialJSON)
                }
            }
            
        case anthropic.ContentBlockStartEvent:
            if e.ContentBlock.Type == "tool_use" {
                currentToolCallID = e.ContentBlock.ID
                currentToolName = e.ContentBlock.Name
                toolArgsBuffer.Reset()
            }
            
        case anthropic.ContentBlockStopEvent:
            if e.Index != nil && currentToolCallID != "" {
                // Complete tool call
                var args interface{}
                json.Unmarshal([]byte(toolArgsBuffer.String()), &args)
                w.WriteToolCall(currentToolCallID, currentToolName, args)
                currentToolCallID = ""
                currentToolName = ""
            }
            
        case anthropic.MessageStopEvent:
            w.WriteFinish("stop")
            return nil
            
        case anthropic.ErrorEvent:
            return fmt.Errorf("anthropic stream error: %s", e.Error.Message)
        }
    }
    
    if err := stream.Err(); err != nil {
        return fmt.Errorf("anthropic stream: %w", err)
    }
    
    return nil
}
```

---

## Testing Strategy

### Test Categories

**Unit Tests:**
- Provider configuration loading
- Provider factory function
- Message format conversion (AI SDK → Provider → AI SDK)
- Tool format conversion (AI SDK → Provider → AI SDK)
- Provider validation

**Integration Tests:**
- End-to-end chat with Anthropic provider
- End-to-end chat with OpenAI provider
- Provider switching (change env var, verify behavior)
- Error handling (invalid provider, missing API key)

**Manual Tests:**
- Switch provider via env var
- Verify chat works identically
- Verify tool calling works
- Verify streaming works smoothly
- Performance comparison

### Test Cases

**Provider Configuration:**
1. **Default Provider:** When `LLM_PROVIDER` not set, defaults to `anthropic`
2. **Invalid Provider:** When `LLM_PROVIDER` is invalid, returns error
3. **Missing API Key:** When provider API key not set, returns error
4. **Custom Model:** When `*_MODEL` env var set, uses custom model

**Provider Switching:**
1. **Anthropic → OpenAI:** Change env var, restart, verify chat works
2. **OpenAI → Anthropic:** Change env var, restart, verify chat works
3. **Invalid Switch:** Set invalid provider, verify error message

**Message Conversion:**
1. **User Message:** AI SDK user message → Provider format → AI SDK (round-trip)
2. **Assistant Message:** AI SDK assistant message → Provider format → AI SDK
3. **System Message:** System prompt correctly added
4. **Message History:** Multiple messages converted correctly

**Tool Conversion:**
1. **Tool Definition:** AI SDK tool → Provider format → AI SDK (round-trip)
2. **Tool Call:** Provider tool call → AI SDK format
3. **Tool Result:** Tool result correctly formatted
4. **Multiple Tools:** Multiple tools converted correctly

**Streaming:**
1. **Text Streaming:** Tokens stream correctly for both providers
2. **Tool Call Streaming:** Tool calls appear during stream
3. **Error Handling:** Provider errors handled gracefully
4. **Completion:** Stream completes correctly

---

## Success Criteria

**Feature is complete when:**
- [ ] Provider interface defined and implemented
- [ ] Anthropic provider adapter works
- [ ] OpenAI provider adapter works
- [ ] Provider can be switched via `LLM_PROVIDER` env var
- [ ] Chat works identically with both providers
- [ ] Tool calling works with both providers
- [ ] Streaming works smoothly with both providers
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Helm chart updated with new env vars

**Performance Targets:**
- Provider switching: <1 second (restart required)
- Chat latency: Same or better than current (within 10%)
- Streaming smoothness: No degradation vs. current

**Quality Gates:**
- Zero regressions in chat functionality
- Test coverage >80% for new code
- No console errors
- Documentation complete

---

## Risk Assessment

### Risk 1: Provider API Differences
**Likelihood:** HIGH  
**Impact:** MEDIUM  
**Mitigation:**
- Thorough testing of message/tool conversion
- Comprehensive unit tests for conversion functions
- Manual testing with both providers
- Clear error messages for conversion failures

**Status:** 🟡 Documented

### Risk 2: Streaming Format Differences
**Likelihood:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Use AI SDK protocol as common format
- Provider-specific adapters handle differences
- Test streaming thoroughly with both providers
- Fallback to error if streaming fails

**Status:** 🟡 Documented

### Risk 3: Tool Calling Differences
**Likelihood:** MEDIUM  
**Impact:** HIGH  
**Mitigation:**
- Test tool calling extensively
- Verify tool results format correctly
- Handle provider-specific tool formats
- Document any limitations

**Status:** 🟡 Documented

### Risk 4: Performance Regression
**Likelihood:** LOW  
**Impact:** MEDIUM  
**Mitigation:**
- Benchmark before/after
- Optimize conversion functions
- Cache provider instances
- Monitor latency in production

**Status:** 🟢 Low Risk

### Risk 5: Missing Features
**Likelihood:** MEDIUM  
**Impact:** LOW  
**Mitigation:**
- Document provider-specific features
- Start with core features (chat, tools)
- Can extend later if needed
- Clear documentation of limitations

**Status:** 🟢 Acceptable

---

## Open Questions

1. **Question 1:** Should we support provider-specific features (e.g., OpenAI function calling vs. Anthropic tool use)?
   - Option A: Support only common features (current plan)
   - Option B: Support provider-specific features with feature detection
   - Decision needed by: Phase 3 (OpenAI implementation)

2. **Question 2:** Should we support per-workspace provider selection?
   - Option A: Global provider only (current plan)
   - Option B: Per-workspace provider preference
   - Decision: Defer to future PR if needed

3. **Question 3:** Should we support provider fallback (try Anthropic, fallback to OpenAI)?
   - Option A: Single provider only (current plan)
   - Option B: Fallback chain
   - Decision: Defer to future PR if needed

---

## Timeline

**Total Estimate:** 8-12 hours

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Provider Interface & Config | 2-3 h | ⏳ |
| 2 | Anthropic Provider Adapter | 2-3 h | ⏳ |
| 3 | OpenAI Provider Adapter | 3-4 h | ⏳ |
| 4 | Integration & Testing | 1-2 h | ⏳ |

---

## Dependencies

**Requires:**
- [ ] PR#3: AI SDK Streaming Adapter (must be complete)
- [ ] PR#4: New Chat Streaming Endpoint (must be complete)
- [ ] PR#6: useChat Hook Implementation (must be complete)
- [ ] AI SDK protocol working end-to-end

**Blocks:**
- None (this is a nice-to-have feature)

**Related:**
- PRD Epic 6: Provider Flexibility
- Architecture comparison document (provider switching section)

---

## References

- [Vercel AI SDK Provider Documentation](https://sdk.vercel.ai/docs/ai-sdk-core/providers)
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [AI SDK Data Stream Protocol](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol)
- Related PR: PR#3, PR#4, PR#6
- Architecture doc: `docs/architecture-comparison.md`
- PRD: `docs/PRD-vercel-ai-sdk-migration.md`

---

## Appendix

### A. Provider Comparison

| Provider | Model | Cost (per 1M tokens) | Context Window | Tool Calling | Notes |
|----------|-------|---------------------|----------------|--------------|-------|
| Anthropic | Claude 3.5 Sonnet | $3/$15 | 200K | ✅ | Current default |
| OpenAI | GPT-4 Turbo | $10/$30 | 128K | ✅ | Good alternative |
| Google | Gemini Pro | $0.50/$1.50 | 32K | ✅ | Cost-effective |

### B. Environment Variables

```bash
# Provider selection (required)
LLM_PROVIDER=anthropic  # or "openai", "google"

# Anthropic (required if LLM_PROVIDER=anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Custom Anthropic model
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# OpenAI (required if LLM_PROVIDER=openai)
OPENAI_API_KEY=sk-...

# Optional: Custom OpenAI model
OPENAI_MODEL=gpt-4-turbo-preview

# Google (required if LLM_PROVIDER=google)
GOOGLE_API_KEY=...

# Optional: Custom Google model
GOOGLE_MODEL=gemini-pro
```

### C. Provider Interface Methods

```go
type LLMProvider interface {
    // Name returns the provider identifier
    Name() string
    
    // StreamChat streams a conversational response
    StreamChat(
        ctx context.Context,
        w *AISDKStreamWriter,
        messages []aisdk.Message,
        tools []aisdk.Tool,
        opts StreamChatOpts,
    ) error
    
    // ValidateConfig checks if provider is properly configured
    ValidateConfig() error
}
```

### D. Message Format Conversion

**AI SDK Format:**
```json
{
  "role": "user",
  "content": "Hello, how are you?"
}
```

**Anthropic Format:**
```go
anthropic.NewUserMessage(anthropic.NewTextBlock("Hello, how are you?"))
```

**OpenAI Format:**
```go
openai.ChatCompletionMessage{
    Role:    "user",
    Content: "Hello, how are you?",
}
```

---

*This is a living document. Updates should be made as implementation progresses and learnings emerge.*

