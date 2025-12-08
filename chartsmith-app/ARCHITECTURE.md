# Architecture and Design for Chartsmith-app

This is a Next.js project that is the front end for Chartsmith.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REACT FRONTEND                                  │
│  ┌─────────────────┐              ┌─────────────────┐                       │
│  │   Chat UI       │              │  Jotai Atoms    │◄─── useCentrifugo     │
│  │   Components    │◄────────────►│  (State Mgmt)   │     (WebSocket)       │
│  └────────┬────────┘              └─────────────────┘          ▲            │
└───────────┼─────────────────────────────────────────────────────┼────────────┘
            │ useAISDKChatAdapter                                 │
            ▼                                                     │
┌─────────────────────────────────────────────────────────────────┼────────────┐
│                     NEXT.JS + VERCEL AI SDK LAYER               │            │
│                                                                 │            │
│  ┌──────────────────────────────────────────────────────────────┼─────────┐  │
│  │                      /api/chat Route                         │         │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┴───────┐ │  │
│  │  │ Intent Classify │───►│   streamText    │───►│  6 TypeScript Tools │ │  │
│  │  │ (plan/proceed/  │    │   (AI SDK v5)   │    │  with Go HTTP calls │ │  │
│  │  │  ai-sdk/render) │    └────────┬────────┘    └─────────────────────┘ │  │
│  │  └─────────────────┘             │                                     │  │
│  └──────────────────────────────────┼─────────────────────────────────────┘  │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────┐                                 │
│                          │   OpenRouter    │  ◄── Multi-Provider LLM         │
│                          │  Claude Sonnet  │      (Switch models live!)      │
│                          │  GPT-4o, etc.   │                                 │
│                          └─────────────────┘                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTP (Tool Execution)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           GO HTTP API LAYER                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  /api/tools/editor  │  /api/validate  │  /api/intent/classify          │ │
│  │  /api/tools/context │  /api/tools/convert  │  /api/plan/create-from-tools │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│        ┌────────────────────────────┴────────────────────────────┐           │
│        ▼                                                         ▼           │
│  ┌─────────────────┐                                    ┌─────────────────┐  │
│  │  Plan Workflow  │                                    │   Centrifugo    │  │
│  │  (buffered tool │                                    │   (Real-time)   │──┼──► WebSocket
│  │   calls, review │                                    │                 │  │
│  │   → applied)    │                                    └─────────────────┘  │
│  └────────┬────────┘                                                         │
│           │                                                                  │
└───────────┼──────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL                                       │
│  workspace_plan (buffered_tool_calls)  │  workspace_chat  │  workspace_file  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key Architecture Points:**
- **Vercel AI SDK** handles streaming, tool orchestration, and multi-step agents
- **OpenRouter** provides multi-provider LLM access (Claude, GPT-4, Mistral)
- **TypeScript Tools** call Go HTTP endpoints for file ops, validation, Helm commands
- **Intent Classification** routes messages: plan vs execute vs conversational
- **Plan Workflow** buffers tool calls for user review before execution
- **Centrifugo** provides real-time WebSocket updates, coordinated with AI SDK streaming

---

## Monaco Editor Implementation
- Avoid recreating editor instances
- Use a single editor instance with model swapping for better performance
- Properly clean up models to prevent memory leaks
- We want to make sure that we don't show a "Loading..." state because it causes a lot of UI flashes.

## State Management
- Do not pass onChange and other callbacks through to child components
- We use jotai for state, each component should be able to get or set the state it needs
- Each component subscribes to the relevant atoms. This is preferred over callbacks.

## SSR
- We use server side rendering to avoid the "loading" state whenever possible.
- Move code that requires "use client" into separate controls.

## Database and functions
- We aren't using Next.JS API routes, except when absolutely necessary.
- Front end should call server actions, which call lib/* functions.
- Database queries are not allowed in the server action. Server actions are just wrappers for which lib functions we expose.

## AI SDK Integration Overview

Chartsmith uses the Vercel AI SDK for all LLM interactions. The AI SDK provides streaming chat, tool execution, and multi-provider support.

### AI SDK Packages

```
ai: ^5.0.106                      # Core AI SDK
@ai-sdk/react: ^2.0.106           # React hooks (useChat)
@ai-sdk/anthropic: ^2.0.53        # Anthropic provider
@ai-sdk/openai: ^2.0.77           # OpenAI provider
@openrouter/ai-sdk-provider: ^1.3.0  # OpenRouter unified gateway
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI SDK Chat System                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  components/chat/              lib/ai/                           │
│  ├── ProviderSelector.tsx     ├── provider.ts  (getModel)       │
│  ├── LiveProviderSwitcher.tsx ├── models.ts    (model defs)     │
│  └── ValidationResults.tsx    ├── config.ts    (defaults)       │
│                               ├── prompts.ts   (system prompts) │
│  hooks/                       ├── intent.ts    (classification) │
│  └── useAISDKChatAdapter.ts   ├── plan.ts      (plan creation)  │
│                               └── tools/       (6 tools)        │
│                                                                  │
│  app/api/chat/route.ts        ← streamText + intent routing     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP (JSON)
┌─────────────────────────────────────────────────────────────────┐
│                    GO BACKEND (port 8080)                        │
│                                                                  │
│  pkg/api/server.go              - HTTP server + routes           │
│  pkg/api/handlers/editor.go     - File operations                │
│  pkg/api/handlers/versions.go   - Version lookups                │
│  pkg/api/handlers/context.go    - Chart context                  │
│  pkg/api/handlers/intent.go     - Intent classification          │
│  pkg/api/handlers/plan.go       - Plan creation                  │
│  pkg/api/handlers/validate.go   - Chart validation               │
│  pkg/api/handlers/conversion.go - K8s conversion                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Environment Variables

```env
# Provider API Keys (at least one required)
OPENROUTER_API_KEY=sk-or-v1-xxxxx    # Recommended: unified gateway
ANTHROPIC_API_KEY=sk-ant-xxxxx       # Direct Anthropic access
OPENAI_API_KEY=sk-xxxxx              # Direct OpenAI access

# Provider Configuration
USE_OPENROUTER_PRIMARY=true          # Use OpenRouter as primary (default)
DEFAULT_AI_PROVIDER=anthropic        # Default provider
DEFAULT_AI_MODEL=anthropic/claude-sonnet-4  # Default model

# Backend
GO_BACKEND_URL=http://localhost:8080 # Go HTTP server
NEXT_PUBLIC_USE_AI_SDK_CHAT=true     # Enable AI SDK (default)
```

## AI SDK Tools

The AI SDK provides 6 tools for chart operations:

| Tool | TypeScript File | Go Endpoint | Purpose |
|------|-----------------|-------------|---------|
| `getChartContext` | `getChartContext.ts` | `/api/tools/context` | Load workspace files and metadata |
| `textEditor` | `textEditor.ts` | `/api/tools/editor` | View, create, edit files |
| `latestSubchartVersion` | `latestSubchartVersion.ts` | `/api/tools/versions/subchart` | Subchart version lookup |
| `latestKubernetesVersion` | `latestKubernetesVersion.ts` | `/api/tools/versions/kubernetes` | K8s version info |
| `validateChart` | `validateChart.ts` | `/api/validate` | Helm lint, template, kube-score |
| `convertK8sToHelm` | `convertK8s.ts` | `/api/conversion/start` | K8s manifest conversion |

### Tool Files

| File | Purpose |
|------|---------|
| `lib/ai/tools/index.ts` | Tool exports and `createTools()` factory |
| `lib/ai/tools/bufferedTools.ts` | Buffered tools for plan workflow |
| `lib/ai/tools/toolInterceptor.ts` | Buffer management infrastructure |
| `lib/ai/tools/utils.ts` | `callGoEndpoint()` HTTP helper |

### Tool Execution Modes

**Immediate Execution** (read-only operations):
- `getChartContext` - always immediate
- `textEditor` with `view` command - always immediate
- `latestSubchartVersion` - always immediate
- `latestKubernetesVersion` - always immediate
- `validateChart` - always immediate

**Buffered Execution** (file modifications):
- `textEditor` with `create` command - buffered for plan
- `textEditor` with `str_replace` command - buffered for plan

## Intent Classification (PR3.0)

User prompts are classified via Go backend before AI SDK processing:

### Intent Types

| Intent | Route | Behavior |
|--------|-------|----------|
| `off-topic` | Immediate decline | No LLM call, polite message |
| `proceed` | Execute plan | Run buffered tools |
| `render` | Trigger render | Chart preview |
| `plan` | Plan mode | AI SDK without tools |
| `ai-sdk` | Normal | AI SDK with tools |

### Intent Flow

1. User sends message to `/api/chat`
2. Route calls Go `/api/intent/classify` (Groq-based)
3. Intent determines routing path
4. Off-topic returns immediately without LLM call
5. Other intents proceed to AI SDK

### Key Files

| File | Purpose |
|------|---------|
| `lib/ai/intent.ts` | `classifyIntent()` and `routeFromIntent()` |
| `pkg/api/handlers/intent.go` | Go intent classification endpoint |

## Plan Workflow (PR3.0)

File modifications go through a plan-based approval workflow, matching legacy Go worker behavior.

### Buffered Tool Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User: "Create a deployment.yaml for nginx"                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. /api/chat receives request                                  │
│  2. Intent classified as "ai-sdk" (proceed with tools)          │
│  3. AI SDK streamText() with buffered tools                     │
│  4. AI calls textEditor({ command: "create", path: "..." })     │
│  5. Tool BUFFERS the call, returns { buffered: true }           │
│  6. AI continues explaining what it will create                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. onFinish: bufferedToolCalls.length > 0                      │
│  8. Call Go /api/plan/create-from-tools                         │
│  9. Plan created with status "review"                           │
│  10. Centrifugo publishes plan-updated event                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  11. Frontend receives event                                     │
│  12. PlanChatMessage renders with Proceed/Ignore buttons        │
│  13. User clicks Proceed → proceedPlanAction() executes tools   │
│  14. Files written to content_pending                           │
│  15. User can Commit/Discard changes                            │
└─────────────────────────────────────────────────────────────────┘
```

### Plan Key Files

| File | Purpose |
|------|---------|
| `lib/ai/plan.ts` | `createPlanFromToolCalls()` client |
| `lib/ai/tools/bufferedTools.ts` | `createBufferedTools()` factory |
| `lib/ai/tools/toolInterceptor.ts` | `BufferedToolCall` interface |
| `lib/workspace/actions/proceed-plan.ts` | `proceedPlanAction()` server action |
| `pkg/api/handlers/plan.go` | Plan creation and update endpoints |

### Text-Only Plans

When intent is classified as `plan` but no tool calls are made:
1. AI SDK runs without tools (plan generation mode)
2. AI describes what it will do in natural language
3. `onFinish` creates text-only plan with description
4. User clicks Proceed → `executeViaAISDK()` runs with tools enabled

## Chart Validation (PR4)

The `validateChart` tool runs a three-stage validation pipeline: helm lint, helm template, and kube-score.

### Go Validation Package

The `pkg/validation/` package implements the validation pipeline:

| File | Purpose |
|------|---------|
| `pkg/validation/types.go` | ValidationRequest/Result types and issue structures |
| `pkg/validation/helm.go` | Helm lint and helm template execution with output parsing |
| `pkg/validation/kubescore.go` | Kube-score execution with JSON parsing and suggestions |
| `pkg/validation/pipeline.go` | Three-stage validation orchestration using `workspace.ListCharts()` |

### Validation Pipeline Flow

1. **Helm Lint** - Validates chart structure and syntax
2. **Helm Template** - Renders templates to catch rendering errors
3. **Kube-score** - Static analysis of rendered manifests (non-fatal failures)

### Validation Response

```typescript
{
  overall_status: "pass" | "warning" | "fail";
  timestamp: string;
  duration_ms: number;
  results: {
    helm_lint: LintResult;
    helm_template?: TemplateResult;
    kube_score?: ScoreResult;
  };
}
```

### Validation State Management

- `atoms/validationAtoms.ts` - Jotai atoms for validation state
- `responseValidationId` added to `Message` interface in `components/types.ts`
- `ValidationResults` integrated into `ChatMessage.tsx`'s `SortedContent` component

### Validation UI

`components/chat/ValidationResults.tsx` displays:
- Overall status badge (pass/warning/fail)
- Issues grouped by severity (critical > warning > info)
- Collapsible detail panels per issue
- Kube-score summary
- Metadata with duration

### Validation Key Files

| File | Purpose |
|------|---------|
| `lib/ai/tools/validateChart.ts` | AI SDK tool factory |
| `lib/ai/tools/index.ts` | Tool registration |
| `lib/ai/tools/bufferedTools.ts` | Buffered tools registration |
| `atoms/validationAtoms.ts` | Validation state atoms |
| `components/chat/ValidationResults.tsx` | Results display component |
| `components/types.ts` | Message interface with `responseValidationId` |
| `pkg/validation/types.go` | Go validation types |
| `pkg/validation/helm.go` | Helm lint/template execution |
| `pkg/validation/kubescore.go` | Kube-score execution |
| `pkg/validation/pipeline.go` | Pipeline orchestration |
| `pkg/api/handlers/validate.go` | POST /api/validate handler |

## Live Provider Switching (PR4)

Users can switch AI providers mid-conversation without losing context.

### Supported Providers

| Provider | Models | Default |
|----------|--------|---------|
| Anthropic | Claude Sonnet 4 | ✅ |
| OpenAI | GPT-4o, GPT-4o Mini | |

### Provider Priority

When `USE_OPENROUTER_PRIMARY=true` (default):
1. OpenRouter (unified gateway) - primary
2. Direct Anthropic API - fallback
3. Direct OpenAI API - fallback

When `USE_OPENROUTER_PRIMARY=false`:
1. Direct provider API - primary
2. OpenRouter - fallback

### Provider Switching Flow

1. User clicks `LiveProviderSwitcher` in chat header
2. Selects new provider/model from dropdown
3. `switchProvider()` updates adapter state
4. Next message uses new provider via `getChatBody()`
5. Conversation context preserved (messages unchanged)

### Implementation Details

**useAISDKChatAdapter.ts extensions:**
- `selectedProvider` and `selectedModel` state
- `switchProvider()` callback for state updates
- `getChatBody()` updated to use dynamic provider/model

**useLegacyChat.ts:**
- Extended for interface compatibility with adapter

**ChatContainer.tsx:**
- `LiveProviderSwitcher` integrated into input area

### Provider Key Files

| File | Purpose |
|------|---------|
| `lib/ai/provider.ts` | `getModel()` factory with fallback logic |
| `lib/ai/models.ts` | Model and provider definitions |
| `lib/ai/config.ts` | Default provider/model constants |
| `components/chat/ProviderSelector.tsx` | Initial provider selection (locks after first message) |
| `components/chat/LiveProviderSwitcher.tsx` | Dropdown component for mid-conversation switching |
| `hooks/useAISDKChatAdapter.ts` | State management and `switchProvider()` callback |
| `hooks/useLegacyChat.ts` | Interface compatibility for legacy path |
| `components/ChatContainer.tsx` | LiveProviderSwitcher integration |

## Chat Adapter (PR2.0)

`useAISDKChatAdapter` bridges AI SDK's `useChat` hook with existing Chartsmith patterns.

### Adapter Responsibilities

- Converts AI SDK `UIMessage` to Chartsmith `Message` format
- Merges streaming messages with Jotai atom state
- Persists responses to database on completion
- Generates followup actions based on tool calls
- Coordinates with Centrifugo to prevent conflicts
- Exposes provider switching state

### Message Format Mapping

| UIMessage Field | Message Field | Notes |
|-----------------|---------------|-------|
| `parts[].text` (user) | `prompt` | User message content |
| `parts[].text` (assistant) | `response` | AI response content |
| `status === 'streaming'` | `isComplete: false` | Streaming state |
| `status === 'ready'` | `isComplete: true` | Complete state |

### Persona Support

| Persona | System Prompt | Focus |
|---------|---------------|-------|
| `auto` | `CHARTSMITH_TOOL_SYSTEM_PROMPT` | General assistant |
| `developer` | `CHARTSMITH_DEVELOPER_PROMPT` | Technical deep-dive |
| `operator` | `CHARTSMITH_OPERATOR_PROMPT` | Practical usage |

### Adapter Key Files

| File | Purpose |
|------|---------|
| `hooks/useAISDKChatAdapter.ts` | Main adapter hook |
| `lib/chat/messageMapper.ts` | Format conversion utilities |
| `lib/ai/prompts.ts` | Persona-specific system prompts |

## Go HTTP API Endpoints

### Tool Endpoints

| Endpoint | Handler | Purpose |
|----------|---------|---------|
| `POST /api/tools/editor` | `handlers.TextEditor` | View/create/edit files |
| `POST /api/tools/versions/subchart` | `handlers.GetSubchartVersion` | Subchart lookup |
| `POST /api/tools/versions/kubernetes` | `handlers.GetKubernetesVersion` | K8s version |
| `POST /api/tools/context` | `handlers.GetChartContext` | Workspace files |

### Intent/Plan Endpoints

| Endpoint | Handler | Purpose |
|----------|---------|---------|
| `POST /api/intent/classify` | `handlers.ClassifyIntent` | Groq intent classification |
| `POST /api/plan/create-from-tools` | `handlers.CreatePlanFromToolCalls` | Create plan from buffered calls |
| `POST /api/plan/update-action-file-status` | `handlers.UpdateActionFileStatus` | Update file status |
| `POST /api/plan/publish-update` | `handlers.PublishPlanUpdate` | Publish plan event |

### Other Endpoints

| Endpoint | Handler | Purpose |
|----------|---------|---------|
| `POST /api/validate` | `handlers.ValidateChart` | Run validation pipeline |
| `POST /api/conversion/start` | `handlers.StartConversion` | Start K8s conversion |
| `GET /health` | inline | Health check |

### Error Response Format

All Go endpoints return standardized JSON errors:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

Error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `INTERNAL_ERROR`, `EXTERNAL_API_ERROR`

## Centrifugo Integration

Real-time updates are published via Centrifugo:

| Event | Purpose |
|-------|---------|
| `artifact-updated` | File changes in workspace |
| `plan-updated` | Plan status/files changed |
| `chatmessage-updated` | Chat message updated (plan ID linked) |
| `conversion-status` | K8s conversion progress |

### Streaming Coordination

- `currentStreamingMessageIdAtom` tracks active streaming message
- Centrifugo updates are skipped for actively streaming messages
- Prevents race conditions between streaming and DB updates

## Rollback Procedure

If issues occur with AI SDK path:

1. Set `NEXT_PUBLIC_USE_AI_SDK_CHAT=false`
2. Redeploy - changes take effect immediately
3. Users fall back to legacy Go worker path

## Migration Progress

- [x] AI SDK chat integration (PR1)
- [x] Tool support via Go HTTP (PR1.5)
- [x] Main workspace integration (PR2.0)
- [x] Intent classification (PR3.0)
- [x] Plan workflow parity (PR3.0)
- [x] K8s conversion bridge (PR3.0)
- [x] Chart validation tool (PR4)
- [x] Live provider switching (PR4)
- [ ] Remove legacy Go LLM code (future)

## Testing

- Unit tests: `lib/ai/__tests__/`, `app/api/chat/__tests__/`
- Integration tests: `lib/ai/__tests__/integration/tools.test.ts`
- E2E tests: `npx playwright test`
- Mock utilities: `lib/__tests__/ai-mock-utils.ts`
- No real API calls in unit tests - all mocked for speed and determinism
