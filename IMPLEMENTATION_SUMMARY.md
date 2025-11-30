# Vercel AI SDK Migration - Implementation Summary

## 🎯 Project Goal
Migrate Chartsmith to use Vercel AI SDK while keeping the Go worker backend intact, adding support for multiple AI providers (Anthropic + OpenRouter) with a user-friendly provider/model selection UI.

## 📋 Requirements Alignment

### From Project Document: "Hiring Project_ Replicated _ Chartsmith.md"

| Requirement | Our Approach | PRs |
|-------------|--------------|-----|
| **Replace custom chat UI with Vercel AI SDK** | Use `useChat()` hook for conversational chat | #3, #4 |
| **Migrate from direct @anthropic-ai/sdk to AI SDK Core** | Use `@ai-sdk/anthropic` and `@ai-sdk/openai` | #1, #3 |
| **Maintain all existing chat functionality** | Hybrid approach: AI SDK + Go worker | #4, #5 |
| **Keep existing system prompts and behavior** | Port prompts to TypeScript, preserve logic | #3, #5 |
| **All existing features work (tool calling, file context)** | Implement tools in AI SDK, integrate with DB | #5, #6 |
| **Tests pass or are updated** | Update all tests, add new E2E tests | #7 |
| **Demonstrate easy provider switching** | Add UI dropdowns for provider/model selection | #2 |
| **Improve streaming experience** | Use AI SDK optimized streaming | #4, #9 |

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                          │
│                                                                  │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ChatContainer  │  │  Provider    │  │    Model     │      │
│  │  (useChat())   │  │  Selector    │  │   Selector   │      │
│  └────────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│           │                  │                  │               │
│           └──────────────────┴──────────────────┘               │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                v                             v
    ┌───────────────────┐         ┌─────────────────────┐
    │  /api/ai-chat     │         │  Go Worker          │
    │  (Vercel AI SDK)  │         │  (Existing)         │
    │                   │         │                     │
    │  • Conversational │         │  • Plan Generation  │
    │  • Streaming      │         │  • Conversions      │
    │  • Tool Calling   │         │  • Complex Ops      │
    └─────────┬─────────┘         └──────────┬──────────┘
              │                              │
              │        ┌─────────────────────┤
              │        │                     │
              v        v                     v
    ┌─────────────────────┐       ┌──────────────────┐
    │   Anthropic API     │       │   Centrifugo     │
    │   OpenRouter API    │       │   (WebSocket)    │
    └─────────────────────┘       └──────────────────┘
                                           │
                                           v
                                  ┌──────────────────┐
                                  │   PostgreSQL     │
                                  │   + pgvector     │
                                  └──────────────────┘
```

## 🔄 Message Flow

### Conversational Chat (NEW - Vercel AI SDK)
```
User Input → ChatContainer (useChat hook) → /api/ai-chat
  ↓
Provider Selection (Anthropic/OpenRouter)
  ↓
Model Selection (Claude 3.7, GPT-4, etc.)
  ↓
Vercel AI SDK (streamText)
  ↓
Provider API (Anthropic or OpenRouter)
  ↓
Streaming Response → UI
  ↓
Save to PostgreSQL workspace_chat table
```

### Complex Operations (EXISTING - Go Worker)
```
User Input → ChatContainer → createChatMessageAction
  ↓
Intent Classification
  ↓
Go Worker (enqueueWork)
  ↓
Anthropic Go SDK
  ↓
Centrifugo WebSocket → Real-time UI updates
  ↓
Save to PostgreSQL
```

## 📦 10 PR Breakdown

| PR | Title | Scope | Estimated Time |
|----|-------|-------|----------------|
| #1 | Dependencies & Configuration | Install AI SDK packages, update Next.js | 1-2 hrs |
| #2 | Provider & Model Selection UI | Build dropdowns, Jotai atoms | 3-4 hrs |
| #3 | Vercel AI SDK API Route | Create `/api/ai-chat`, provider factory | 6-8 hrs |
| #4 | Frontend Migration to useChat | Migrate ChatContainer, integrate hook | 6-8 hrs |
| #5 | Integration with Existing Architecture | Intent classification, hybrid routing | 8-10 hrs |
| #6 | Tool Calling & Advanced Features | Implement tools in AI SDK | 6-8 hrs |
| #7 | Testing & Validation | Unit tests, E2E tests, Playwright | 6-8 hrs |
| #8 | Documentation & Architecture Updates | Update ARCHITECTURE.md, README | 3-4 hrs |
| #9 | Performance Optimization & Polish | Streaming optimizations, error handling | 4-6 hrs |
| #10 | Demo Video & Final Submission | Record demo, prepare PR | 2-3 hrs |

**Total:** 45-61 hours

## 🎨 UI Changes

### Before
```
┌─────────────────────────────────┐
│  Chart Development Chat         │
├─────────────────────────────────┤
│                                 │
│  Messages...                    │
│                                 │
├─────────────────────────────────┤
│  [Enter message...]       [Send]│
└─────────────────────────────────┘
```

### After
```
┌─────────────────────────────────┐
│  Chart Development Chat         │
├─────────────────────────────────┤
│                                 │
│  Messages...                    │
│                                 │
├─────────────────────────────────┤
│  [Provider ▼]  [Model ▼]        │
│  [Enter message...]       [Send]│
└─────────────────────────────────┘
```

Provider dropdown options:
- 🟣 Anthropic
- 🔵 OpenRouter

Model dropdown (dynamic based on provider):
- **Anthropic:** Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3 Opus
- **OpenRouter:** GPT-4, Claude 3.5, Mixtral, Llama 3, etc.

## 🔑 Key Technical Decisions

### 1. Hybrid Approach
**Decision:** Keep Go worker for complex operations, add AI SDK for conversational chat

**Rationale:**
- ✅ Minimal disruption to existing architecture
- ✅ Maintains proven Go worker stability
- ✅ Demonstrates AI SDK capabilities
- ✅ Preserves Centrifugo real-time features
- ✅ Easier to review and test incrementally

**Alternative Considered:** Full migration (replace Go worker entirely)
- ❌ Higher risk of breaking changes
- ❌ Requires rewriting all LLM logic
- ❌ Loses Centrifugo integration benefits
- ❌ Harder to roll back if issues arise

### 2. Intent Classification
**Decision:** Classify user intents to route to appropriate handler

**Implementation:**
```typescript
// Conversational: "What's the purpose of this values.yaml?"
→ /api/ai-chat (Vercel AI SDK)

// Plan/Action: "Add a PostgreSQL database to the chart"
→ Go Worker (Existing path)

// Conversion: "Convert these K8s manifests to Helm"
→ Go Worker (Existing path)
```

### 3. State Management
**Decision:** Use Jotai atoms for provider/model selection, integrate with AI SDK

**Pattern:**
```typescript
// atoms/ai-provider.ts
export const aiProviderAtom = atom('anthropic');
export const aiModelAtom = atom('claude-3-5-sonnet-20241022');

// ChatContainer.tsx
const [provider] = useAtom(aiProviderAtom);
const [model] = useAtom(aiModelAtom);

const { messages, input, handleSubmit } = useChat({
  body: { provider, model, workspaceId }
});
```

### 4. OpenRouter Integration
**Decision:** Use `@ai-sdk/openai` with custom baseURL

**Implementation:**
```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Use like: openrouter('openai/gpt-4')
```

### 5. Database Schema
**Decision:** Keep existing `workspace_chat` table schema

**Rationale:**
- ✅ No migrations needed
- ✅ Compatible with both AI SDK and Go worker messages
- ✅ Maintains chat history across systems
- ✅ Existing queries continue to work

## 🧪 Testing Strategy

### Unit Tests
- Provider factory
- Model configuration
- Intent classifier
- System prompt builder
- Tool implementations

### Integration Tests
- API route with both providers
- Database message persistence
- Context building with file data
- Tool calling end-to-end

### E2E Tests (Playwright)
- Provider selection and switching
- Model selection within provider
- Conversational chat flow
- Plan generation still uses Go worker
- File context in responses
- Tool calling (subchart lookup)
- Streaming behavior

### Manual Testing
- ✅ Start app successfully
- ✅ Create new chart via chat
- ✅ Streaming responses work
- ✅ Switch providers mid-conversation
- ✅ Complex operations work (plans, conversions)
- ✅ All existing features functional

## 📝 Documentation Updates

### Files to Update
1. `chartsmith-app/ARCHITECTURE.md` - AI integration details
2. `ARCHITECTURE.md` - System-wide architecture changes
3. `MIGRATION.md` (new) - Migration decisions and rationale
4. `README.md` - New environment variables, usage instructions
5. `.env.local.example` - AI provider configuration
6. `CONTRIBUTING.md` - Developer setup with AI providers

### Key Documentation Points
- Hybrid architecture explanation
- Provider/model selection usage
- Environment variable configuration
- Intent classification logic
- When to use AI SDK vs Go worker
- Future migration considerations

## 🎥 Demo Video Outline

### Sections (5-7 minutes total)

1. **Introduction** (30 sec)
   - Project overview
   - Migration goals

2. **Application Start** (30 sec)
   - `npm run dev`
   - `make run-worker`
   - Login and navigate to workspace

3. **Provider Selection** (1 min)
   - Show dropdown UI
   - Select Anthropic → Claude 3.7 Sonnet
   - Show streaming conversation
   - Switch to OpenRouter → GPT-4
   - Continue same conversation

4. **Features Demo** (2 min)
   - Create new chart via conversational chat
   - Ask about chart structure (conversational)
   - Request chart modification (triggers Go worker)
   - Show file context in responses
   - Demonstrate tool calling (subchart lookup)

5. **Code Walkthrough** (2 min)
   - Show `useChat()` hook integration
   - Show provider factory pattern
   - Show API route implementation
   - Show hybrid routing logic

6. **Testing & Wrap-up** (1 min)
   - Run tests
   - Highlight improvements
   - Future enhancements

## ✅ Success Criteria

### Must Have (All Required)
- [x] Dependencies updated (Next.js, React, AI SDK)
- [ ] Vercel AI SDK integrated for chat
- [ ] Provider selection UI (Anthropic + OpenRouter)
- [ ] Model selection UI (dynamic based on provider)
- [ ] Streaming works with both providers
- [ ] Go worker preserved for complex operations
- [ ] All existing features work
- [ ] Tests pass
- [ ] Documentation updated

### Nice to Have (Bonus)
- [ ] Performance optimizations
- [ ] Smooth provider switching
- [ ] Token usage display
- [ ] Error handling enhancements
- [ ] State persistence (localStorage)

## 🚀 Getting Started

### Prerequisites (Already Done)
- ✅ Repository forked and cloned
- ✅ Dependencies updated (Next.js 15.5.6, React 19.2.0)
- ✅ Vercel AI SDK packages installed

### Next Step
**Review PR_PLAN.md** and get approval to proceed with PR #1

### Environment Setup
```bash
# Add to chartsmith-app/.env.local
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
NEXT_PUBLIC_DEFAULT_AI_PROVIDER=anthropic
NEXT_PUBLIC_DEFAULT_AI_MODEL=claude-3-5-sonnet-20241022
```

## 📊 Project Timeline

```
Week 1: PRs #1-3 (Dependencies, UI, API Route)
Week 2: PRs #4-6 (Frontend Migration, Integration, Tools)
Week 3: PRs #7-9 (Testing, Documentation, Polish)
Week 4: PR #10 (Demo & Submission)
```

## 🤝 Collaboration

- **Review Points:** After each PR
- **Testing:** Continuous (unit + E2E)
- **Demo:** End of Week 3
- **Submission:** Week 4

---

**Ready to proceed?** Review `PR_PLAN.md` for detailed PR specifications and let me know if you'd like to start with PR #1! 🚀

