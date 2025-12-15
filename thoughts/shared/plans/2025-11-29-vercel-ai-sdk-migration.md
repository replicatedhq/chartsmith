# Vercel AI SDK Migration Implementation Plan

## Overview

Migrate Chartsmith from direct Anthropic SDK usage (Go backend + custom streaming) to Vercel AI SDK (Next.js API routes + `useChat` hook). This simplifies the codebase, improves maintainability, and enables easy provider switching.

## Current State Analysis

### Architecture Before
```
User Input → createChatMessageAction() → DB Insert → pg_notify()
    → Go Worker (pkg/listener/) → Anthropic SDK (pkg/llm/)
    → Centrifugo WebSocket → Frontend (useCentrifugo hook)
```

### Key Components to Migrate
| Component | Current Location | Migration Target |
|-----------|------------------|------------------|
| Chat streaming | `pkg/llm/conversational.go` | `/api/chat/route.ts` |
| Intent classification | `pkg/llm/intent.go` (Groq) | `/api/chat/intent/route.ts` |
| Plan generation | `pkg/llm/plan.go`, `initial-plan.go` | `/api/chat/plan/route.ts` |
| Plan execution | `pkg/llm/execute-plan.go`, `execute-action.go` | `/api/chat/execute/route.ts` |
| XML parser | `pkg/llm/parser.go` | `lib/llm/parser.ts` |
| Fuzzy matching | `pkg/llm/execute-action.go:319-435` | `lib/llm/fuzzy-match.ts` |
| System prompts | `pkg/llm/system.go` | `lib/llm/prompts.ts` |
| Types | `pkg/llm/types/types.go` | `lib/llm/types.ts` |

### Existing Tests to Port
| Go Test File | TypeScript Target | Notes |
|--------------|-------------------|-------|
| `parser_test.go` | `lib/llm/__tests__/parser.test.ts` | Unit tests, no API calls |
| `string_replacement_test.go` | `lib/llm/__tests__/fuzzy-match.test.ts` | Unit tests, no API calls |
| `execute-action_test.go` | Skip | Integration test hitting real API |

## Desired End State

### Architecture After
```
User Input → useChat() hook → POST /api/chat/* (Next.js API Routes)
    → Vercel AI SDK (streamText/generateText)
    → SSE Stream → useChat() state → React Re-render
```

### Verification Criteria
1. All existing chat functionality works (streaming, history, tools)
2. Intent classification correctly routes to plan vs conversational
3. Plan generation and execution work with tool calling
4. Chat history persists to database
5. Easy to switch providers (demonstrated in docs)

## What We're NOT Doing

- Migrating non-LLM Go code (helm rendering, file operations outside of LLM tools)
- Removing Centrifugo entirely (may still be used for render progress, etc.)
- Adding comprehensive test coverage where none existed
- Changing the database schema
- Modifying the UI design (only the data flow)

## Environment Variables

```bash
# Feature flag for gradual migration
USE_VERCEL_AI_SDK=true|false  # Toggle between old and new chat systems

# Development/testing
MOCK_LLM_RESPONSES=true|false  # Return canned responses instead of calling APIs

# Existing (still needed)
ANTHROPIC_API_KEY=...
GROQ_API_KEY=...
```

## Testing Strategy

### Limiting API Calls
1. **Unit tests**: Use `MockLanguageModelV1` from `ai/test` - zero API calls
2. **Integration tests**: Mock at SDK level
3. **Manual testing**: Use `MOCK_LLM_RESPONSES=true` for rapid iteration
4. **Groq**: Free tier is generous, safe for testing intent classification

### Test Commands
```bash
# Run ported TypeScript tests
cd chartsmith-app && npm test -- --testPathPattern="lib/llm"

# Run with mocked responses (no API calls)
MOCK_LLM_RESPONSES=true npm run dev

# Run with real API (limited manual testing)
USE_VERCEL_AI_SDK=true npm run dev
```

---

## Phase 1: Infrastructure + Pure Logic

### Overview
Install Vercel AI SDK packages and port pure business logic (no LLM calls) with tests.

### Changes Required

#### 1. Install Dependencies
**File**: `chartsmith-app/package.json`

```bash
cd chartsmith-app
npm install ai @ai-sdk/anthropic @ai-sdk/groq zod
npm install -D @types/node
```

#### 2. Port Types
**File**: `chartsmith-app/lib/llm/types.ts`

Port from `pkg/llm/types/types.go`:
```typescript
export interface ActionPlan {
  type: string;
  action: 'create' | 'update' | 'delete';
  description?: string;
}

export interface ActionPlanWithPath extends ActionPlan {
  path: string;
}

export interface Artifact {
  path: string;
  content: string;
}

export interface HelmResponse {
  title: string;
  actions: Record<string, ActionPlan>;
  artifacts: Artifact[];
}
```

#### 3. Port System Prompts
**File**: `chartsmith-app/lib/llm/prompts.ts`

Port from `pkg/llm/system.go`:
```typescript
export const endUserSystemPrompt = `You are a Helm chart assistant...`;
export const commonSystemPrompt = `You are a Helm chart expert...`;
export const chatOnlySystemPrompt = `...`;
export const initialPlanSystemPrompt = `...`;
export const updatePlanSystemPrompt = `...`;
export const detailedPlanSystemPrompt = `...`;
export const executePlanSystemPrompt = `...`;
```

#### 4. Port XML Parser with Tests
**File**: `chartsmith-app/lib/llm/parser.ts`

Port from `pkg/llm/parser.go`. Key functions:
- `parsePlan(input: string): void`
- `parseArtifacts(input: string): void`
- `getResult(): HelmResponse`

**File**: `chartsmith-app/lib/llm/__tests__/parser.test.ts`

Port test cases from `pkg/llm/parser_test.go`:
```typescript
describe('Parser', () => {
  describe('parsePlan', () => {
    it('parses wordpress plan', () => {
      // Port from TestParser_ParsePlan
    });
  });

  describe('parseArtifacts', () => {
    it('parses complete Chart.yaml', () => {
      // Port from TestParser_ParseArtifacts
    });
    it('parses partial artifact', () => {});
    it('handles multiple artifacts with partial', () => {});
    it('handles streaming chunks', () => {});
  });
});
```

#### 5. Port Fuzzy Matching with Tests
**File**: `chartsmith-app/lib/llm/fuzzy-match.ts`

Port from `pkg/llm/execute-action.go:319-435`:
```typescript
export function performStringReplacement(
  content: string,
  oldStr: string,
  newStr: string
): { content: string; success: boolean; error?: Error } {
  // Port fuzzy matching algorithm
}
```

**File**: `chartsmith-app/lib/llm/__tests__/fuzzy-match.test.ts`

Port test cases from `pkg/llm/string_replacement_test.go`:
```typescript
describe('performStringReplacement', () => {
  it('handles simple match case', () => {});
  it('returns error when string not found', () => {});
  it('handles multiple replacements', () => {});
  it('replaces with empty string', () => {});
  it('handles real world Chart.yaml dependencies', () => {});
  it('handles real world fuzzy match', () => {});
});
```

### Success Criteria

#### Automated Verification
- [x] Packages install without errors: `cd chartsmith-app && npm install`
- [x] TypeScript compiles: `npm run typecheck` (or `tsc --noEmit`)
- [x] Parser tests pass: `npm test -- --testPathPattern="parser.test"`
- [x] Fuzzy match tests pass: `npm test -- --testPathPattern="fuzzy-match.test"`
- [x] Lint passes: `npm run lint`

#### Manual Verification
- [ ] Review ported code matches Go behavior

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Standalone Chat API Route

### Overview
Create the main chat API route with Vercel AI SDK streaming. Testable via curl without frontend integration.

### Changes Required

#### 1. Create Mock Provider for Testing
**File**: `chartsmith-app/lib/llm/mock-provider.ts`

```typescript
import { MockLanguageModelV1 } from 'ai/test';

export function createMockModel(responses: string[]) {
  let callIndex = 0;
  return new MockLanguageModelV1({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          const response = responses[callIndex++] || 'Mock response';
          controller.enqueue({ type: 'text-delta', textDelta: response });
          controller.enqueue({ type: 'finish', finishReason: 'stop' });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

export const shouldUseMock = () => process.env.MOCK_LLM_RESPONSES === 'true';
```

#### 2. Create Model Provider
**File**: `chartsmith-app/lib/llm/model-provider.ts`

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createMockModel, shouldUseMock } from './mock-provider';

export function getChatModel() {
  if (shouldUseMock()) {
    return createMockModel(['This is a mock response for testing.']);
  }
  return anthropic('claude-sonnet-4-20250514');
}
```

#### 3. Create Chat API Route
**File**: `chartsmith-app/app/api/chat/route.ts`

```typescript
import { streamText } from 'ai';
import { getChatModel } from '@/lib/llm/model-provider';
import { chatOnlySystemPrompt } from '@/lib/llm/prompts';

export async function POST(req: Request) {
  const { messages, workspaceId } = await req.json();

  const result = await streamText({
    model: getChatModel(),
    system: chatOnlySystemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
```

#### 4. Create Test Script
**File**: `chartsmith-app/scripts/test-chat-api.sh`

```bash
#!/bin/bash
# Test the chat API route

curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is a Helm chart?"}
    ],
    "workspaceId": "test-workspace"
  }'
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] Dev server starts: `npm run dev`

#### Manual Verification
- [x] With `MOCK_LLM_RESPONSES=true`: curl returns mock streaming response
- [x] With real API key (optional): curl returns real streaming response
- [x] Response streams incrementally (not all at once)

**Implementation Note**: Test with mocked responses first. Only test real API if needed.

---

## Phase 3: Intent Classification Route

### Overview
Create intent classification using Groq (Llama). This is cheaper than Anthropic, safe for testing.

### Changes Required

#### 1. Add Groq Model Provider
**File**: `chartsmith-app/lib/llm/model-provider.ts` (update)

```typescript
import { groq } from '@ai-sdk/groq';

export function getIntentModel() {
  if (shouldUseMock()) {
    return createMockModel(['{"intent": "conversational"}']);
  }
  return groq('llama-3.3-70b-versatile');
}
```

#### 2. Create Intent Route
**File**: `chartsmith-app/app/api/chat/intent/route.ts`

Port logic from `pkg/llm/intent.go`:
```typescript
import { generateText } from 'ai';
import { getIntentModel } from '@/lib/llm/model-provider';

export type ChatIntent = 'plan' | 'conversational' | 'render' | 'unknown';

export async function POST(req: Request) {
  const { message, context } = await req.json();

  const result = await generateText({
    model: getIntentModel(),
    prompt: `Classify the intent of this message: "${message}"

Context: ${context}

Respond with JSON: {"intent": "plan" | "conversational" | "render"}`,
  });

  return Response.json(JSON.parse(result.text));
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run build` (compiles successfully)
- [x] Lint passes: `npm run lint`

#### Manual Verification
- [x] Test with curl: `curl -X POST http://localhost:3000/api/chat/intent -H "Authorization: Bearer test" -H "Content-Type: application/json" -d '{"message": "Create a wordpress chart"}'`
- [x] Returns `{"isPlan": true}` for plan-like messages (with `isInitialPrompt: true`)
- [x] Returns `{"isConversational": true}` for questions
- [x] Groq calls are fast (~500ms) - verified: ~400-600ms

---

## Phase 4: Connect Frontend to New Chat Route

### Overview
Integrate `useChat` hook with feature flag to toggle between old (Centrifugo) and new (AI SDK) systems.

### Changes Required

#### 1. Create AI SDK Chat Hook
**File**: `chartsmith-app/hooks/useAIChat.ts`

```typescript
import { useChat } from 'ai/react';

export function useAIChat(workspaceId: string) {
  const chat = useChat({
    api: '/api/chat',
    body: { workspaceId },
    onFinish: async (message) => {
      // Persist to database after completion
      await persistChatMessage(workspaceId, message);
    },
  });

  return chat;
}

async function persistChatMessage(workspaceId: string, message: any) {
  // Call existing API to persist to workspace_chat table
  await fetch(`/api/workspace/${workspaceId}/message`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: '', // User message already sent
      response: message.content,
    }),
  });
}
```

#### 2. Update ChatContainer with Feature Flag
**File**: `chartsmith-app/components/ChatContainer.tsx` (update)

```typescript
import { useAIChat } from '@/hooks/useAIChat';
import { useCentrifugo } from '@/hooks/useCentrifugo';

const useVercelAISDK = process.env.NEXT_PUBLIC_USE_VERCEL_AI_SDK === 'true';

export function ChatContainer({ workspaceId }: Props) {
  // Feature flag to switch between implementations
  const aiChat = useAIChat(workspaceId);
  const centrifugoChat = useCentrifugo(workspaceId);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useVercelAISDK ? aiChat : centrifugoChat;

  // Rest of component uses these unified values
  // ...
}
```

#### 3. Add Environment Variable
**File**: `chartsmith-app/.env.local`

```bash
NEXT_PUBLIC_USE_VERCEL_AI_SDK=false  # Start with old system
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck` (or `tsc --noEmit`)
- [x] Lint passes: `npm run lint`
- [x] App builds: `npm run build`

#### Manual Verification
- [x] With `NEXT_PUBLIC_USE_VERCEL_AI_SDK=false`: App uses Centrifugo (existing behavior)
- [x] With `NEXT_PUBLIC_USE_VERCEL_AI_SDK=true`: App uses new AI SDK route
- [x] Messages stream in UI with new system
- [x] Chat history loads correctly (via atom state; DB persistence deferred to Phase 7)
- [x] Can toggle between systems by changing env var

---

## Phase 5: Plan Generation Route

### Overview
Create plan generation endpoint for creating/updating Helm chart plans.

### Changes Required

#### 1. Create Plan Route
**File**: `chartsmith-app/app/api/chat/plan/route.ts`

Port logic from `pkg/llm/plan.go` and `pkg/llm/initial-plan.go`:
```typescript
import { streamText } from 'ai';
import { getChatModel } from '@/lib/llm/model-provider';
import { initialPlanSystemPrompt, updatePlanSystemPrompt } from '@/lib/llm/prompts';
import { Parser } from '@/lib/llm/parser';

export async function POST(req: Request) {
  const { messages, workspaceId, existingPlan, chartContext } = await req.json();

  const systemPrompt = existingPlan ? updatePlanSystemPrompt : initialPlanSystemPrompt;

  const result = await streamText({
    model: getChatModel(),
    system: systemPrompt,
    messages: [
      { role: 'user', content: buildPlanPrompt(chartContext, existingPlan) },
      ...messages,
    ],
  });

  return result.toDataStreamResponse();
}

function buildPlanPrompt(chartContext: any, existingPlan?: string): string {
  // Port from Go: build context about the chart
  return `...`;
}
```

#### 2. Update Intent-Based Routing
**File**: `chartsmith-app/app/api/chat/route.ts` (update)

Add routing based on intent:
```typescript
export async function POST(req: Request) {
  const { messages, workspaceId } = await req.json();

  // Classify intent
  const intentRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chat/intent`, {
    method: 'POST',
    body: JSON.stringify({ message: messages[messages.length - 1].content }),
  });
  const { intent } = await intentRes.json();

  // Route to appropriate handler
  if (intent === 'plan') {
    return handlePlanRequest(messages, workspaceId);
  }

  // Default: conversational
  return handleConversationalRequest(messages, workspaceId);
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Lint passes: `npm run lint`

#### Manual Verification
- [x] "Create a wordpress chart" triggers plan generation
- [x] Plan streams with chartsmithArtifactPlan XML tags
- [x] Plan is parsed and displayed in UI
- [x] "What is Helm?" stays conversational (no plan)

---

## Phase 6: Tool Calling + Execute Route

### Overview
Port tool implementations and create execution endpoint for applying plan changes.

### Changes Required

#### 1. Create Tool Definitions
**File**: `chartsmith-app/lib/llm/tools.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { performStringReplacement } from './fuzzy-match';

export const textEditorTool = tool({
  description: 'Edit files using view, str_replace, or create commands',
  parameters: z.object({
    command: z.enum(['view', 'str_replace', 'create']),
    path: z.string().describe('File path relative to chart root'),
    file_text: z.string().optional().describe('For create: full file content'),
    old_str: z.string().optional().describe('For str_replace: text to find'),
    new_str: z.string().optional().describe('For str_replace: replacement text'),
    view_range: z.array(z.number()).optional().describe('For view: [start, end] line range'),
  }),
  execute: async ({ command, path, file_text, old_str, new_str, view_range }) => {
    switch (command) {
      case 'view':
        return await viewFile(path, view_range);
      case 'str_replace':
        return await replaceInFile(path, old_str!, new_str!);
      case 'create':
        return await createFile(path, file_text!);
    }
  },
});

export const latestSubchartVersionTool = tool({
  description: 'Get the latest version of a Helm subchart',
  parameters: z.object({
    chartName: z.string(),
    repository: z.string(),
  }),
  execute: async ({ chartName, repository }) => {
    // Port from pkg/llm/conversational.go
    return { version: '1.0.0' }; // Implement actual lookup
  },
});

export const latestKubernetesVersionTool = tool({
  description: 'Get the latest Kubernetes version',
  parameters: z.object({}),
  execute: async () => {
    // Port from pkg/llm/conversational.go
    return { version: '1.31.0' }; // Implement actual lookup
  },
});
```

#### 2. Create Execute Route
**File**: `chartsmith-app/app/api/chat/execute/route.ts`

Port logic from `pkg/llm/execute-action.go`:
```typescript
import { streamText } from 'ai';
import { getChatModel } from '@/lib/llm/model-provider';
import { executePlanSystemPrompt } from '@/lib/llm/prompts';
import { textEditorTool } from '@/lib/llm/tools';

export async function POST(req: Request) {
  const { plan, workspaceId, fileContents } = await req.json();

  const result = await streamText({
    model: getChatModel(),
    system: executePlanSystemPrompt,
    messages: [
      { role: 'user', content: buildExecutePrompt(plan, fileContents) },
    ],
    tools: { textEditor: textEditorTool },
    maxSteps: 50, // Allow multiple tool calls
  });

  return result.toDataStreamResponse();
}
```

#### 3. Add Tool Call Handling to useChat
**File**: `chartsmith-app/hooks/useAIChat.ts` (update)

```typescript
export function useAIChat(workspaceId: string) {
  const chat = useChat({
    api: '/api/chat',
    body: { workspaceId },
    onToolCall: async ({ toolCall }) => {
      // Handle tool results if needed
      console.log('Tool called:', toolCall);
    },
  });

  return chat;
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] Tool definitions are valid (no Zod errors)

#### Manual Verification
- [x] Execute plan triggers tool calls
- [x] `str_replace` correctly modifies files
- [x] `view` returns file contents
- [x] `create` creates new files
- [x] Tool results stream back to UI
- [x] Multiple tool calls work in sequence

---

## Phases 6.5-6.7: Connect Execute Route to UI (SDK-Native Approach)

### Background

#### Current Go Flow (What We're Replacing)

```
1. Proceed button clicked
      ↓
2. createRevision() [TypeScript - workspace.ts:1039]
   - Sets plan.proceed_at = now()
   - Creates NEW revision (N+1)
   - Copies ALL files from revision N to N+1
   - Updates workspace.current_revision_number = N+1
   - Enqueues "execute_plan" to Go worker
      ↓
3. handleExecutePlanNotification() [Go - listener/execute-plan.go]
   - Updates plan status → "applying"
   - Calls llm.CreateExecutePlan() to generate action list
   - Enqueues "apply_plan"
      ↓
4. handleApplyPlanNotification() [Go - listener/apply-plan.go]
   - For each action file (sequentially):
     - Update action status → "creating"
     - Call llm.ExecuteAction() with text_editor tool
     - Persist file content via workspace.SetFileContentPending()
     - Update action status → "created"
   - Update plan status → "applied"
   - Mark revision complete
   - Enqueue render job
```

#### New Flow (SDK-Native)

```
1. Proceed button clicked
      ↓
2. createRevisionAction() [Modified - skip enqueue]
   - Creates revision N+1, copies files
   - Returns new revision number (does NOT enqueue execute_plan)
      ↓
3. useChat with execute endpoint [SDK handles tool calling]
   - POST /api/chat/execute with plan context
   - Vercel AI SDK handles multi-step tool calling via maxSteps
   - onToolCall callback updates UI as each tool fires
   - onFinish callback persists results + updates plan status
      ↓
4. Completion [In onFinish callback]
   - Persist all file changes to DB
   - Update plan status → "applied"
   - Mark revision complete
   - Enqueue render job
```

#### Design Decisions

| Aspect | Decision |
|--------|----------|
| **Tool calling** | Use SDK's native `maxSteps` - no manual stream parsing |
| **UI updates** | Use `onToolCall` callback for per-tool progress |
| **Persistence** | Batch persist in `onFinish` after all tools complete |
| **Error handling** | SDK's error handling + `onError` callback |

---

## Phase 6.5: Server Actions for Execution

### Overview
Create backend server actions for database persistence. Simplified from original plan - we batch persist after all tools complete rather than per-action.

### Changes Required

#### 1. Modify createRevision to Skip Enqueue
**File**: `chartsmith-app/lib/workspace/workspace.ts`

Add parameter to skip the Go worker enqueue:

```typescript
export async function createRevision(
  plan: Plan,
  userID: string,
  options?: { skipExecute?: boolean }
): Promise<number> {
  // ... existing revision creation logic ...

  // Only enqueue if not skipping
  if (!options?.skipExecute) {
    await enqueueWork("execute_plan", { planId: plan.id });
  }

  return newRevisionNumber;
}
```

#### 2. Update createRevisionAction
**File**: `chartsmith-app/lib/workspace/actions/create-revision.ts`

Pass through the new option:

```typescript
export async function createRevisionAction(
  session: Session,
  planId: string,
  options?: { skipExecute?: boolean }
): Promise<Workspace | undefined> {
  const plan = await getPlan(planId);
  await createRevision(plan, session.user.id, options);
  const workspace = await getWorkspace(plan.workspaceId);
  return workspace;
}
```

#### 3. Create Execution Server Actions
**File**: `chartsmith-app/lib/workspace/actions/execute-plan-actions.ts`

```typescript
"use server"

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/persistence/db";
import { enqueueWork } from "@/lib/persistence/queue";

interface FileChange {
  path: string;
  content: string;
}

/**
 * Batch persist all file changes after execution completes.
 * Called from onFinish callback after all tool calls complete.
 */
export async function persistExecutionResultsAction(
  session: Session,
  workspaceId: string,
  revisionNumber: number,
  chartId: string,
  fileChanges: FileChange[]
): Promise<void> {
  const db = getDB();

  for (const { path, content } of fileChanges) {
    const existing = await db.query(
      `SELECT id FROM workspace_file
       WHERE workspace_id = $1 AND revision_number = $2 AND file_path = $3`,
      [workspaceId, revisionNumber, path]
    );

    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO workspace_file (workspace_id, revision_number, chart_id, file_path, content_pending)
         VALUES ($1, $2, $3, $4, $5)`,
        [workspaceId, revisionNumber, chartId, path, content]
      );
    } else {
      await db.query(
        `UPDATE workspace_file SET content_pending = $1
         WHERE workspace_id = $2 AND revision_number = $3 AND file_path = $4`,
        [content, workspaceId, revisionNumber, path]
      );
    }
  }
}

/**
 * Mark plan and revision as complete, enqueue render.
 */
export async function completePlanExecutionAction(
  session: Session,
  planId: string,
  workspaceId: string,
  revisionNumber: number,
  chatMessageId?: string
): Promise<void> {
  const db = getDB();

  // Update all action files to 'created'
  const planResult = await db.query(
    `SELECT action_files FROM workspace_plan WHERE id = $1`,
    [planId]
  );
  const actionFiles = planResult.rows[0]?.action_files || [];
  const updatedActions = actionFiles.map((a: any) => ({ ...a, status: 'created' }));

  await db.query(
    `UPDATE workspace_plan SET status = 'applied', action_files = $1 WHERE id = $2`,
    [JSON.stringify(updatedActions), planId]
  );

  await db.query(
    `UPDATE workspace_revision SET is_complete = true
     WHERE workspace_id = $1 AND revision_number = $2`,
    [workspaceId, revisionNumber]
  );

  if (chatMessageId) {
    await enqueueWork("render_workspace", {
      workspaceId,
      revisionNumber,
      chatMessageId,
    });
  }
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run build` (compiles successfully)
- [x] Lint passes: `npm run lint`

#### Manual Verification
- [ ] `createRevisionAction(session, planId, { skipExecute: true })` creates revision without triggering Go worker
- [ ] Server actions can be imported and called without errors

---

## Phase 6.6: SDK-Native Execution Hook

### Overview
Create a hook that uses Vercel AI SDK's native tool calling. The SDK handles the multi-step tool call loop automatically via `maxSteps`. No custom stream parsing needed.

### Changes Required

#### 1. Create useExecutePlan Hook
**File**: `chartsmith-app/hooks/useExecutePlan.ts`

```typescript
import { useChat } from 'ai/react';
import { useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { workspaceAtom } from '@/atoms/workspace';
import { Plan } from '@/lib/types/workspace';
import {
  persistExecutionResultsAction,
  completePlanExecutionAction,
} from '@/lib/workspace/actions/execute-plan-actions';
import { Session } from '@/lib/types/session';

interface FileChange {
  path: string;
  content: string;
}

interface UseExecutePlanOptions {
  session: Session;
  workspaceId: string;
  onToolCall?: (toolName: string, args: unknown) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useExecutePlan(options: UseExecutePlanOptions) {
  const [workspace] = useAtom(workspaceAtom);
  const fileChangesRef = useRef<FileChange[]>([]);
  const executionContextRef = useRef<{
    plan: Plan;
    revisionNumber: number;
  } | null>(null);

  const { messages, append, isLoading } = useChat({
    api: '/api/chat/execute',
    body: {
      workspaceId: options.workspaceId,
    },
    maxSteps: 50, // SDK handles multi-step tool calling
    onToolCall: async ({ toolCall }) => {
      options.onToolCall?.(toolCall.toolName, toolCall.args);

      // Track file changes from tool results
      if (toolCall.toolName === 'textEditor') {
        const args = toolCall.args as { command: string; path: string; file_text?: string };
        if (args.command === 'create' && args.file_text) {
          fileChangesRef.current.push({
            path: args.path,
            content: args.file_text,
          });
        }
        // str_replace results come back in tool result, handled by SDK
      }
    },
    onFinish: async (message) => {
      const ctx = executionContextRef.current;
      if (!ctx) return;

      try {
        const chartId = workspace?.charts?.[0]?.id;
        if (chartId && fileChangesRef.current.length > 0) {
          await persistExecutionResultsAction(
            options.session,
            options.workspaceId,
            ctx.revisionNumber,
            chartId,
            fileChangesRef.current
          );
        }

        await completePlanExecutionAction(
          options.session,
          ctx.plan.id,
          options.workspaceId,
          ctx.revisionNumber,
          ctx.plan.chatMessageIds?.[ctx.plan.chatMessageIds.length - 1]
        );

        options.onComplete?.();
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        fileChangesRef.current = [];
        executionContextRef.current = null;
      }
    },
    onError: (error) => {
      options.onError?.(error);
      fileChangesRef.current = [];
      executionContextRef.current = null;
    },
  });

  const executePlan = useCallback(async (
    plan: Plan,
    revisionNumber: number,
    fileContents: Record<string, string>
  ) => {
    // Store context for onFinish callback
    executionContextRef.current = { plan, revisionNumber };
    fileChangesRef.current = [];

    // Send execution request - SDK handles the rest
    await append({
      role: 'user',
      content: JSON.stringify({
        plan: {
          id: plan.id,
          description: plan.description,
          actionFiles: plan.actionFiles,
        },
        fileContents,
      }),
    });
  }, [append]);

  return {
    executePlan,
    isExecuting: isLoading,
    messages,
  };
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run build` (compiles successfully)
- [x] Lint passes: `npm run lint`

#### Manual Verification
- [ ] `executePlan` triggers tool calls via SDK
- [ ] `onToolCall` fires for each tool invocation
- [ ] `onFinish` persists results after completion
- [ ] File changes are correctly tracked and persisted

---

## Phase 6.7: UI Integration

### Overview
Wire the `useExecutePlan` hook to the PlanChatMessage component, replacing the Go-based execution flow.

### Changes Required

#### 1. Update PlanChatMessage
**File**: `chartsmith-app/components/PlanChatMessage.tsx`

```typescript
// Add imports
import { useExecutePlan } from '@/hooks/useExecutePlan';
import { useAtomValue } from 'jotai';
import { looseFilesAtom } from '@/atoms/workspace';

// Inside component, add the hook:
const files = useAtomValue(looseFilesAtom);
const { executePlan, isExecuting } = useExecutePlan({
  session: session!,
  workspaceId: workspaceId || plan?.workspaceId || '',
  onToolCall: (toolName, args) => {
    // Update UI to show which tool is running
    console.log(`Tool: ${toolName}`, args);
  },
  onComplete: () => {
    handlePlanUpdated({ ...plan, status: 'applied' });
  },
  onError: (error) => {
    console.error('Execution failed:', error);
  },
});

// Replace handleProceed:
const handleProceed = async () => {
  if (!session || !plan) return;

  const wsId = workspaceId || plan.workspaceId;
  if (!wsId) return;

  // 1. Update plan status to 'applying'
  handlePlanUpdated({ ...plan, status: 'applying' });

  // 2. Create revision WITHOUT triggering Go worker
  const updatedWorkspace = await createRevisionAction(
    session,
    plan.id,
    { skipExecute: true }
  );

  if (updatedWorkspace && setWorkspace) {
    setWorkspace(updatedWorkspace);
  }

  // 3. Build file contents map for execution context
  const fileContents: Record<string, string> = {};
  for (const file of files) {
    fileContents[file.filePath] = file.content || '';
  }

  // 4. Execute via Vercel AI SDK - SDK handles tool calling loop
  const revisionNumber = updatedWorkspace?.currentRevisionNumber || 1;
  await executePlan(plan, revisionNumber, fileContents);

  onProceed?.();
};

// Update Proceed button to show loading state:
<Button
  ref={proceedButtonRef}
  variant="default"
  size="sm"
  onClick={handleProceed}
  disabled={isExecuting}
  data-testid="plan-message-proceed-button"
  className="min-w-[100px] bg-primary hover:bg-primary/80 text-white"
>
  {isExecuting ? 'Executing...' : 'Proceed'}
</Button>
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run build` (compiles successfully)
- [x] Lint passes: `npm run lint`
- [ ] No React warnings in console

#### Manual Verification
- [ ] Click "Proceed" on a plan
- [ ] New revision is created before execution starts
- [ ] SDK handles multi-step tool calling automatically
- [ ] Files are persisted to DB after all tools complete
- [ ] Final plan status shows 'applied'
- [ ] Render job is enqueued after completion
- [ ] Button shows loading state during execution

---

## Phase 7: Cleanup + Documentation

### Overview
Remove old code, update documentation, finalize migration.

### Changes Required

#### 1. Remove Feature Flag (Make New System Default)
**File**: `chartsmith-app/components/ChatContainer.tsx`

Remove the feature flag conditional, use AI SDK directly.

#### 2. Update Frontend Prompt Type
**File**: `chartsmith-app/lib/llm/prompt-type.ts`

Remove direct Anthropic SDK usage (the only frontend Anthropic call):
```typescript
// Before: Direct @anthropic-ai/sdk call
// After: Use new intent classification route
export async function classifyPromptType(message: string): Promise<PromptType> {
  const res = await fetch('/api/chat/intent', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  const { intent } = await res.json();
  return intent;
}
```

#### 3. Remove Old Dependencies
**File**: `chartsmith-app/package.json`

```bash
npm uninstall @anthropic-ai/sdk
```

#### 4. Update Architecture Documentation
**File**: `chartsmith-app/ARCHITECTURE.md`

Add new section:
```markdown
## AI Integration (Vercel AI SDK)

### Overview
Chat functionality uses Vercel AI SDK for LLM integration:
- `ai` - Core SDK with `streamText`, `generateText`, `tool`
- `@ai-sdk/anthropic` - Claude provider
- `@ai-sdk/groq` - Groq/Llama provider for intent classification

### API Routes
- `/api/chat` - Main chat endpoint with streaming
- `/api/chat/intent` - Intent classification (plan vs conversational)
- `/api/chat/plan` - Plan generation
- `/api/chat/execute` - Plan execution with tool calling

### Frontend
- `useChat` hook from `ai/react` handles streaming state
- Messages persist to `workspace_chat` table via API

### Switching Providers
To use a different provider (e.g., OpenAI):
\`\`\`typescript
import { openai } from '@ai-sdk/openai';
// Replace anthropic(...) with openai(...)
\`\`\`
```

#### 5. Document Go Code Deprecation
**File**: `pkg/llm/README.md` (create)

```markdown
# DEPRECATED

This package is deprecated. LLM functionality has been migrated to Next.js API routes.

See: `chartsmith-app/app/api/chat/`

The following files are no longer used for chat:
- conversational.go
- plan.go
- initial-plan.go
- execute-plan.go
- execute-action.go
- intent.go
- expand.go
- summarize.go

These may be removed in a future release.
```

### Success Criteria

#### Automated Verification
- [ ] App builds without `@anthropic-ai/sdk`: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification
- [ ] Full flow works: send message → intent classification → plan or chat → streaming response
- [ ] Plan execution with tool calling works
- [ ] Chat history persists and loads correctly
- [ ] No console errors in browser
- [ ] Architecture docs are accurate

---

## References

- Research document: `thoughts/shared/research/2025-11-29-vercel-ai-sdk-chat-refactor.md`
- Vercel AI SDK docs: https://ai-sdk.dev/docs
- Original requirements: `docs/Hiring Project_ Replicated _ Chartsmith.md`
- Current architecture: `chartsmith-app/ARCHITECTURE.md`
