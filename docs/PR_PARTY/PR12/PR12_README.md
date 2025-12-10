# PR#12: Provider Switching Infrastructure - Quick Start

---

## TL;DR (30 seconds)

**What:** Add infrastructure to switch LLM providers (Anthropic, OpenAI, etc.) for chat via environment variable.

**Why:** Demonstrates provider flexibility gained from AI SDK migration, enables cost/performance optimization, and reduces single point of failure.

**Time:** 8-12 hours estimated

**Complexity:** MEDIUM

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#3, PR#4, PR#6 are complete (AI SDK migration foundation)
- ✅ You have 8-12 hours available
- ✅ You want to demonstrate provider flexibility
- ✅ You're interested in cost/performance optimization
- ✅ You understand Go interfaces and provider patterns

**Red Lights (Skip/defer it!):**
- ❌ PR#3, PR#4, or PR#6 not complete (blocking dependencies)
- ❌ Time-constrained (<8 hours)
- ❌ Not interested in provider switching
- ❌ Prefer to focus on core features first
- ❌ Not comfortable with Go provider abstraction patterns

**Decision Aid:** This is a **nice-to-have** feature (Epic 6) that demonstrates the value of the AI SDK migration. It's safe to defer if time-constrained, but valuable for showing provider flexibility. If unsure, read the [main specification](./PR12_PROVIDER_SWITCHING.md) first.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#3 complete: AI SDK Streaming Adapter working
- [ ] PR#4 complete: New Chat Streaming Endpoint working
- [ ] PR#6 complete: useChat Hook Implementation working
- [ ] AI SDK chat working end-to-end with Anthropic
- [ ] Go 1.21+ installed
- [ ] Access to Anthropic API key
- [ ] Access to OpenAI API key (for testing OpenAI provider)

### Recommended
- [ ] Read [PRD: Vercel AI SDK Migration](../../PRD-vercel-ai-sdk-migration.md) - Understand overall migration
- [ ] Read [Architecture Comparison](../../architecture-comparison.md) - Understand provider architecture
- [ ] Familiarity with Go interfaces
- [ ] Understanding of provider adapter patterns

### Setup Commands
```bash
# 1. Verify PR dependencies are complete
git log --oneline | grep -E "PR#3|PR#4|PR#6"

# 2. Navigate to project root
cd /path/to/chartsmith

# 3. Verify Go version
go version  # Should be 1.21+

# 4. Create branch
git checkout -b feat/ai-sdk-provider-switching

# 5. Verify current chat works
# (Start worker, test chat in UI)
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (45 minutes)
- [ ] Read this quick start (10 min) ✓
- [ ] Read main specification (30 min)
  - [ ] Understand provider interface design
  - [ ] Review message/tool conversion approach
  - [ ] Note key implementation steps
- [ ] Review implementation checklist (5 min)
  - [ ] Understand phase structure
  - [ ] Note testing checkpoints

### Step 2: Set Up Environment (15 minutes)
- [ ] Verify PR dependencies complete
- [ ] Create git branch
- [ ] Verify current chat works (baseline)
- [ ] Get API keys ready (Anthropic + OpenAI)

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Provider Interface & Configuration
- [ ] Follow checklist step-by-step
- [ ] Commit when phase complete

---

## Daily Progress Template

### Day 1 Goals (4-5 hours)
- [ ] Phase 1: Provider Interface & Configuration (2-3 h)
  - [ ] Provider interface defined
  - [ ] Configuration loading works
  - [ ] Environment variables added
- [ ] Phase 2: Start Anthropic Adapter (1-2 h)
  - [ ] Provider struct created
  - [ ] Basic methods implemented

**Checkpoint:** Provider interface working, Anthropic provider started

### Day 2 Goals (4-5 hours)
- [ ] Phase 2: Complete Anthropic Adapter (2-3 h)
  - [ ] Message conversion working
  - [ ] Streaming implemented
  - [ ] Integration test passes
- [ ] Phase 3: Start OpenAI Adapter (2 h)
  - [ ] OpenAI SDK added
  - [ ] Provider struct created

**Checkpoint:** Anthropic adapter complete, OpenAI adapter started

### Day 3 Goals (2-3 hours)
- [ ] Phase 3: Complete OpenAI Adapter (2-3 h)
  - [ ] Message conversion working
  - [ ] Streaming implemented
  - [ ] Integration test passes
- [ ] Phase 4: Integration & Testing (1-2 h)
  - [ ] Update conversational handler
  - [ ] End-to-end testing

**Checkpoint:** Both providers working, ready for final testing

---

## Common Issues & Solutions

### Issue 1: Provider not found error
**Symptoms:** `unknown provider: X` error  
**Cause:** Provider name typo or not implemented  
**Solution:**
```go
// Check provider name matches exactly
// Valid: "anthropic", "openai"
// Invalid: "Anthropic", "OPENAI", "anthropic-claude"
```

### Issue 2: API key not set error
**Symptoms:** `API key not set for provider: X` error  
**Cause:** Environment variable not set or wrong name  
**Solution:**
```bash
# Check env var name matches provider
# Anthropic: ANTHROPIC_API_KEY
# OpenAI: OPENAI_API_KEY
# Google: GOOGLE_API_KEY

# Verify in worker pod
kubectl exec -it <worker-pod> -- env | grep API_KEY
```

### Issue 3: Message conversion fails
**Symptoms:** Chat errors or malformed messages  
**Cause:** Message format conversion bug  
**Solution:**
- Check unit tests for conversion functions
- Verify round-trip conversion (AI SDK → Provider → AI SDK)
- Check provider-specific message format requirements
- Review provider API documentation

### Issue 4: Tool calling doesn't work
**Symptoms:** Tools not called or tool results malformed  
**Cause:** Tool format conversion bug  
**Solution:**
- Verify tool definitions match provider format
- Check tool call event conversion
- Verify tool result format
- Test with simple tool first (e.g., `latest_kubernetes_version`)

### Issue 5: Streaming stops early
**Symptoms:** Response cuts off mid-stream  
**Cause:** Stream event handling bug or timeout  
**Solution:**
- Check stream event handling logic
- Verify completion events are handled
- Check for error events
- Review provider-specific streaming format
- Increase timeout if needed

### Issue 6: Provider switching requires restart
**Symptoms:** Changing env var doesn't take effect  
**Cause:** Config loaded at startup only  
**Solution:**
- This is expected behavior (config loaded at startup)
- Restart worker pod after changing env var
- Future enhancement: dynamic provider switching

---

## Quick Reference

### Key Files
- `pkg/llm/provider.go` - Provider interface and factory (new)
- `pkg/llm/config.go` - Provider configuration loading (new)
- `pkg/llm/providers/anthropic.go` - Anthropic provider implementation (new)
- `pkg/llm/providers/openai.go` - OpenAI provider implementation (new)
- `pkg/llm/conversational_aisdk.go` - Uses provider interface (modified)
- `pkg/param/param.go` - Environment variable loading (modified)
- `chart/chartsmith/templates/chatsmith-worker-deployment.yaml` - Helm chart (modified)

### Key Functions
- `NewProvider()` - Creates provider instance based on config
- `LoadProviderConfig()` - Loads provider config from env vars
- `LLMProvider.StreamChat()` - Streams chat response (interface method)
- `convertAISDKMessageToAnthropic()` - Message format conversion
- `convertAISDKMessageToOpenAI()` - Message format conversion

### Key Concepts
- **Provider Interface:** Common interface for all LLM providers
- **Provider Factory:** Creates provider instance based on configuration
- **Message Conversion:** Converts AI SDK format to provider-specific format
- **Tool Conversion:** Converts AI SDK tools to provider-specific format
- **Streaming Adapter:** Converts provider stream events to AI SDK format

### Useful Commands
```bash
# Run tests
go test ./pkg/llm/...

# Run specific test
go test -v ./pkg/llm/providers -run TestAnthropicProvider

# Build worker
go build -o worker ./cmd/worker

# Check Go modules
go mod tidy

# Add dependency
go get github.com/openai/openai-go

# Update Helm values
helm upgrade chartsmith ./chart/chartsmith --set worker.env.LLM_PROVIDER=openai
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] `LLM_PROVIDER=anthropic` works (default, should already work)
- [ ] `LLM_PROVIDER=openai` works (new provider)
- [ ] Chat works identically with both providers
- [ ] Tool calling works with both providers
- [ ] Streaming works smoothly with both providers
- [ ] Provider can be switched via env var (with restart)
- [ ] Error messages are clear when provider misconfigured

**Performance Targets:**
- Chat latency: Same or better than current (within 10%)
- Streaming smoothness: No degradation vs. current
- Provider switching: <1 second (restart required)

---

## Help & Support

### Stuck?
1. Check main planning doc for details: `PR12_PROVIDER_SWITCHING.md`
2. Review implementation checklist: `PR12_IMPLEMENTATION_CHECKLIST.md`
3. Check provider API documentation:
   - [Anthropic API Docs](https://docs.anthropic.com/claude/reference)
   - [OpenAI API Docs](https://platform.openai.com/docs/api-reference)
4. Review existing Anthropic implementation in `pkg/llm/conversational_aisdk.go`
5. Check [Architecture Comparison](../../architecture-comparison.md) for provider details

### Want to Skip a Feature?
- **Can skip:** This is a nice-to-have feature (Epic 6)
- **Impact:** Won't block core migration, but won't demonstrate provider flexibility
- **Recommendation:** Defer if time-constrained, but valuable for showing migration success

### Running Out of Time?
- **Minimum viable:** Provider interface + Anthropic adapter (shows pattern)
- **Nice to have:** OpenAI adapter (demonstrates flexibility)
- **Can defer:** Google provider, per-workspace provider selection

**Minimum viable:** Provider interface + Anthropic adapter + basic OpenAI adapter

---

## Motivation

**You've got this!** 💪

This PR demonstrates the value of the AI SDK migration by enabling provider flexibility. You're:
- Building a clean, extensible provider abstraction
- Making it easy to switch providers based on cost/performance
- Reducing single point of failure risk
- Future-proofing the architecture

The hardest part is getting the message/tool conversion right. Take your time with the conversion functions - thorough testing here saves debugging later!

---

## Next Steps

**When ready:**
1. Verify PR dependencies complete (5 min)
2. Read main spec (30 min)
3. Review checklist (5 min)
4. Start Phase 1: Provider Interface & Configuration
5. Follow checklist step-by-step
6. Commit frequently

**After completion:**
- Provider switching documented
- Architecture updated
- Ready for production use
- Can extend to more providers later

**Status:** Ready to build! 🚀

---

## Provider Comparison Quick Reference

| Provider | Model | Cost (per 1M tokens) | Context Window | Tool Calling |
|----------|-------|---------------------|----------------|--------------|
| Anthropic | Claude 3.5 Sonnet | $3/$15 | 200K | ✅ |
| OpenAI | GPT-4 Turbo | $10/$30 | 128K | ✅ |
| Google | Gemini Pro | $0.50/$1.50 | 32K | ✅ |

**Default:** Anthropic (current provider, proven and reliable)

