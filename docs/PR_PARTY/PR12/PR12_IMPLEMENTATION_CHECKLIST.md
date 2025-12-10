# PR#12: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (~45 min)
- [ ] Prerequisites verified
  - [ ] PR#3 complete (AI SDK Streaming Adapter)
  - [ ] PR#4 complete (New Chat Streaming Endpoint)
  - [ ] PR#6 complete (useChat Hook Implementation)
  - [ ] AI SDK chat working end-to-end
- [ ] Dependencies ready
  - [ ] Go 1.21+ installed
  - [ ] Access to Anthropic API key
  - [ ] Access to OpenAI API key (for testing)
- [ ] Git branch created
  ```bash
  git checkout -b feat/ai-sdk-provider-switching
  ```

---

## Phase 1: Provider Interface & Configuration (2-3 hours)

### 1.1: Create Provider Interface (30 minutes)

#### Create File
- [ ] Create `pkg/llm/provider.go`

#### Define Interface
- [ ] Add `LLMProvider` interface
  ```go
  type LLMProvider interface {
      Name() string
      StreamChat(ctx context.Context, w *AISDKStreamWriter, messages []aisdk.Message, tools []aisdk.Tool, opts StreamChatOpts) error
      ValidateConfig() error
  }
  ```

#### Define Options Struct
- [ ] Add `StreamChatOpts` struct
  ```go
  type StreamChatOpts struct {
      MaxTokens    int
      Temperature  float64
      SystemPrompt string
      UserRole     string
  }
  ```

**Checkpoint:** Interface defined ✓

**Commit:** `feat(llm): add LLMProvider interface for provider abstraction`

---

### 1.2: Create Provider Configuration (30 minutes)

#### Create File
- [ ] Create `pkg/llm/config.go`

#### Define Config Struct
- [ ] Add `ProviderConfig` struct
  ```go
  type ProviderConfig struct {
      Provider  string
      APIKey    string
      Model     string
      BaseURL   string
      MaxTokens int
  }
  ```

#### Implement Config Loading
- [ ] Add `LoadProviderConfig()` function
  ```go
  func LoadProviderConfig() (ProviderConfig, error) {
      provider := os.Getenv("LLM_PROVIDER")
      if provider == "" {
          provider = "anthropic" // Default
      }
      // ... load config based on provider
  }
  ```

#### Add Validation
- [ ] Add `ValidateProviderConfig()` function
- [ ] Check API key is set
- [ ] Check provider is valid
- [ ] Return clear error messages

**Checkpoint:** Configuration loading works ✓

**Commit:** `feat(llm): add provider configuration loading`

---

### 1.3: Add Environment Variable Support (20 minutes)

#### Update Param Package
- [ ] Modify `pkg/param/param.go`
- [ ] Add `LLMProvider` field to `Params` struct
- [ ] Load `LLM_PROVIDER` env var in `Init()`
- [ ] Add helper function `GetLLMProvider()`

#### Update Helm Chart
- [ ] Modify `chart/chartsmith/templates/chatsmith-worker-deployment.yaml`
- [ ] Add `LLM_PROVIDER` env var (optional, defaults to empty)
- [ ] Add `OPENAI_API_KEY` env var (optional, for OpenAI provider)
- [ ] Add `GOOGLE_API_KEY` env var (optional, for Google provider)
- [ ] Add model env vars (`ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GOOGLE_MODEL`)

**Checkpoint:** Environment variables configured ✓

**Commit:** `feat(config): add LLM provider environment variables`

---

### 1.4: Create Provider Factory (30 minutes)

#### Implement Factory Function
- [ ] Add `NewProvider()` function to `provider.go`
  ```go
  func NewProvider(ctx context.Context, config ProviderConfig) (LLMProvider, error) {
      switch config.Provider {
      case "anthropic":
          return NewAnthropicProvider(ctx, config)
      case "openai":
          return NewOpenAIProvider(ctx, config)
      default:
          return nil, fmt.Errorf("unknown provider: %s", config.Provider)
      }
  }
  ```

#### Add Provider Constructors (stubs)
- [ ] Add `NewAnthropicProvider()` stub
- [ ] Add `NewOpenAIProvider()` stub
- [ ] Return error for now (will implement in Phase 2-3)

**Checkpoint:** Factory function created ✓

**Commit:** `feat(llm): add provider factory function`

---

### 1.5: Unit Tests for Configuration (30 minutes)

#### Create Test File
- [ ] Create `pkg/llm/config_test.go`

#### Test Cases
- [ ] Test default provider (anthropic)
- [ ] Test provider from env var
- [ ] Test invalid provider error
- [ ] Test missing API key error
- [ ] Test custom model selection
- [ ] Test config validation

**Checkpoint:** Configuration tests passing ✓

**Commit:** `test(llm): add provider configuration tests`

---

## Phase 2: Anthropic Provider Adapter (2-3 hours)

### 2.1: Create Anthropic Provider Package (15 minutes)

#### Create Directory
- [ ] Create `pkg/llm/providers/` directory

#### Create File
- [ ] Create `pkg/llm/providers/anthropic.go`

#### Define Provider Struct
- [ ] Add `AnthropicProvider` struct
  ```go
  type AnthropicProvider struct {
      client *anthropic.Client
      config ProviderConfig
  }
  ```

**Checkpoint:** Provider struct created ✓

**Commit:** `feat(llm): add AnthropicProvider struct`

---

### 2.2: Implement Provider Constructor (20 minutes)

#### Implement NewAnthropicProvider
- [ ] Create Anthropic client
- [ ] Validate API key
- [ ] Set default model if not specified
- [ ] Return provider instance

**Checkpoint:** Constructor works ✓

**Commit:** `feat(llm): implement AnthropicProvider constructor`

---

### 2.3: Implement Name Method (5 minutes)

- [ ] Implement `Name()` method
  ```go
  func (p *AnthropicProvider) Name() string {
      return "anthropic"
  }
  ```

**Checkpoint:** Name method works ✓

**Commit:** `feat(llm): implement AnthropicProvider.Name()`

---

### 2.4: Implement ValidateConfig Method (10 minutes)

- [ ] Check API key is set
- [ ] Check model is valid
- [ ] Return error if invalid

**Checkpoint:** Validation works ✓

**Commit:** `feat(llm): implement AnthropicProvider.ValidateConfig()`

---

### 2.5: Create Message Conversion Helpers (45 minutes)

#### Create Conversion File
- [ ] Create `pkg/llm/providers/common.go` (or `anthropic_convert.go`)

#### Implement Conversions
- [ ] Add `convertAISDKMessageToAnthropic()` function
  ```go
  func convertAISDKMessageToAnthropic(msg aisdk.Message) anthropic.MessageParam {
      switch msg.Role {
      case "user":
          return anthropic.NewUserMessage(anthropic.NewTextBlock(msg.Content))
      case "assistant":
          return anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content))
      // ... handle tool calls
      }
  }
  ```

- [ ] Add `convertAISDKToolToAnthropic()` function
- [ ] Handle system messages
- [ ] Handle tool call messages
- [ ] Handle tool result messages

#### Unit Tests
- [ ] Test user message conversion
- [ ] Test assistant message conversion
- [ ] Test tool call conversion
- [ ] Test tool result conversion
- [ ] Test round-trip conversion

**Checkpoint:** Conversion functions work ✓

**Commit:** `feat(llm): add AI SDK to Anthropic message conversion`

---

### 2.6: Extract Existing Streaming Logic (30 minutes)

#### Review Existing Code
- [ ] Review `pkg/llm/conversational_aisdk.go`
- [ ] Identify Anthropic streaming code
- [ ] Note what needs to be extracted

#### Extract to Provider
- [ ] Move streaming logic to `AnthropicProvider.StreamChat()`
- [ ] Keep AI SDK format conversion
- [ ] Maintain existing behavior

**Checkpoint:** Streaming logic extracted ✓

**Commit:** `refactor(llm): extract Anthropic streaming to provider`

---

### 2.7: Implement StreamChat Method (45 minutes)

#### Implement Method
- [ ] Convert AI SDK messages to Anthropic format
- [ ] Convert AI SDK tools to Anthropic format
- [ ] Add system prompt if provided
- [ ] Create Anthropic streaming request
- [ ] Stream and convert events to AI SDK format
- [ ] Handle tool calls
- [ ] Handle tool results
- [ ] Handle completion
- [ ] Handle errors

**Checkpoint:** StreamChat works ✓

**Commit:** `feat(llm): implement AnthropicProvider.StreamChat()`

---

### 2.8: Integration Test (30 minutes)

#### Create Test
- [ ] Create integration test file
- [ ] Test end-to-end chat with Anthropic
- [ ] Verify streaming works
- [ ] Verify tool calling works
- [ ] Verify message format correct

**Checkpoint:** Integration test passes ✓

**Commit:** `test(llm): add Anthropic provider integration test`

---

## Phase 3: OpenAI Provider Adapter (3-4 hours)

### 3.1: Add OpenAI SDK Dependency (15 minutes)

#### Add Dependency
- [ ] Add to `go.mod`
  ```bash
  go get github.com/openai/openai-go
  ```

- [ ] Run `go mod tidy`
- [ ] Verify dependency added

**Checkpoint:** Dependency installed ✓

**Commit:** `deps: add OpenAI SDK dependency`

---

### 3.2: Create OpenAI Provider Package (15 minutes)

#### Create File
- [ ] Create `pkg/llm/providers/openai.go`

#### Define Provider Struct
- [ ] Add `OpenAIProvider` struct
  ```go
  type OpenAIProvider struct {
      client *openai.Client
      config ProviderConfig
  }
  ```

**Checkpoint:** Provider struct created ✓

**Commit:** `feat(llm): add OpenAIProvider struct`

---

### 3.3: Implement Provider Constructor (20 minutes)

#### Implement NewOpenAIProvider
- [ ] Create OpenAI client
- [ ] Validate API key
- [ ] Set default model if not specified
- [ ] Return provider instance

**Checkpoint:** Constructor works ✓

**Commit:** `feat(llm): implement OpenAIProvider constructor`

---

### 3.4: Implement Name and ValidateConfig (15 minutes)

- [ ] Implement `Name()` method
- [ ] Implement `ValidateConfig()` method

**Checkpoint:** Basic methods work ✓

**Commit:** `feat(llm): implement OpenAIProvider basic methods`

---

### 3.5: Create OpenAI Message Conversion (45 minutes)

#### Implement Conversions
- [ ] Add `convertAISDKMessageToOpenAI()` function
- [ ] Handle user messages
- [ ] Handle assistant messages
- [ ] Handle system messages
- [ ] Handle tool call messages
- [ ] Handle tool result messages

#### Unit Tests
- [ ] Test all message type conversions
- [ ] Test round-trip conversion

**Checkpoint:** Message conversion works ✓

**Commit:** `feat(llm): add AI SDK to OpenAI message conversion`

---

### 3.6: Create OpenAI Tool Conversion (30 minutes)

#### Implement Tool Conversion
- [ ] Add `convertAISDKToolToOpenAI()` function
- [ ] Handle tool definitions
- [ ] Handle tool calls
- [ ] Handle tool results

#### Unit Tests
- [ ] Test tool conversion
- [ ] Test round-trip conversion

**Checkpoint:** Tool conversion works ✓

**Commit:** `feat(llm): add AI SDK to OpenAI tool conversion`

---

### 3.7: Implement OpenAI Streaming (60 minutes)

#### Implement StreamChat Method
- [ ] Convert messages to OpenAI format
- [ ] Convert tools to OpenAI format
- [ ] Create OpenAI streaming request
- [ ] Stream responses
- [ ] Convert OpenAI events to AI SDK format
- [ ] Handle text deltas
- [ ] Handle tool calls
- [ ] Handle tool results
- [ ] Handle completion
- [ ] Handle errors

**Checkpoint:** OpenAI streaming works ✓

**Commit:** `feat(llm): implement OpenAIProvider.StreamChat()`

---

### 3.8: Integration Test (30 minutes)

#### Create Test
- [ ] Create integration test file
- [ ] Test end-to-end chat with OpenAI
- [ ] Verify streaming works
- [ ] Verify tool calling works
- [ ] Verify message format correct

**Checkpoint:** Integration test passes ✓

**Commit:** `test(llm): add OpenAI provider integration test`

---

## Phase 4: Integration & Testing (1-2 hours)

### 4.1: Update Conversational Handler (30 minutes)

#### Modify File
- [ ] Update `pkg/llm/conversational_aisdk.go`

#### Replace Direct Calls
- [ ] Remove direct `newAnthropicClient()` call
- [ ] Load provider configuration
- [ ] Create provider instance
- [ ] Use provider interface
- [ ] Pass options correctly

**Checkpoint:** Handler uses provider interface ✓

**Commit:** `refactor(llm): use provider interface in conversational handler`

---

### 4.2: Update Helm Chart (15 minutes)

#### Update Deployment Template
- [ ] Add `LLM_PROVIDER` env var to worker deployment
- [ ] Add `OPENAI_API_KEY` env var (optional)
- [ ] Add `GOOGLE_API_KEY` env var (optional)
- [ ] Add model env vars
- [ ] Update values.yaml with defaults

**Checkpoint:** Helm chart updated ✓

**Commit:** `feat(helm): add provider configuration env vars`

---

### 4.3: End-to-End Testing (30 minutes)

#### Test Provider Switching
- [ ] Set `LLM_PROVIDER=anthropic`, restart, test chat
- [ ] Set `LLM_PROVIDER=openai`, restart, test chat
- [ ] Verify both work identically
- [ ] Verify tool calling works with both
- [ ] Verify streaming works with both

#### Test Error Cases
- [ ] Invalid provider name
- [ ] Missing API key
- [ ] Invalid API key
- [ ] Verify error messages are clear

**Checkpoint:** End-to-end tests pass ✓

**Commit:** `test(llm): add provider switching end-to-end tests`

---

### 4.4: Performance Testing (15 minutes)

#### Benchmark
- [ ] Compare latency: Anthropic vs OpenAI
- [ ] Compare streaming smoothness
- [ ] Verify no significant regression
- [ ] Document any differences

**Checkpoint:** Performance acceptable ✓

**Commit:** `test(llm): add provider performance benchmarks`

---

### 4.5: Documentation Updates (30 minutes)

#### Update Documentation
- [ ] Update `ARCHITECTURE.md` with provider switching section
- [ ] Create `docs/provider-configuration.md`
- [ ] Document environment variables
- [ ] Document provider comparison
- [ ] Add examples

**Checkpoint:** Documentation complete ✓

**Commit:** `docs(llm): add provider switching documentation`

---

## Testing Checklist

### Unit Tests
- [ ] Provider configuration loading
- [ ] Provider factory function
- [ ] Message conversion (all providers)
- [ ] Tool conversion (all providers)
- [ ] Provider validation
- [ ] Error handling

### Integration Tests
- [ ] End-to-end chat with Anthropic
- [ ] End-to-end chat with OpenAI
- [ ] Provider switching
- [ ] Tool calling with both providers
- [ ] Error handling

### Manual Tests
- [ ] Switch provider via env var
- [ ] Verify chat works identically
- [ ] Verify tool calling works
- [ ] Verify streaming works smoothly
- [ ] Performance comparison
- [ ] Error messages are clear

---

## Deployment Checklist

### Pre-Deploy
- [ ] All tests passing
- [ ] No console errors
- [ ] Build successful
- [ ] Documentation updated
- [ ] Helm chart updated

### Deploy
- [ ] Update Helm values with provider config
- [ ] Deploy worker with new env vars
- [ ] Verify worker starts correctly
- [ ] Verify provider loads correctly

### Post-Deploy
- [ ] Test chat with default provider
- [ ] Test provider switching (if needed)
- [ ] Monitor for errors
- [ ] Verify performance acceptable

---

## Completion Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] Provider switching works
- [ ] Documentation complete
- [ ] Helm chart updated
- [ ] Performance acceptable
- [ ] No regressions
- [ ] Code reviewed
- [ ] Ready to merge

---

## Bug Fixing (If needed)

### Bug #1: [Title]
- [ ] Reproduced
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Tested
- [ ] Documented

---

## Notes

### Time Tracking
- Phase 1: [actual time] (estimated: 2-3 hours)
- Phase 2: [actual time] (estimated: 2-3 hours)
- Phase 3: [actual time] (estimated: 3-4 hours)
- Phase 4: [actual time] (estimated: 1-2 hours)
- **Total:** [actual time] (estimated: 8-12 hours)

### Deviations
- [Note any deviations from plan]

### Lessons Learned
- [Note any lessons learned during implementation]

---

**Status:** Ready to start! 🚀

