# Chartsmith Architecture: Current State vs. Vercel AI SDK Migration

**Document Version:** 1.2
**Last Updated:** December 2025
**Purpose:** Detailed technical comparison of existing and proposed architectures
**Companion Document:** `docs/PRD-vercel-ai-sdk-migration.md`
**Status:** ✅ Migration Complete - Document reflects final implementation (95% accurate, minor implementation details differ)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Success Criteria Alignment](#success-criteria-alignment)
3. [Current Architecture Deep Dive](#current-architecture-deep-dive)
4. [Proposed Architecture Deep Dive](#proposed-architecture-deep-dive)
5. [Component-by-Component Comparison](#component-by-component-comparison)
6. [Decision Analysis](#decision-analysis)
7. [Trade-offs & Reasoning](#trade-offs--reasoning)
8. [Migration Path Justification](#migration-path-justification)

---

## Executive Summary

This document provides a comprehensive analysis of Chartsmith's current LLM/chat architecture and the proposed migration to Vercel AI SDK. The goal is to document every architectural decision with clear reasoning, trade-offs, and justification.

**Key Insight:** The current architecture is a **hybrid system** where Go handles LLM orchestration and the frontend receives updates via WebSocket pub/sub. The proposed architecture maintains this hybrid nature but standardizes the streaming protocol to enable modern frontend patterns.

---

## Success Criteria Alignment

This architecture comparison document addresses the following project success criteria:

### Must Have Requirements

| # | Requirement | How Architecture Addresses It | Section Reference |
|---|-------------|-------------------------------|-------------------|
| 1 | Replace custom chat UI with Vercel AI SDK | Proposed architecture uses `useChat` hook instead of custom components | [Proposed Architecture](#proposed-architecture-deep-dive) |
| 2 | Migrate from direct `@anthropic-ai/sdk` to AI SDK Core | Frontend removes Anthropic SDK; Go backend adapts to AI SDK protocol | [Component Comparison](#1-chat-input-handling) |
| 3 | Maintain all existing chat functionality (streaming, messages, history) | Architecture preserves all data flows, just changes protocol | [Component Comparison](#2-message-streaming) |
| 4 | Keep existing system prompts and behavior (user roles, chart context) | Go backend unchanged; system prompts in `pkg/llm/system.go` preserved | [What Stays the Same](#what-stays-the-same) |
| 5 | All existing features continue to work (tool calling, file context) | Tool calling architecture unchanged, just streaming format adapts | [Component Comparison](#3-tool-calling) |
| 6 | Tests pass (or are updated) | Test strategy outlined in migration path | [Migration Path](#migration-path-justification) |

### Nice to Have Requirements

| # | Requirement | How Architecture Addresses It | Section Reference |
|---|-------------|-------------------------------|-------------------|
| 1 | Demonstrate easy provider switching (Anthropic → OpenAI) | AI SDK protocol enables provider abstraction | [Decision 1](#decision-1-keep-go-backend-option-a-vs-option-b) |
| 2 | Improve streaming experience using AI SDK optimizations | HTTP SSE more efficient than WebSocket for request-response | [Trade-off 1](#trade-off-1-protocol-complexity-vs-standardization) |
| 3 | Simplify state management with AI SDK patterns | `useChat` manages state instead of custom Jotai atoms | [Component Comparison](#1-chat-input-handling) |

### Additional Considerations

| Consideration | How This Document Addresses It |
|---------------|-------------------------------|
| **Design Flexibility** | Two options evaluated (A: Keep Go, B: Move to Next.js) with clear recommendation |
| **Architecture Decisions** | Four major decisions documented with full rationale in [Decision Analysis](#decision-analysis) |
| **Trade-offs** | Five trade-offs explicitly analyzed in [Trade-offs & Reasoning](#trade-offs--reasoning) |

---

## Current Architecture Deep Dive

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         NEXT.JS FRONTEND                                   │  │
│  │                                                                           │  │
│  │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐   │  │
│  │   │  ChatContainer  │    │   ChatMessage   │    │    Jotai Atoms      │   │  │
│  │   │                 │    │                 │    │                     │   │  │
│  │   │  - Text input   │    │  - User msg     │    │  - messagesAtom     │   │  │
│  │   │  - Role select  │    │  - AI response  │    │  - plansAtom        │   │  │
│  │   │  - Submit btn   │    │  - Plan embed   │    │  - rendersAtom      │   │  │
│  │   │                 │    │  - Render embed │    │  - workspaceAtom    │   │  │
│  │   └────────┬────────┘    └────────▲────────┘    └──────────▲──────────┘   │  │
│  │            │                      │                        │              │  │
│  │            │                      │                        │              │  │
│  │            ▼                      │                        │              │  │
│  │   ┌─────────────────┐             │              ┌─────────┴─────────┐    │  │
│  │   │ Server Actions  │             │              │  useCentrifugo    │    │  │
│  │   │                 │             │              │                   │    │  │
│  │   │ createChat      │             │              │  - WebSocket      │    │  │
│  │   │ MessageAction() │             └──────────────│  - Event handlers │    │  │
│  │   └────────┬────────┘                            │  - State updates  │    │  │
│  │            │                                     └─────────▲─────────┘    │  │
│  │            │                                               │              │  │
│  └────────────┼───────────────────────────────────────────────┼──────────────┘  │
│               │                                               │                 │
│               │ INSERT + pg_notify                            │ WebSocket       │
│               ▼                                               │                 │
│  ┌────────────────────────────────────────────────────────────┼──────────────┐  │
│  │                      POSTGRESQL                            │              │  │
│  │                                                            │              │  │
│  │   ┌─────────────────┐    ┌─────────────────┐              │              │  │
│  │   │  workspace_chat │    │   work_queue    │              │              │  │
│  │   │                 │    │                 │              │              │  │
│  │   │  - id           │    │  - job_type     │              │              │  │
│  │   │  - prompt       │    │  - payload      │              │              │  │
│  │   │  - response     │    │  - status       │              │              │  │
│  │   │  - revision_num │    │  - created_at   │              │              │  │
│  │   └─────────────────┘    └────────┬────────┘              │              │  │
│  │                                   │                        │              │  │
│  └───────────────────────────────────┼────────────────────────┼──────────────┘  │
│                                      │                        │                 │
│                                      │ LISTEN/NOTIFY          │                 │
│                                      ▼                        │                 │
│  ┌───────────────────────────────────────────────────────────┼──────────────┐  │
│  │                         GO WORKER                          │              │  │
│  │                                                            │              │  │
│  │   ┌─────────────────┐    ┌─────────────────┐              │              │  │
│  │   │  pkg/listener   │    │    pkg/llm      │              │              │  │
│  │   │                 │    │                 │              │              │  │
│  │   │  - new_intent   │───▶│  - intent.go    │──┐           │              │  │
│  │   │  - new_plan     │    │  - plan.go      │  │           │              │  │
│  │   │  - conversational│   │  - conversa...  │  │           │              │  │
│  │   │  - execute_plan │    │  - execute...   │  │           │              │  │
│  │   └─────────────────┘    └─────────────────┘  │           │              │  │
│  │                                               │           │              │  │
│  │                          ┌────────────────────┘           │              │  │
│  │                          │                                │              │  │
│  │                          ▼                                │              │  │
│  │   ┌──────────────────────────────────────┐               │              │  │
│  │   │         LLM PROVIDERS                │               │              │  │
│  │   │                                      │               │              │  │
│  │   │  ┌──────────┐ ┌──────────┐ ┌──────┐ │               │              │  │
│  │   │  │ Anthropic│ │  Groq    │ │Voyage│ │               │              │  │
│  │   │  │ (Claude) │ │ (Llama)  │ │(Embed)│ │               │              │  │
│  │   │  └────┬─────┘ └────┬─────┘ └──┬───┘ │               │              │  │
│  │   └───────┼────────────┼──────────┼─────┘               │              │  │
│  │           │            │          │                      │              │  │
│  │           │ Stream     │ JSON     │ Vectors              │              │  │
│  │           ▼            ▼          ▼                      │              │  │
│  │   ┌─────────────────────────────────────┐               │              │  │
│  │   │      pkg/realtime/centrifugo.go     │───────────────┘              │  │
│  │   │                                     │                              │  │
│  │   │  SendEvent() → Centrifugo HTTP API  │                              │  │
│  │   └─────────────────────────────────────┘                              │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         CENTRIFUGO                                      │  │
│  │                                                                        │  │
│  │   WebSocket pub/sub server                                             │  │
│  │   Channel: {workspaceId}#{userId}                                      │  │
│  │   Events: plan-updated, chatmessage-updated, render-stream, etc.       │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Frontend Layer (Next.js)

**ChatContainer.tsx** (`chartsmith-app/components/ChatContainer.tsx`)
```typescript
// Current implementation characteristics:
- Manual form state management with useState
- Direct server action calls for message creation
- No built-in optimistic updates
- Role selector (auto/developer/operator) is custom UI
- Disabled state managed manually during streaming
```

**ChatMessage.tsx** (`chartsmith-app/components/ChatMessage.tsx`)
```typescript
// Current implementation characteristics:
- Reads from Jotai atoms (messageByIdAtom)
- Manually handles streaming text updates
- Complex SortedContent component for ordering
- Embedded Plan and Render components
- Cancel functionality via server action
```

**useCentrifugo Hook** (`chartsmith-app/hooks/useCentrifugo.ts`)
```typescript
// Current implementation characteristics:
- Manages WebSocket connection to Centrifugo
- Handles 10+ event types (plan-updated, chatmessage-updated, etc.)
- Updates Jotai atoms based on events
- Token refresh logic for reconnection
- Event replay for missed messages
```

**Jotai Atoms** (`chartsmith-app/atoms/workspace.ts`)
```typescript
// State management:
- messagesAtom: Message[]
- plansAtom: Plan[]
- rendersAtom: RenderedWorkspace[]
- workspaceAtom: Workspace
- Various derived atoms for lookups
```

#### 2. Database Layer (PostgreSQL)

**Message Storage** (`workspace_chat` table)
```sql
-- Schema (simplified):
CREATE TABLE workspace_chat (
  id VARCHAR PRIMARY KEY,
  workspace_id VARCHAR NOT NULL,
  prompt TEXT,                    -- User's input
  response TEXT,                  -- AI's response (accumulated)
  revision_number INTEGER,
  is_canceled BOOLEAN,
  is_intent_complete BOOLEAN,
  is_intent_conversational BOOLEAN,
  is_intent_plan BOOLEAN,
  response_plan_id VARCHAR,       -- FK to plan if applicable
  response_render_id VARCHAR,     -- FK to render if applicable
  message_from_persona VARCHAR    -- 'auto', 'developer', 'operator'
);
```

**Job Queue** (`work_queue` table + pg_notify)
```sql
-- Job dispatch mechanism:
-- 1. Server action inserts message
-- 2. Triggers pg_notify('new_intent', payload)
-- 3. Go worker listening picks up job
-- 4. Worker processes and sends results via Centrifugo
```

#### 3. Go Worker Layer

**Listener Package** (`pkg/listener/`)
```go
// Job handlers:
- handleNewIntentNotification()     // Classify user intent
- handleNewPlanNotification()       // Generate plan
- handleConverationalNotification() // Answer questions
- handleExecutePlanNotification()   // Execute file changes
```

**LLM Package** (`pkg/llm/`)
```go
// LLM orchestration:

// Intent Classification (Groq/Llama - fast, cheap)
func GetChatMessageIntent(ctx, prompt, isInitial, persona) (*Intent, error)

// Plan Generation (Anthropic Claude - streaming)
func CreatePlan(ctx, streamCh, doneCh, opts) error

// Conversational (Anthropic Claude - streaming + tools)
func ConversationalChatMessage(ctx, streamCh, doneCh, workspace, chat) error

// File Editing (Anthropic Claude - tools)
func ExecuteAction(ctx, actionPlan, plan, content, interimCh) (string, error)
```

**Streaming Pattern** (current)
```go
// How streaming works today:
streamCh := make(chan string, 1)
doneCh := make(chan error, 1)

go func() {
    // Call Anthropic with streaming
    stream := client.Messages.NewStreaming(ctx, params)
    for stream.Next() {
        event := stream.Current()
        if delta := event.Delta.Text; delta != "" {
            streamCh <- delta  // Send token
        }
    }
    doneCh <- nil
}()

// Listener accumulates and broadcasts:
for !done {
    select {
    case token := <-streamCh:
        buffer.WriteString(token)
        // Send to Centrifugo
        realtime.SendEvent(ctx, recipient, ChatMessageUpdatedEvent{
            Response: buffer.String(),
        })
        // Persist to DB
        workspace.AppendChatMessageResponse(ctx, id, token)
    case err := <-doneCh:
        done = true
    }
}
```

#### 4. Tool Calling Implementation

**Conversational Tools** (`pkg/llm/conversational.go:99-128`)
```go
tools := []anthropic.ToolParam{
    {
        Name:        "latest_subchart_version",
        Description: "Return the latest version of a subchart",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "chart_name": {"type": "string"},
            },
            "required": []string{"chart_name"},
        },
    },
    {
        Name:        "latest_kubernetes_version",
        Description: "Return the latest version of Kubernetes",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "semver_field": {"type": "string"},
            },
        },
    },
}
```

**Text Editor Tool** (`pkg/llm/execute-action.go:510-532`)
```go
tools := []anthropic.ToolParam{
    {
        Name: "text_editor_20241022",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "command": {"type": "string", "enum": ["view", "str_replace", "create"]},
                "path":    {"type": "string"},
                "old_str": {"type": "string"},
                "new_str": {"type": "string"},
            },
        },
    },
}
```

**Tool Execution Loop**
```go
for {
    stream := client.Messages.NewStreaming(ctx, params)
    // ... accumulate response ...

    for _, block := range message.Content {
        if block.Type == "tool_use" {
            switch block.Name {
            case "latest_subchart_version":
                version := recommendations.GetLatestSubchartVersion(input.ChartName)
                toolResults = append(toolResults, anthropic.NewToolResultBlock(block.ID, version))
            case "text_editor_20241022":
                switch input.Command {
                case "view":
                    response = currentContent
                case "str_replace":
                    newContent, _ := PerformStringReplacement(content, old, new)
                    response = "Content replaced"
                case "create":
                    updatedContent = input.NewStr
                    response = "Created"
                }
            }
        }
    }

    if !hasToolCalls {
        break  // Done
    }

    // Add tool results and continue conversation
    messages = append(messages, toolResultsMessage)
}
```

---

## Proposed Architecture Deep Dive

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PROPOSED ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         NEXT.JS FRONTEND                                   │  │
│  │                                                                           │  │
│  │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐   │  │
│  │   │  ChatContainer  │    │   ChatMessage   │    │    Jotai Atoms      │   │  │
│  │   │                 │    │                 │    │                     │   │  │
│  │   │  Uses useChat   │    │  AI SDK format  │    │  Hybrid state:      │   │  │
│  │   │  hook from      │    │  messages with  │    │  - AI SDK messages  │   │  │
│  │   │  @ai-sdk/react  │    │  tool calls     │    │  - Plans (Jotai)    │   │  │
│  │   │                 │    │                 │    │  - Renders (Jotai)  │   │  │
│  │   └────────┬────────┘    └────────▲────────┘    └──────────▲──────────┘   │  │
│  │            │                      │                        │              │  │
│  │            │ useChat              │ messages               │              │  │
│  │            │ manages              │ array                  │              │  │
│  │            ▼                      │                        │              │  │
│  │   ┌─────────────────┐             │              ┌─────────┴─────────┐    │  │
│  │   │   useChat()     │─────────────┘              │  useCentrifugo    │    │  │
│  │   │                 │                            │                   │    │  │
│  │   │  - messages     │                            │  NON-CHAT ONLY:   │    │  │
│  │   │  - input        │                            │  - plan-updated   │    │  │
│  │   │  - handleSubmit │                            │  - render-stream  │    │  │
│  │   │  - isLoading    │                            │  - artifact-upd   │    │  │
│  │   └────────┬────────┘                            └─────────▲─────────┘    │  │
│  │            │                                               │              │  │
│  │            │ POST /api/chat                                │              │  │
│  │            ▼                                               │              │  │
│  │   ┌─────────────────┐                                     │              │  │
│  │   │  /api/chat      │                                     │              │  │
│  │   │  (API Route)    │                                     │              │  │
│  │   │                 │                                     │              │  │
│  │   │  Proxy to Go    │                                     │              │  │
│  │   │  worker stream  │                                     │              │  │
│  │   └────────┬────────┘                                     │              │  │
│  │            │                                               │              │  │
│  └────────────┼───────────────────────────────────────────────┼──────────────┘  │
│               │                                               │                 │
│               │ HTTP Stream (AI SDK Protocol)                 │ WebSocket       │
│               ▼                                               │                 │
│  ┌───────────────────────────────────────────────────────────┼──────────────┐  │
│  │                         GO WORKER                          │              │  │
│  │                                                            │              │  │
│  │   ┌─────────────────────────────────────────────────────┐ │              │  │
│  │   │              NEW: AI SDK HTTP Endpoint               │ │              │  │
│  │   │                                                     │ │              │  │
│  │   │   POST /api/v1/chat                                 │ │              │  │
│  │   │   - Accepts: { messages: [...] }                    │ │              │  │
│  │   │   - Returns: AI SDK Data Stream Protocol            │ │              │  │
│  │   │   - SSE format with text-delta, tool-call, etc.     │ │              │  │
│  │   │                                                     │ │              │  │
│  │   └────────────────────────┬────────────────────────────┘ │              │  │
│  │                            │                              │              │  │
│  │                            ▼                              │              │  │
│  │   ┌─────────────────────────────────────────────────────┐ │              │  │
│  │   │              NEW: pkg/llm/aisdk.go                   │ │              │  │
│  │   │                                                     │ │              │  │
│  │   │   AI SDK Stream Adapter                             │ │              │  │
│  │   │   - Converts Anthropic events → AI SDK format       │ │              │  │
│  │   │   - Handles tool calls in AI SDK format             │ │              │  │
│  │   │   - Uses github.com/coder/aisdk-go                  │ │              │  │
│  │   │                                                     │ │              │  │
│  │   └────────────────────────┬────────────────────────────┘ │              │  │
│  │                            │                              │              │  │
│  │                            ▼                              │              │  │
│  │   ┌─────────────────┐    ┌─────────────────┐             │              │  │
│  │   │  pkg/listener   │    │    pkg/llm      │             │              │  │
│  │   │                 │    │                 │             │              │  │
│  │   │  UNCHANGED:     │    │  UNCHANGED:     │             │              │  │
│  │   │  - new_plan     │───▶│  - plan.go      │──┐          │              │  │
│  │   │  - execute_plan │    │  - execute...   │  │          │              │  │
│  │   │                 │    │  - intent.go    │  │          │              │  │
│  │   │  MODIFIED:      │    │                 │  │          │              │  │
│  │   │  - conversational│   │  MODIFIED:      │  │          │              │  │
│  │   │    (optional)   │    │  - conversa...  │  │          │              │  │
│  │   └─────────────────┘    └─────────────────┘  │          │              │  │
│  │                                               │          │              │  │
│  │                          ┌────────────────────┘          │              │  │
│  │                          ▼                               │              │  │
│  │   ┌──────────────────────────────────────┐              │              │  │
│  │   │         LLM PROVIDERS (unchanged)    │              │              │  │
│  │   │                                      │              │              │  │
│  │   │  ┌──────────┐ ┌──────────┐ ┌──────┐ │              │              │  │
│  │   │  │ Anthropic│ │  Groq    │ │Voyage│ │              │              │  │
│  │   │  │ (Claude) │ │ (Llama)  │ │(Embed)│ │              │              │  │
│  │   │  └──────────┘ └──────────┘ └──────┘ │              │              │  │
│  │   └──────────────────────────────────────┘              │              │  │
│  │                                                          │              │  │
│  │   ┌─────────────────────────────────────┐               │              │  │
│  │   │   pkg/realtime/centrifugo.go        │───────────────┘              │  │
│  │   │                                     │                              │  │
│  │   │   REDUCED SCOPE:                    │                              │  │
│  │   │   - Plan updates only               │                              │  │
│  │   │   - Render streams only             │                              │  │
│  │   │   - Artifact updates only           │                              │  │
│  │   │   - NO chat message streaming       │                              │  │
│  │   └─────────────────────────────────────┘                              │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    POSTGRESQL (unchanged)                               │  │
│  │                                                                        │  │
│  │   workspace_chat table continues to store messages                     │  │
│  │   work_queue for non-chat jobs (plans, renders)                        │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    CENTRIFUGO (reduced scope)                           │  │
│  │                                                                        │  │
│  │   Still handles: plan-updated, render-stream, artifact-updated         │  │
│  │   NO LONGER handles: chatmessage-updated (now via HTTP stream)         │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### New Component Details

#### 1. useChat Hook Integration

**New Chat Hook** (`chartsmith-app/hooks/useAIChat.ts`)
```typescript
import { useChat } from '@ai-sdk/react';

export function useAIChat(workspaceId: string, session: Session) {
  const {
    messages,        // AI SDK message format
    input,           // Current input value
    handleInputChange,
    handleSubmit,
    isLoading,       // Built-in loading state
    error,           // Built-in error handling
    reload,          // Retry last message
    stop,            // Cancel streaming
    setMessages,     // For loading history
  } = useChat({
    api: '/api/chat',
    body: {
      workspaceId,
      userId: session.user.id,
    },
    onFinish: (message) => {
      // Persist to database after completion
      saveMessageToDatabase(workspaceId, message);
    },
    onError: (error) => {
      // Handle errors
      console.error('Chat error:', error);
    },
  });

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
  };
}
```

#### 2. API Route Proxy

**Chat API Route** (`chartsmith-app/app/api/chat/route.ts`)
```typescript
export async function POST(req: NextRequest) {
  // Authenticate: try cookies first (web), then authorization header (extension)
  let userId: string | undefined;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (sessionToken) {
    const session = await findSession(sessionToken);
    userId = session?.user?.id;
  }
  // Fall back to authorization header (extension-based auth)
  if (!userId) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = await findSession(token);
      userId = session?.user?.id;
    }
  }

  const { messages, workspaceId } = await req.json();
  const goWorkerUrl = await getGoWorkerUrl(); // env var → database param → localhost

  // Forward to Go worker
  const response = await fetch(`${goWorkerUrl}/api/v1/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, workspaceId, userId }),
  });

  // Stream the response back as Server-Sent Events (SSE)
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### 3. Go AI SDK Adapter

**AI SDK Stream Adapter** (`pkg/llm/aisdk.go`)
```go
package llm

import (
    "github.com/coder/aisdk-go"
)

// AISDKStreamWriter wraps our streaming to output AI SDK protocol
type AISDKStreamWriter struct {
    writer    http.ResponseWriter
    flusher   http.Flusher
    messageID string
}

func (s *AISDKStreamWriter) WriteTextDelta(text string) error {
    // Uses aisdk-go library's TextStreamPart for formatting
    part := aisdk.TextStreamPart{
        Content: text,
    }
    formatted, err := part.Format()
    if err != nil {
        return fmt.Errorf("failed to format text stream part: %w", err)
    }
    return s.writeFormattedEvent(formatted)
}

func (w *AISDKStreamWriter) WriteToolCall(id, name string, args interface{}) error {
    // AI SDK format: data: {"type":"tool-call","toolCallId":"...","toolName":"...","args":{}}
    event := aisdk.ToolCallEvent{
        Type:       "tool-call",
        ToolCallID: id,
        ToolName:   name,
        Args:       args,
    }
    return w.writeEvent(event)
}

func (w *AISDKStreamWriter) WriteToolResult(id string, result interface{}) error {
    // AI SDK format: data: {"type":"tool-result","toolCallId":"...","result":{}}
    event := aisdk.ToolResultEvent{
        Type:       "tool-result",
        ToolCallID: id,
        Result:     result,
    }
    return w.writeEvent(event)
}

func (w *AISDKStreamWriter) WriteFinish(reason string) error {
    // AI SDK format: data: {"type":"finish","finishReason":"stop"}
    event := aisdk.FinishEvent{
        Type:         "finish",
        FinishReason: reason,
    }
    return w.writeEvent(event)
}
```

#### 4. Modified Conversational Handler

**AI SDK Conversational** (`pkg/llm/conversational_aisdk.go`)
```go
func ConversationalChatMessageAISDK(
    ctx context.Context,
    w http.ResponseWriter,
    workspace *workspacetypes.Workspace,
    messages []aisdk.Message,
) error {
    client, _ := newAnthropicClient(ctx)

    // Convert AI SDK messages to Anthropic format
    anthropicMessages := convertToAnthropicMessages(messages)

    // Create AI SDK stream writer
    streamWriter := NewAISDKStreamWriter(w)

    // Stream from Anthropic
    stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
        Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
        MaxTokens: anthropic.F(int64(8192)),
        Messages:  anthropic.F(anthropicMessages),
        Tools:     anthropic.F(tools),
    })

    for stream.Next() {
        event := stream.Current()

        switch e := event.AsUnion().(type) {
        case anthropic.ContentBlockDeltaEvent:
            if e.Delta.Text != "" {
                streamWriter.WriteTextDelta(e.Delta.Text)
            }
        case anthropic.ContentBlockStartEvent:
            if e.ContentBlock.Type == "tool_use" {
                streamWriter.WriteToolCall(
                    e.ContentBlock.ID,
                    e.ContentBlock.Name,
                    nil, // Args come in deltas
                )
            }
        }
    }

    // Handle tool execution...
    // Write finish event
    streamWriter.WriteFinish("stop")

    return nil
}
```

---

## Component-by-Component Comparison

### 1. Chat Input Handling

| Aspect | Current | Proposed | Change Impact |
|--------|---------|----------|---------------|
| **State Management** | Manual useState for input | useChat's built-in input state | Simplified |
| **Submit Handler** | Custom handleSubmitChat() | useChat's handleSubmit() | Simplified |
| **Loading State** | Manual isRendering atom | useChat's isLoading | Simplified |
| **Error Handling** | Try/catch in action | useChat's error state | Improved |
| **Optimistic Updates** | None | Built into useChat | New feature |
| **Cancel/Stop** | Custom cancelMessageAction | useChat's stop() | Simplified |

**Code Comparison:**

```typescript
// CURRENT
const [chatInput, setChatInput] = useState("");
const [isRendering] = useAtom(isRenderingAtom);

const handleSubmitChat = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!chatInput.trim() || isRendering) return;

  const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim(), selectedRole);
  setMessages(prev => [...prev, chatMessage]);
  setChatInput("");
};

// PROPOSED
const { input, handleInputChange, handleSubmit, isLoading } = useAIChat(workspace.id, session);

// Form just uses:
<form onSubmit={handleSubmit}>
  <input value={input} onChange={handleInputChange} disabled={isLoading} />
</form>
```

### 2. Message Streaming

| Aspect | Current | Proposed | Change Impact |
|--------|---------|----------|---------------|
| **Transport** | WebSocket (Centrifugo) | HTTP SSE (fetch stream) | Different protocol |
| **State Updates** | Centrifugo → Jotai atom | useChat internal state | Simplified |
| **Message Format** | Custom ChatMessage type | AI SDK Message type | Standardized |
| **Token Delivery** | Centrifugo publish per token | SSE data events | More efficient |
| **Reconnection** | Custom token refresh | Built into fetch | Simplified |

**Protocol Comparison:**

```
// CURRENT: Centrifugo WebSocket
{
  "eventType": "chatmessage-updated",
  "chatMessage": {
    "id": "abc123",
    "response": "Here is the accumulated response so far...",
    "isComplete": false
  }
}

// PROPOSED: AI SDK Data Stream Protocol (SSE)
data: {"type":"text-delta","textDelta":"Here "}
data: {"type":"text-delta","textDelta":"is "}
data: {"type":"text-delta","textDelta":"the "}
data: {"type":"text-delta","textDelta":"response"}
data: {"type":"finish","finishReason":"stop"}
```

### 3. Tool Calling

| Aspect | Current | Proposed | Change Impact |
|--------|---------|----------|---------------|
| **Tool Definition** | Anthropic ToolParam | Same (in Go) | None |
| **Tool Execution** | Go loop in pkg/llm | Same (in Go) | None |
| **Tool Streaming** | Not streamed to frontend | AI SDK tool events | Improved visibility |
| **Result Handling** | Internal to Go | Same | None |

**Tool Call Visibility (New):**

```typescript
// PROPOSED: Frontend can see tool calls
const { messages } = useChat();

messages.map(m => {
  if (m.toolInvocations) {
    m.toolInvocations.map(tool => {
      console.log(`Tool: ${tool.toolName}, Args: ${tool.args}`);
      if (tool.result) {
        console.log(`Result: ${tool.result}`);
      }
    });
  }
});
```

### 4. Message Persistence

| Aspect | Current | Proposed | Change Impact |
|--------|---------|----------|---------------|
| **When Saved** | Per token (AppendChatMessageResponse) | On completion (onFinish) | More efficient |
| **What's Saved** | Accumulated response string | Full AI SDK message | Same data |
| **History Loading** | Server action → Jotai | Server action → setMessages | Similar |

### 5. Non-Chat Events (Plans, Renders)

| Aspect | Current | Proposed | Change Impact |
|--------|---------|----------|---------------|
| **Transport** | Centrifugo WebSocket | Centrifugo WebSocket | **Unchanged** |
| **Events** | plan-updated, render-stream, etc. | Same | **Unchanged** |
| **State Management** | Jotai atoms | Jotai atoms | **Unchanged** |

---

## Decision Analysis

### Decision 1: Keep Go Backend (Option A vs Option B)

**Options Considered:**

| Option | Description | Effort | Risk |
|--------|-------------|--------|------|
| **A: Keep Go Backend** | Use aisdk-go to output AI SDK protocol | Medium | Low |
| **B: Move to Next.js** | Rewrite LLM logic in TypeScript | High | High |

**Decision: Option A**

**Reasoning:**

1. **Existing Go Logic is Substantial**
   - 18 files in `pkg/llm/` with ~3000 lines of code
   - Complex tool implementations (text_editor with fuzzy matching)
   - Multiple provider orchestration (Anthropic, Groq, Voyage)
   - Vector similarity search with pgvector
   - Proven, tested, production-ready

2. **Go-Specific Dependencies**
   - Helm binary execution (`helm template`, `helm dep update`)
   - Direct PostgreSQL operations with pgx
   - Centrifugo integration for other events
   - Job queue pattern with pg_notify

3. **Risk Assessment**
   ```
   Option A Risk: Protocol mismatch, minor integration issues
   Option B Risk: Complete rewrite bugs, missing edge cases,
                  TypeScript performance for string operations,
                  losing battle-tested fuzzy matching
   ```

4. **Library Availability**
   - `github.com/coder/aisdk-go` exists and is maintained
   - Coder (the company) uses it in production
   - Well-documented protocol specification

### Decision 2: Hybrid Streaming Approach

**Options Considered:**

| Option | Description |
|--------|-------------|
| **A: All via AI SDK** | Chat + plans + renders via HTTP streams |
| **B: Hybrid** | Chat via AI SDK, others via Centrifugo |
| **C: All via Centrifugo** | Adapt Centrifugo to AI SDK format |

**Decision: Option B (Hybrid)**

**Reasoning:**

1. **Chat is Request-Response**
   - User sends message, AI responds
   - Natural fit for HTTP stream
   - useChat expects this pattern

2. **Plans/Renders are Background Jobs**
   - Triggered asynchronously
   - May complete while user is elsewhere
   - Need pub/sub for push notifications
   - Centrifugo already handles this well

3. **Separation of Concerns**
   ```
   Chat: Synchronous, user-initiated, streaming response
   Plans: Asynchronous, may be long-running, status updates
   Renders: Asynchronous, background job, progress updates
   ```

4. **Migration Risk Reduction**
   - Only changing chat streaming
   - Plans/renders continue working
   - Can validate chat before touching others

### Decision 3: Feature Flag Strategy

**Options Considered:**

| Option | Description |
|--------|-------------|
| **A: Big Bang** | Switch everything at once |
| **B: Feature Flags** | Toggle between implementations |
| **C: A/B Testing** | Random user assignment |

**Decision: Option B (Feature Flags)** - *Note: Flags were removed in PR#9 after validation*

**Reasoning:**

1. **Safe Rollout**
   - Enable for internal testing first
   - Enable for subset of users
   - Quick rollback if issues found

2. **Parallel Development**
   - Old code continues working
   - New code can be developed without breaking prod
   - Easy to compare behavior

3. **Implementation** (during migration)
   ```typescript
   const ENABLE_AI_SDK_CHAT = process.env.ENABLE_AI_SDK_CHAT === 'true';

   // In component:
   const chatHook = ENABLE_AI_SDK_CHAT
     ? useAIChat(workspaceId, session)
     : useLegacyChat(workspaceId, session);
   ```

**Post-Migration:** Feature flags were removed after validation confirmed the new implementation works correctly. The migration is now complete and the new implementation is the default.

### Decision 4: Message Format Strategy

**Options Considered:**

| Option | Description |
|--------|-------------|
| **A: New Schema** | Create new tables for AI SDK messages |
| **B: Adapt Existing** | Map AI SDK format to/from existing schema |
| **C: Dual Write** | Write to both formats |

**Decision: Option B (Adapt Existing)**

**Reasoning:**

1. **Schema is Adequate**
   ```sql
   -- Existing workspace_chat has what we need:
   - id: maps to AI SDK message id
   - prompt: maps to user message content
   - response: maps to assistant message content
   - Additional fields for plans/renders still work
   ```

2. **No Migration Required**
   - Existing messages continue to work
   - New messages fit same schema
   - History loading just needs adapter

3. **Adapter Layer**
   ```typescript
   // Convert DB format to AI SDK format
   function dbMessageToAISDK(dbMsg: ChatMessage): Message {
     return {
       id: dbMsg.id,
       role: dbMsg.prompt ? 'user' : 'assistant',
       content: dbMsg.prompt || dbMsg.response,
     };
   }

   // Convert AI SDK format to DB format
   function aisdkMessageToDB(msg: Message, workspaceId: string): ChatMessage {
     return {
       id: msg.id,
       workspaceId,
       prompt: msg.role === 'user' ? msg.content : null,
       response: msg.role === 'assistant' ? msg.content : null,
     };
   }
   ```

---

## Trade-offs & Reasoning

### Trade-off 1: Protocol Complexity vs. Standardization

| Keeping Custom | Adopting AI SDK |
|----------------|-----------------|
| ✅ No new learning | ✅ Industry standard |
| ✅ Full control | ✅ Better documentation |
| ❌ Maintenance burden | ✅ Community support |
| ❌ Harder onboarding | ✅ Easier hiring |
| ❌ Missing optimizations | ✅ Built-in features |

**Decision:** Accept protocol complexity in Go to gain standardization benefits.

**Reasoning:** The Go adapter is a one-time cost. The frontend benefits are ongoing: better DX, built-in features, easier maintenance, community support.

### Trade-off 2: Hybrid Architecture vs. Unified

| Unified (All AI SDK) | Hybrid (AI SDK + Centrifugo) |
|---------------------|------------------------------|
| ✅ Single pattern | ❌ Two patterns |
| ❌ Force HTTP for push | ✅ Right tool for job |
| ❌ Complex polling | ✅ Real push for async |
| ❌ More migration work | ✅ Less migration work |

**Decision:** Accept hybrid complexity to use appropriate patterns.

**Reasoning:** Chat and background jobs have different characteristics. Using HTTP for chat and WebSocket for push notifications is the correct architectural choice, even though it means maintaining two patterns.

### Trade-off 3: Database Writes

| Per-Token Writes (Current) | On-Completion Writes (Proposed) |
|---------------------------|--------------------------------|
| ✅ Crash recovery | ❌ May lose on crash |
| ❌ High DB load | ✅ Low DB load |
| ❌ Many transactions | ✅ Single transaction |
| ✅ Progress visible in DB | ❌ Only final result |

**Decision:** Move to on-completion writes with optional per-token for long responses.

**Reasoning:** The crash recovery benefit is minimal (users can retry), but the DB load reduction is significant. For very long responses, we can optionally checkpoint periodically.

### Trade-off 4: Tool Call Visibility

| Hidden Tools (Current) | Visible Tools (Proposed) |
|-----------------------|-------------------------|
| ✅ Simpler UI | ❌ More complex UI |
| ❌ User confusion | ✅ User understands AI |
| ❌ No transparency | ✅ Builds trust |

**Decision:** Expose tool calls in UI (optional, can be hidden).

**Reasoning:** Users often wonder "what is the AI doing?" during tool calls. Showing tool activity builds trust and understanding. Can be collapsed/hidden for users who don't want details.

---

## Migration Path Justification

### Why This Sequence?

```
Phase 1: Foundation (PRs 1-2)
├── Why first? No risk, just setup
├── Enables parallel frontend/backend work
└── Feature flag allows safe experimentation

Phase 2: Backend Protocol (PRs 3-4)
├── Why second? Core technical challenge
├── Can be tested in isolation
└── Frontend has abstraction ready

Phase 3: Frontend Integration (PRs 5-7)
├── Why third? Depends on backend being ready
├── Incremental UI migration
└── Feature flag controls activation

Phase 4: Tool Calling (PR 8)
├── Why fourth? Most complex piece
├── Chat must work first
└── Can iterate on visibility

Phase 5: Cleanup (PRs 9-11)
├── Why last? Only after validation
├── Removes tech debt
└── Documentation captures learnings
```

### Why Not...?

**Q: Why not migrate plans to AI SDK too?**
A: Plans are asynchronous background jobs. They're triggered and run independently. HTTP streaming doesn't fit this pattern well. Centrifugo's pub/sub is the right tool.

**Q: Why not use Next.js API routes for all LLM calls?**
A: The Go worker has battle-tested logic for file editing, vector search, and Helm execution. Rewriting would take months and introduce bugs. The AI SDK protocol adapter in Go is much safer.

**Q: Why not use a different streaming library?**
A: Vercel AI SDK is the most adopted, best documented, and actively maintained. It also has the Go library (`aisdk-go`) which is critical for our architecture.

**Q: Why keep Centrifugo at all?**
A: Even after migration, we need push notifications for:
- Plan status updates (planning → review → executing → complete)
- Render progress (dep update → template → complete)
- File artifact updates (when AI edits files)
- Collaboration features (future)

---

## Testing Strategy

### Test Coverage Summary

**Total Test Suites:** 9  
**Total Tests:** 80  
**Status:** ✅ All passing

### Test Categories

#### 1. Frontend Unit Tests (45 tests)

**`hooks/__tests__/useAIChat.test.tsx` (18 tests)**
- Message format conversion (AI SDK ↔ Chartsmith)
- Jotai atom synchronization for backward compatibility
- Historical message loading
- Role selection (auto/developer/operator)
- Input state management
- Error handling
- Stop/reload functionality
- Tool invocation preservation
- Metadata preservation

**`app/api/chat/__tests__/route.test.ts` (18 tests)**
- Cookie-based authentication (web)
- Bearer token authentication (extension fallback)
- Request validation (messages array, workspaceId)
- Proxying to Go backend with correct format
- Response streaming (SSE format)
- Error handling (network, backend errors)
- Go worker URL resolution (env var → database param → localhost)

**`lib/types/__tests__/chat.test.ts` (9 tests)**
- Message format conversion utilities
- User/assistant message conversion
- Array content format handling
- Metadata preservation
- Error cases (unsupported roles)

#### 2. Integration Tests (35 tests)

**`hooks/__tests__/useChatPersistence.test.tsx` (4 tests)**
- History loading on mount
- Message persistence callbacks
- Error handling

**`lib/services/__tests__/chat-persistence.test.ts` (6 tests)**
- API calls for loading messages
- API calls for saving messages
- Message format conversion in persistence layer

**`__tests__/integration/chat-flow.test.tsx` (Integration tests)**
- End-to-end message flow
- Component integration
- Real-time updates during streaming
- Error handling across stack

#### 3. Backend Tests (Go)

**`pkg/llm/aisdk_test.go`**
- Stream writer initialization
- Text delta formatting
- Tool call formatting (start, delta, result)
- Finish event formatting
- Error event formatting
- Thread safety
- SSE protocol compliance

### Test Architecture Patterns

1. **Mocking Strategy:**
   - `@ai-sdk/react` mocked for hook tests
   - `fetch` mocked for API route tests
   - `jotai` mocked for atom tests
   - `next/headers` mocked for cookie access

2. **Environment Configuration:**
   - Node environment for API route tests
   - jsdom environment for React hook tests

3. **Key Testing Patterns:**
   - Hook testing with `@testing-library/react`'s `renderHook`
   - API route testing by directly importing handlers
   - Integration testing without full component rendering for performance

### Why These Tests Matter

- **Unit Tests:** Fast execution, easy debugging, clear responsibility boundaries
- **Integration Tests:** Catch integration bugs, verify data flow, test real-world scenarios
- **Backend Tests:** Ensure protocol compliance, thread safety, proper error handling

**See:** `chartsmith-app/TEST_COVERAGE.md` for detailed test documentation

---

## Summary

### What Changes

| Component | Change |
|-----------|--------|
| Frontend Chat UI | Uses `useChat` hook instead of manual state |
| Frontend Chat State | AI SDK manages messages, not Jotai |
| Message Streaming | HTTP SSE instead of WebSocket |
| Go Worker | New endpoint outputting AI SDK protocol |
| Chat Message Events | Via HTTP stream, not Centrifugo |

### What Stays the Same

| Component | Reason | Success Criterion |
|-----------|--------|-------------------|
| Go LLM orchestration | Proven, complex, working | — |
| **System prompts** (`pkg/llm/system.go`) | Critical for AI behavior quality | **G4** |
| **User roles** (auto/developer/operator) | Affects prompt context and intent routing | **G4** |
| **Chart context injection** | Provides relevant file content to AI | **G4** |
| Tool implementations | No reason to change | G5 |
| Database schema | Adequate for both formats | G3 |
| Centrifugo for non-chat | Right tool for push events | — |
| Intent classification | Still uses Groq/Llama | G5 |
| Embeddings & file selection | Still uses Voyage for relevant files | G4, G5 |

#### System Prompts Preserved (Success Criterion G4)

The following system prompts in `pkg/llm/system.go` remain **completely unchanged**:

```go
// These prompts define Chartsmith's AI behavior and MUST NOT be modified:
- commonSystemPrompt        // Base Helm chart developer persona
- endUserSystemPrompt       // Operator/SRE persona
- chatOnlySystemPrompt      // Conversational Q&A context
- initialPlanSystemPrompt   // Plan generation context
- updatePlanSystemPrompt    // Plan update context
- detailedPlanSystemPrompt  // Detailed plan generation
- executePlanSystemPrompt   // File execution context
- convertFileSystemPrompt   // K8s to Helm conversion
```

#### User Role Behavior Preserved (Success Criterion G4)

The role selection (auto/developer/operator) continues to:
1. Route through `GetChatMessageIntent()` in `pkg/llm/intent.go`
2. Select appropriate system prompt based on `messageFromPersona`
3. Provide role-specific context in conversational responses

### Expected Benefits

1. **Developer Experience**
   - Standard patterns instead of custom
   - Less code to maintain
   - Better documentation

2. **User Experience**
   - Faster perceived response (optimistic updates)
   - Smoother streaming (built-in optimizations)
   - Better error handling (built-in states)

3. **Future Flexibility**
   - Easy provider switching
   - Community improvements
   - Standard tooling compatibility

### Expected Costs

1. **One-Time**
   - Migration effort (~6 weeks)
   - Learning curve for AI SDK
   - Protocol adapter development

2. **Ongoing**
   - Hybrid architecture complexity
   - Two streaming patterns
   - Dependency on AI SDK updates
