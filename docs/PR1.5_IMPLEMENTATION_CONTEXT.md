# PR1.5 Implementation Context - Main Path Reference

**Created:** December 4, 2025  
**Purpose:** Document how the main path (`/workspace/[id]`) works so the test path can achieve feature parity

---

## Key Discovery: Main Path Does NOT Use AI SDK for Chat

The main `/workspace/[id]` path uses **server actions** to persist chat messages, NOT the AI SDK's `useChat` hook. The actual LLM calls happen in the **Go backend**, not in Next.js.

---

## Main Path Flow

### 1. Workspace Creation (`components/CreateChartOptions.tsx`)

```typescript
// User enters prompt on homepage → createWorkspaceFromPromptAction
const handlePromptSubmit = async () => {
  const w = await createWorkspaceFromPromptAction(session, prompt);
  router.replace(`/workspace/${w.id}`);
};
```

The `createWorkspaceFromPromptAction` server action:
1. Creates workspace in database
2. Creates initial chat message
3. Enqueues work for Go worker (`new_intent`, `new_plan`, etc.)
4. Returns workspace with ID

### 2. Workspace Loading (`app/workspace/[id]/page.tsx`)

The workspace page loads:
- `initialWorkspace` - Full workspace with charts and files
- `initialMessages` - All chat messages
- `initialPlans` - Planning state
- `initialRenders` - Render history
- `initialConversions` - K8s conversion state

These are passed to `WorkspaceContent` which hydrates Jotai atoms.

### 3. Chat in Main Path (`components/ChatContainer.tsx`)

```typescript
const handleSubmitChat = async (e: React.FormEvent) => {
  // Uses server action, NOT AI SDK
  const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim(), selectedRole);
  setMessages(prev => [...prev, chatMessage]);
};
```

The `createChatMessageAction` persists to database and enqueues work for Go.

### 4. Go Handles LLM Calls (`pkg/llm/conversational.go`)

```go
// Go does the actual tool calling loop
for {
    stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{...})
    
    // Process response
    for stream.Next() {
        event := stream.Current()
        // Stream text to frontend via Centrifugo
        if event.Delta.Text != "" {
            streamCh <- event.Delta.Text
        }
    }
    
    // Check for tool calls
    hasToolCalls := false
    for _, block := range message.Content {
        if block.Type == anthropic.ContentBlockTypeToolUse {
            hasToolCalls = true
            // Execute tool and collect results
            switch block.Name {
            case "latest_subchart_version":
                version, _ := recommendations.GetLatestSubchartVersion(input.ChartName)
                response = version
            }
            toolResults = append(toolResults, anthropic.NewToolResultBlock(block.ID, response, false))
        }
    }
    
    if !hasToolCalls {
        break  // Exit loop when no more tool calls
    }
    
    // Send tool results back to model
    messages = append(messages, anthropic.MessageParam{
        Role:    anthropic.F(anthropic.MessageParamRoleUser),
        Content: anthropic.F(toolResults),
    })
}
```

**Key Insight:** The main path uses a tool calling LOOP in Go. The AI SDK test path needs to replicate this with `maxSteps`.

---

## Existing AI SDK Component (`components/chat/AIChat.tsx`)

There IS an existing AI SDK chat component, but it's incomplete:

```typescript
// Uses TextStreamChatTransport - which may not support tools properly
const transport = React.useMemo(() => {
  return new TextStreamChatTransport({
    api: "/api/chat",
    body: {
      provider: selectedProvider,
      model: selectedModel,
      // NO workspaceId passed!
    },
  });
}, [selectedProvider, selectedModel]);
```

**Problems with existing AIChat:**
1. Does NOT pass `workspaceId` to API
2. Uses `TextStreamChatTransport` (may not handle tool results)
3. No tool execution feedback in UI
4. Not integrated with workspace creation flow

---

## Database Schema Insights (`lib/workspace/workspace.ts`)

### Workspace Creation (1200+ line file)

```typescript
export async function createWorkspace(createdType: string, userId: string, ...) {
  const id = srs.default({ length: 12, alphanumeric: true });
  
  // Insert workspace
  await client.query(`INSERT INTO workspace (...) VALUES (...)`);
  
  // Insert revision
  await client.query(`INSERT INTO workspace_revision (...) VALUES (...)`);
  
  // Insert charts and files from bootstrap or baseChart
  // ...
  
  // Create initial chat message
  const chatMessage = await createChatMessage(userId, id, createChartMessageParams);
  
  // Enqueue summarization for files
  for (const file of files) {
    await enqueueWork("new_summarize", { fileId: file.id, revision: revisionNumber });
  }
}
```

### Chat Message Creation

```typescript
export async function createChatMessage(userId: string, workspaceId: string, params: CreateChatMessageParams) {
  // Insert into workspace_chat table
  await client.query(`INSERT INTO workspace_chat (...) VALUES (...)`);
  
  // Enqueue work based on intent
  if (!params.knownIntent) {
    await enqueueWork("new_intent", { chatMessageId, workspaceId });
  } else if (params.knownIntent === ChatMessageIntent.PLAN) {
    const plan = await createPlan(userId, workspaceId, chatMessageId);
    await enqueueWork("new_plan", { planId: plan.id });
  }
}
```

### getWorkspace Return Type

```typescript
const w: Workspace = {
  id: row.id,
  createdAt: row.created_at,
  lastUpdatedAt: row.last_updated_at,
  name: row.name,
  currentRevisionNumber: row.current_revision_number,
  files: [],           // WorkspaceFile[]
  charts: [],          // Chart[] with nested files
  isCurrentVersionComplete: true,
  incompleteRevisionNumber?: number,
};
```

---

## Real-Time Updates (`hooks/useCentrifugo.ts`)

The main path uses Centrifugo WebSocket for real-time updates:
- Chat message streaming
- Plan progress
- Render status
- File changes

The test path does NOT have this integration.

---

## State Management (Jotai Atoms)

Main path uses Jotai atoms for state:

```typescript
// atoms/workspace.ts
export const workspaceAtom = atom<Workspace | null>(null);
export const messagesAtom = atom<Message[]>([]);
export const plansAtom = atom<Plan[]>([]);
export const rendersAtom = atom<RenderedWorkspace[]>([]);
export const conversionsAtom = atom<Conversion[]>([]);
export const selectedFileAtom = atom<WorkspaceFile | undefined>(undefined);
export const editorViewAtom = atom<"source" | "rendered">("source");
```

Test path does NOT use these atoms - it uses local `useState`.

---

## File Explorer Integration

`WorkspaceContent.tsx` conditionally shows the file explorer:

```typescript
const showEditor = workspace?.currentRevisionNumber && workspace?.currentRevisionNumber > 0 
  || workspace?.incompleteRevisionNumber;

{showEditor && (
  <WorkspaceContainer
    session={session}
    editorContent={editorContent}
    onCommandK={openCommandMenu}
  />
)}
```

Test path is missing `WorkspaceContainer` entirely.

---

## Summary: What Test Path is Missing

| Feature | Main Path | Test Path | Gap |
|---------|-----------|-----------|-----|
| Workspace Creation | `createWorkspaceFromPromptAction` | None | Need to call action on submit |
| Chat Persistence | `createChatMessageAction` | None | Messages lost on refresh |
| Tool Execution | Go tool loop | AI SDK `maxSteps` | May need `toUIMessageStreamResponse` |
| Real-time Updates | Centrifugo WebSocket | None | No streaming from Go |
| File Explorer | `WorkspaceContainer` | None | Missing component |
| State Management | Jotai atoms | `useState` | Not integrated |
| Revision Tracking | Database | None | Not tracking changes |

---

## Recommended Investigation Order

1. **Tool Execution** - Why does AI output XML instead of calling tools?
   - Check `streamText` configuration in `route.ts`
   - Verify `maxSteps` is working
   - Check if `toUIMessageStreamResponse` vs `toTextStreamResponse` matters

2. **Workspace Creation** - How to create workspace from test path?
   - Reuse `createWorkspaceFromPromptAction`
   - Redirect to `/test-ai-chat/{workspaceId}` after creation

3. **File Explorer** - How to show files?
   - Import and use `WorkspaceContainer`
   - Need to hydrate workspace atoms

4. **Chat Persistence** - How to save messages?
   - Either call `createChatMessageAction` after each AI response
   - Or create new "AI SDK message" table

---

## Code Snippets for Reference

### Server Action Pattern (workspace creation)

```typescript
// lib/workspace/actions/create-workspace-from-prompt.ts
"use server";
export async function createWorkspaceFromPromptAction(session: Session, prompt: string) {
  return createWorkspace("prompt", session.user.id, { prompt });
}
```

### Tool Definition in Go (reference for AI SDK)

```go
tools := []anthropic.ToolParam{
  {
    Name:        anthropic.F("latest_subchart_version"),
    Description: anthropic.F("Return the latest version of a subchart from name"),
    InputSchema: anthropic.F(interface{}(map[string]interface{}{
      "type": "object",
      "properties": map[string]interface{}{
        "chart_name": map[string]interface{}{
          "type":        "string",
          "description": "The subchart name to get the latest version of",
        },
      },
      "required": []string{"chart_name"},
    })),
  },
}
```

### Tool Execution Pattern in Go

```go
// After getting tool call from model
switch block.Name {
case "latest_subchart_version":
  var input struct {
    ChartName string `json:"chart_name"`
  }
  json.Unmarshal(block.Input, &input)
  version, _ := recommendations.GetLatestSubchartVersion(input.ChartName)
  response = version
}

// Send result back
toolResults = append(toolResults, anthropic.NewToolResultBlock(block.ID, string(b), false))
```

