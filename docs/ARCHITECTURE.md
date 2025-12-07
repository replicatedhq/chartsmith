# ChartSmith Architecture

This document describes the ChartSmith architecture, with particular focus on the AI SDK migration status.

## Overview

ChartSmith is a Helm chart development assistant that uses AI to help create and modify Helm charts. The architecture consists of:

- **TypeScript Frontend**: Next.js application with React components
- **TypeScript Backend**: Next.js API routes and server actions
- **Go Backend**: HTTP API server handling file operations and real-time events
- **PostgreSQL**: Database for workspaces, plans, and chat history
- **Centrifugo**: Real-time event streaming to the UI

## AI SDK Migration Status

### Current Architecture (Hybrid)

The system is transitioning from a Go-based LLM implementation to a TypeScript AI SDK implementation.

| Component | Current Implementation |
|-----------|----------------------|
| Plan Generation | AI SDK (TypeScript) |
| Plan Execution | AI SDK (TypeScript) for new plans, Go for legacy plans |
| File Operations | Go backend via `/api/tools/editor` |
| Real-time Events | Go backend via Centrifugo |

### Execution Paths

#### 1. AI SDK Path (Recommended)

This is the new execution path for plans created via the AI SDK.

**Plan Generation:**
- Plans created via `/api/chat` route with intent classification
- Uses `CHARTSMITH_PLAN_SYSTEM_PROMPT` without tools (forces descriptive text)
- Creates plan record with empty `bufferedToolCalls` array
- Plan text stored in `description` field

**Plan Execution:**
- Triggered when user clicks "Proceed" on a text-only plan
- Uses `executeViaAISDK()` server action
- Calls AI SDK with `CHARTSMITH_EXECUTION_SYSTEM_PROMPT` + `textEditor` tool
- File list built dynamically during execution via `onStepFinish` callback
- Go backend only handles file I/O via `/api/tools/editor`

**Key Files:**
- `chartsmith-app/app/api/chat/route.ts` - Plan generation
- `chartsmith-app/lib/workspace/actions/execute-via-ai-sdk.ts` - Plan execution
- `chartsmith-app/lib/ai/prompts.ts` - System prompts
- `chartsmith-app/lib/ai/tools/textEditor.ts` - Tool definition

#### 2. AI SDK Path with Buffered Tool Calls

For plans that were generated with tools enabled (buffered execution).

**Plan Generation:**
- Plans created via `/api/chat` route with tools enabled
- Tool calls buffered during streaming
- Creates plan record with populated `bufferedToolCalls` array

**Plan Execution:**
- Triggered when user clicks "Proceed" on a plan with buffered tool calls
- Uses `proceedPlanAction()` server action
- Executes stored tool calls directly via Go `/api/tools/editor`
- No additional LLM call required

**Key Files:**
- `chartsmith-app/lib/workspace/actions/proceed-plan.ts` - Buffered execution

#### 3. Legacy Go Path (Deprecated)

This is the original execution path that makes direct Anthropic API calls from Go.

**Plan Generation:**
- Plans created via Go queue workers
- Uses `CreateInitialPlan()` or `CreatePlan()` functions

**Plan Execution:**
- Triggered via `execute_plan` → `apply_plan` queue jobs
- Uses `CreateExecutePlan()` and `ExecuteAction()` functions
- Go makes direct Anthropic API calls

**Key Files (Deprecated):**
- `pkg/llm/initial-plan.go` - Initial plan generation
- `pkg/llm/plan.go` - Plan generation
- `pkg/llm/execute-plan.go` - Execution plan generation
- `pkg/llm/execute-action.go` - File action execution
- `pkg/listener/execute-plan.go` - Queue job handler

### Migration Progress

- [x] Plan generation via AI SDK (`/api/chat` route)
- [x] Tool execution via Go `/api/tools/editor`
- [x] Buffered tool call execution via `proceedPlanAction`
- [x] AI SDK execution path for text-only plans (`executeViaAISDK`)
- [x] Dynamic action file building during execution
- [ ] Remove legacy Go LLM code (future)
- [ ] Migrate all remaining Go Anthropic calls (future)

### Key Differences from Legacy Path

| Aspect | Legacy (Go) | AI SDK (TypeScript) |
|--------|-------------|---------------------|
| LLM Calls | Go → Anthropic | TypeScript → OpenRouter/Anthropic |
| File List | Generated upfront via XML parsing | Built dynamically during execution |
| Tool Execution | Go-native | Go via HTTP API |
| Provider Switching | Hardcoded Anthropic | Configurable (OpenAI, Anthropic, etc.) |
| Streaming | Custom channels | AI SDK Text Stream protocol |

## File Structure

```
chartsmith/
├── chartsmith-app/           # TypeScript/Next.js application
│   ├── app/api/chat/         # AI SDK chat endpoint
│   ├── components/           # React components
│   ├── lib/ai/               # AI SDK configuration
│   │   ├── prompts.ts        # System prompts
│   │   ├── tools/            # AI SDK tool definitions
│   │   └── provider.ts       # Model provider configuration
│   └── lib/workspace/actions/# Server actions
│       ├── execute-via-ai-sdk.ts  # AI SDK execution
│       └── proceed-plan.ts        # Buffered execution
├── pkg/                      # Go backend packages
│   ├── api/handlers/         # HTTP handlers
│   ├── llm/                  # LLM functions (deprecated)
│   └── listener/             # Queue job handlers
└── docs/                     # Documentation
```

## Real-time Updates

Both execution paths publish plan updates via Centrifugo:

1. **Status Changes**: `PlanUpdatedEvent` when status changes (review → applying → applied)
2. **Action Files**: `PlanUpdatedEvent` when files are added or their status changes
3. **Chat Messages**: `ChatMessageUpdatedEvent` when plan ID is linked to chat message

The TypeScript AI SDK path calls Go's `/api/plan/publish-update` and `/api/plan/update-action-file-status` endpoints to trigger these events.

## Error Handling

Both paths follow the same error handling pattern:

- On execution failure, plan status is reset to `review`
- User can retry the operation
- Partial success is allowed (some files may be created even if others fail)

## Future Work

1. **Remove Legacy Go LLM Code**: Once AI SDK execution is proven stable
2. **Embedding-based File Selection**: Use embeddings to choose relevant files for editing
3. **Multi-provider Support**: Full support for switching between AI providers
4. **Streaming Improvements**: Better progress indication during execution
