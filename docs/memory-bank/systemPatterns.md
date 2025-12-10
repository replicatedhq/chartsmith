# System Patterns: Chartsmith Architecture

## Architecture Overview

Chartsmith follows a **hybrid architecture** pattern:
- **Frontend**: Next.js React application with server actions
- **Backend**: Go worker processes handling LLM orchestration
- **Database**: PostgreSQL with pgvector for embeddings
- **Realtime**: Centrifugo WebSocket pub/sub for events
- **Communication**: PostgreSQL pg_notify for job dispatch

## Key Architectural Patterns

### 1. Job Queue Pattern

**Pattern**: PostgreSQL `work_queue` table + `pg_notify` for job dispatch

**Flow**:
```
Frontend Server Action → INSERT into work_queue → pg_notify('job_type', payload)
                                                          ↓
Go Worker LISTEN → Pick up job → Process → Send results via Centrifugo
```

**Files**:
- `pkg/listener/listener.go` - Listens for pg_notify events
- `pkg/listener/conversational.go` - Handles conversational chat jobs
- `pkg/listener/new_intent.go` - Handles intent classification
- `pkg/listener/new_plan.go` - Handles plan generation

**Benefits**:
- Simple, no external queue needed
- Leverages existing PostgreSQL connection
- Reliable delivery via database transactions

### 2. Streaming Pattern (Current)

**Pattern**: Go channels + Centrifugo WebSocket for streaming

**Current Implementation**:
```go
streamCh := make(chan string, 1)
doneCh := make(chan error, 1)

go func() {
    // Stream from Anthropic
    for stream.Next() {
        token := event.Delta.Text
        streamCh <- token
    }
    doneCh <- nil
}()

// Accumulate and broadcast
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

**Files**:
- `pkg/llm/conversational.go` - Streaming logic
- `pkg/realtime/centrifugo.go` - Centrifugo event sending
- `chartsmith-app/hooks/useCentrifugo.ts` - Frontend WebSocket handling

**Migration Target**: HTTP SSE with AI SDK protocol

### 3. State Management Pattern

**Frontend**: Jotai atoms for global state

**Key Atoms**:
- `messagesAtom` - Chat messages array
- `workspaceAtom` - Current workspace
- `plansAtom` - Generated plans
- `rendersAtom` - Chart renders
- `isRenderingAtom` - Derived from active render IDs

**Files**:
- `chartsmith-app/atoms/workspace.ts` - All workspace-related atoms

**Migration Impact**: AI SDK will manage chat messages, Jotai for plans/renders

### 4. Server Action Pattern

**Pattern**: Next.js server actions for data mutations

**Flow**:
```
Client Component → Server Action → Database → pg_notify → Go Worker
```

**Examples**:
- `createChatMessageAction` - Creates chat message, triggers intent classification
- `getWorkspaceMessagesAction` - Fetches message history
- `cancelMessageAction` - Cancels in-progress message

**Files**:
- `chartsmith-app/lib/workspace/actions/` - All server actions

**Migration Impact**: New `/api/chat` route for AI SDK, server actions still used for other operations

### 5. Tool Calling Pattern

**Pattern**: Anthropic tool definitions + execution loop

**Current Flow**:
1. Define tools in Go (`latest_subchart_version`, `text_editor_20241022`)
2. Stream Anthropic response with tool calls
3. Execute tools in Go
4. Add tool results to conversation
5. Continue until no more tool calls

**Files**:
- `pkg/llm/conversational.go` - Tool definitions and execution
- `pkg/llm/execute-action.go` - Text editor tool implementation

**Migration Impact**: Tool calls stream in AI SDK format, execution unchanged

### 6. Intent Classification Pattern

**Pattern**: Fast/cheap LLM (Groq/Llama) for routing

**Flow**:
```
User Message → Intent Classification (Groq) → Route to:
  - Conversational (Claude)
  - Plan Generation (Claude)
  - Execute Plan (Claude)
```

**Files**:
- `pkg/llm/intent.go` - Intent classification logic
- `pkg/listener/new_intent.go` - Intent handler

**Migration Impact**: Unchanged

### 7. File Context Pattern

**Pattern**: Vector embeddings for relevant file selection

**Flow**:
```
User Message → Embedding (Voyage) → Vector Search (pgvector) → Relevant Files → Include in Prompt
```

**Files**:
- `pkg/embedding/` - Embedding generation
- `pkg/llm/conversational.go` - File context injection

**Migration Impact**: Unchanged

### 8. Plan-Execute Pattern

**Pattern**: Two-phase approach for complex changes

**Phase 1: Plan**
- AI generates structured plan
- User reviews plan
- Plan stored in database

**Phase 2: Execute**
- User approves plan
- AI executes file changes via `text_editor` tool
- Changes applied to workspace

**Files**:
- `pkg/llm/plan.go` - Plan generation
- `pkg/llm/execute-plan.go` - Plan execution
- `pkg/llm/execute-action.go` - File editing logic

**Migration Impact**: Unchanged

### 9. Render Pattern

**Pattern**: Background job for Helm chart rendering

**Flow**:
```
Chat Message Complete → Enqueue Render Job → Go Worker → helm dep update → helm template → Store Results
                                                                                ↓
                                                                    Centrifugo Stream → Frontend
```

**Files**:
- `pkg/listener/render.go` - Render job handler
- `chartsmith-app/hooks/useCentrifugo.ts` - Render stream handling

**Migration Impact**: Unchanged (still uses Centrifugo)

### 10. Message Persistence Pattern

**Current**: Per-token writes to database
- Each token triggers `AppendChatMessageResponse`
- High write load but crash recovery

**Migration Target**: On-completion writes
- Single write when message finishes
- Lower database load
- Optional checkpointing for long responses

**Files**:
- `pkg/workspace/workspace.go` - Message persistence functions

## Component Relationships

### Frontend Components
```
ChatContainer
  ├── ChatMessage (renders each message)
  │   ├── PlanChatMessage (if plan exists)
  │   └── Terminal (if render exists)
  └── Chat Input (form submission)
```

### Backend Packages
```
pkg/listener/
  ├── conversational.go → pkg/llm/conversational.go
  ├── new_intent.go → pkg/llm/intent.go
  ├── new_plan.go → pkg/llm/plan.go
  └── execute_plan.go → pkg/llm/execute-plan.go
                          └── pkg/llm/execute-action.go
```

### Data Flow
```
User Input → Server Action → PostgreSQL → pg_notify
                                    ↓
                            Go Worker Listener
                                    ↓
                            LLM Package (Anthropic/Groq/Voyage)
                                    ↓
                            Centrifugo Event
                                    ↓
                            Frontend useCentrifugo Hook
                                    ↓
                            Jotai Atom Update
                                    ↓
                            Component Re-render
```

## Design Principles

### 1. Simplicity Over Complexity
- Single database (PostgreSQL)
- No external queues
- Minimal moving parts

### 2. Go for Heavy Lifting
- LLM orchestration in Go
- File operations in Go
- Helm execution in Go

### 3. React for UI
- Server actions for data mutations
- Client components for interactivity
- Jotai for global state

### 4. Separation of Concerns
- Chat: Request-response (migrating to HTTP)
- Plans/Renders: Background jobs (Centrifugo)
- File artifacts: Real-time updates (Centrifugo)

## Migration Patterns

### New Pattern: AI SDK Integration
```
useChat Hook → /api/chat → Go Worker /api/v1/chat → AI SDK Stream Adapter → Anthropic
```

### Preserved Pattern: Centrifugo for Background Events
```
Go Worker → Centrifugo → useCentrifugo Hook → Jotai Atoms → Components
```

## Key Files Reference

### Frontend
- `chartsmith-app/components/ChatContainer.tsx` - Main chat UI
- `chartsmith-app/components/ChatMessage.tsx` - Message rendering
- `chartsmith-app/hooks/useCentrifugo.ts` - WebSocket handling
- `chartsmith-app/atoms/workspace.ts` - State management

### Backend
- `pkg/listener/conversational.go` - Chat message handler
- `pkg/llm/conversational.go` - LLM streaming logic
- `pkg/realtime/centrifugo.go` - Event broadcasting
- `pkg/workspace/workspace.go` - Database operations

