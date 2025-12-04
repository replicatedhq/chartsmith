# PR1.5 Known Issues - AI SDK Test Path

**Created:** December 4, 2025  
**Purpose:** Document all known issues with `/test-ai-chat` path for deep research investigation  
**Goal:** Achieve feature parity with main `/workspace/[id]` path before deprecation

---

## Critical Issues

### 1. Workspace Creation Flow Missing

**Symptom:** When a user types a prompt on the `/test-ai-chat` homepage and submits, no new workspace is created in the database. The user is taken to a chat view with a placeholder `test-workspace` ID.

**Expected Behavior (Main Path):** On `/`, when a user enters a prompt and submits:
1. A new workspace is created in the database
2. User is redirected to `/workspace/{newWorkspaceId}`
3. Chat history is persisted to that workspace
4. Files are associated with that workspace

**Current Behavior (Test Path):** Chat happens in-memory with no persistence, no workspace creation, and no database integration.

**Files to Investigate:**
- `app/page.tsx` - Main landing page that creates workspaces
- `app/workspace/[id]/page.tsx` - How main path handles workspace context
- `lib/workspace/actions/` - Workspace creation server actions
- `app/test-ai-chat/page.tsx` - Current test implementation
- `app/test-ai-chat/[workspaceId]/page.tsx` - Route-based test page

---

### 2. Tool Calling Not Executing - AI Outputs XML as Text

**Symptom:** When the AI should call a tool like `latestSubchartVersion`, it outputs the tool invocation as literal XML text in the chat:
```
<latestSubchartVersion> {"chartName": "postgresql"} </latestSubchartVersion>
```
Then it hallucmates a response (e.g., version `15.5.32` or `16.2.1`) instead of using actual tool results.

**Expected Behavior:** 
1. AI SDK should intercept tool calls
2. Execute the tool function
3. Return results to the AI
4. AI incorporates real results into response

**Actual API Response (from Go backend):** The correct version from ArtifactHub is `18.1.13`.

**Evidence:** Screenshots show:
- Tool invocation appearing as text: `<latestSubchartVersion> {"chartName": "postgresql"} </latestSubchartVersion>`
- Hallucinated version in response: `15.5.32`

**Potential Root Causes to Investigate:**
- AI SDK version incompatibility with tool execution
- Missing `maxSteps` configuration in `streamText()`
- Incorrect streaming response format (`toTextStreamResponse` vs `toUIMessageStreamResponse`)
- Tool registration not being passed correctly
- Client-side `useChat` not configured for tool handling

**Files to Investigate:**
- `app/api/chat/route.ts` - Tool registration and streamText config
- `lib/ai/tools/index.ts` - Tool factory and exports
- `lib/ai/tools/latestSubchartVersion.ts` - Specific tool implementation
- `app/test-ai-chat/[workspaceId]/page.tsx` - useChat configuration
- `node_modules/@ai-sdk/react/` - useChat hook implementation
- `node_modules/ai/` - streamText and tool execution

**Debug Logging Added:**
- `[/api/chat]` logs in route.ts
- `[latestSubchartVersion]` logs in tool file

---

### 3. White Highlighting Covering Chat Text

**Symptom:** Strange white/light highlighting appears over text in the chat history, making it difficult to read.

**Location:** Visible in assistant message bubbles in `/test-ai-chat/[workspaceId]` path.

**Potential Causes:**
- CSS class conflicts between dark/light theme
- Markdown rendering styles (`prose` classes)
- Background color inheritance issues
- Code block styling within chat bubbles

**Files to Investigate:**
- `app/test-ai-chat/[workspaceId]/page.tsx` - Inline styles and classes
- `components/ChatMessage.tsx` - Main path's message styling (for comparison)
- `app/globals.css` - Global styles
- `tailwind.config.ts` - Theme configuration
- Any `markdown-content` or `prose` class definitions

---

### 4. File Explorer Missing from Test Path

**Symptom:** The test-ai-chat path does not show the file explorer/tree panel that appears in the main `/workspace/[id]` path.

**Expected Behavior:** Users should see:
- Left sidebar with file tree
- Chart structure (Chart.yaml, values.yaml, templates/)
- Ability to click files to view/edit

**Current Behavior:** Only the chat panel is visible; no file explorer.

**Files to Investigate:**
- `app/workspace/[id]/page.tsx` - How main path renders file explorer
- `components/workspace/` - File explorer components
- `components/layout/EditorLayout.tsx` - Layout wrapper used by test path
- `components/FileTree.tsx` or similar - Tree component

---

## Secondary Issues

### 5. Chat History Not Persisted

**Symptom:** When navigating away from `/test-ai-chat/[workspaceId]` and returning, chat history is lost.

**Expected Behavior (Main Path):** Chat history is stored in database and reloaded on page refresh.

**Files to Investigate:**
- `lib/workspace/workspace.ts` - How main path loads/saves messages
- Database schema for chat messages
- `app/api/chat/route.ts` - Should messages be persisted here?

---

### 6. Revision Number Not Incrementing

**Symptom:** The test path shows "Rev #1" but doesn't increment revision numbers as changes are made.

**Expected Behavior:** Each AI modification should create a new revision.

**Files to Investigate:**
- `lib/workspace/` - Revision management
- How main path tracks and increments revisions

---

### 7. No File Creation/Modification Feedback

**Symptom:** When the `textEditor` tool is called (create/str_replace commands), there's no visual feedback that files were created or modified.

**Expected Behavior (Main Path):** 
- File explorer updates to show new files
- Modified files are highlighted
- Content changes are reflected in real-time

**Files to Investigate:**
- `lib/ai/tools/textEditor.ts` - Tool implementation
- How main path handles file state updates
- WebSocket or polling for file changes

---

### 8. getChartContext Tool - Database Connection Issues

**Symptom:** The `getChartContext` tool was refactored to call a Go endpoint instead of direct DB access due to Next.js bundling issues with `pg` module.

**Concern:** May not be returning the same data structure as expected.

**Files to Investigate:**
- `lib/ai/tools/getChartContext.ts`
- `pkg/api/handlers/context.go`
- `pkg/workspace/workspace.go` - ListCharts function
- Compare response format with what AI expects

---

## Architecture Gaps

### 9. Missing Integration Points

The test path appears to be missing these integrations present in the main path:

| Feature | Main Path | Test Path |
|---------|-----------|-----------|
| Workspace creation | ✅ | ❌ |
| Chat persistence | ✅ | ❌ |
| File explorer | ✅ | ❌ |
| Revision tracking | ✅ | ❌ |
| Real-time file updates | ✅ | ❌ |
| Tool execution | ✅ | ❌ (appears broken) |
| Export functionality | ✅ | ❌ |

---

### 10. AI SDK v5 Migration Concerns

**Context:** The project migrated from AI SDK v4 to v5, which introduced breaking changes.

**Known v5 Changes:**
- `useChat` no longer returns `input`/`setInput` directly
- `parameters` renamed to `inputSchema` in tool definitions
- New streaming response methods (`toUIMessageStreamResponse`)
- `DataStreamChatTransport` vs `TextStreamChatTransport`

**Files to Investigate:**
- `package.json` - AI SDK version
- AI SDK v5 migration guide
- All tool definitions for correct `inputSchema` usage
- `useChat` hook usage in all pages

---

## Comparison: Main Path vs Test Path

### Main Path Flow (`/workspace/[id]`)
1. User lands on `/` 
2. Enters prompt → workspace created
3. Redirected to `/workspace/{id}`
4. Full UI with file explorer + chat
5. AI calls tools → Go backend executes → results returned
6. Files created/modified → UI updates
7. Chat history persisted to database

### Test Path Flow (`/test-ai-chat/[workspaceId]`)
1. User manually navigates to `/test-ai-chat/{id}`
2. Chat UI only (no file explorer)
3. AI attempts tool calls → **BROKEN** (outputs XML as text)
4. No file state management
5. No persistence

---

## Debug Commands

```bash
# Check Go server is running and tools endpoints work
curl -X POST http://localhost:8080/api/tools/versions/subchart \
  -H "Content-Type: application/json" \
  -d '{"chartName": "postgresql"}'

# Expected response:
# {"success":true,"name":"postgresql","version":"18.1.13","repository":"https://charts.bitnami.com/bitnami","appVersion":"..."}

# Check context endpoint
curl -X POST http://localhost:8080/api/tools/context \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": "FiJ22hzLoeI0", "revisionNumber": 1}'
```

---

## Key Questions for Investigation

1. **Why is the AI outputting tool invocations as XML text instead of executing them?**
   - Is this a client-side or server-side issue?
   - Are tools being registered correctly in `streamText()`?
   - Is `useChat` configured to handle tool results?

2. **What is the workspace creation flow in the main path, and how do we replicate it?**
   - What server action creates the workspace?
   - How does the redirect happen?
   - Where is the initial prompt stored?

3. **How does the main path's file explorer get its data?**
   - Is it from initial page load props?
   - Is there a separate API call?
   - How does it update in real-time?

4. **Are we using the correct AI SDK v5 patterns?**
   - Check `streamText` options
   - Check `useChat` configuration
   - Check tool definition format

---

## Related Files Summary

### TypeScript (Next.js App)
- `app/api/chat/route.ts` - AI SDK route handler
- `app/test-ai-chat/page.tsx` - Test landing page
- `app/test-ai-chat/[workspaceId]/page.tsx` - Test chat with workspace
- `app/workspace/[id]/page.tsx` - Main workspace page
- `app/page.tsx` - Main landing page (resets atoms, no workspace creation)
- `lib/ai/tools/*.ts` - AI SDK tool definitions
- `lib/ai/llmClient.ts` - Shared LLM client
- `lib/ai/prompts.ts` - System prompts

### Main Path Components (CRITICAL for understanding)
- `components/CreateChartOptions.tsx` - **Creates workspaces** via `createWorkspaceFromPromptAction()`
- `components/ChatContainer.tsx` - **Main chat** (uses server actions, NOT AI SDK)
- `components/WorkspaceContent.tsx` - **Full workspace UI** with file explorer
- `components/WorkspaceContainer.tsx` - File explorer + code editor
- `components/chat/AIChat.tsx` - **Existing AI SDK chat** (incomplete, no tools!)

### Workspace/Database Layer
- `lib/workspace/workspace.ts` - **1200+ line file** with all workspace operations
- `lib/workspace/actions/create-workspace-from-prompt.ts` - Workspace creation action
- `lib/workspace/actions/create-chat-message.ts` - Chat message persistence

### Go (Backend)
- `pkg/api/server.go` - HTTP server for tool endpoints
- `pkg/api/handlers/editor.go` - textEditor tool handler
- `pkg/api/handlers/versions.go` - Version lookup handlers
- `pkg/api/handlers/context.go` - Chart context handler
- `pkg/llm/conversational.go` - **REFERENCE** for tool calling loop pattern
- `pkg/workspace/workspace.go` - Go workspace operations
- `pkg/recommendations/versions.go` - ArtifactHub lookups

### Configuration
- `package.json` - AI SDK version
- `next.config.ts` - serverExternalPackages
- `tsconfig.json`

---

## Next Steps for Investigation Agent

1. **Trace tool execution path** from user message → route.ts → tool execution → response
2. **Compare main path components** with test path to identify missing pieces
3. **Check AI SDK v5 documentation** for correct tool usage patterns
4. **Verify Go endpoints** are being called and returning correct data
5. **Identify minimum changes** needed for feature parity

