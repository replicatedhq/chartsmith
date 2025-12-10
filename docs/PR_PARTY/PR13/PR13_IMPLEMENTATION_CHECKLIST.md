# PR#13: Implementation Checklist

**Use this as your daily todo list.** Check off items as you complete them.

---

## Pre-Implementation Setup (15 minutes)

- [ ] Read main planning document (`PR13_DOCUMENTATION_UPDATES.md`) (~30 min)
- [ ] Verify PR#9 complete (feature flags removed)
- [ ] Review existing documentation to understand current state
- [ ] Identify all files that need documentation updates
- [ ] Git branch created
  ```bash
  git checkout -b docs/pr13-documentation-updates
  ```

---

## Phase 1: Frontend Documentation (1-2 hours)

### 1.1: Add JSDoc to useAIChat Hook (30 minutes)

#### Review Hook Implementation
- [ ] Read `chartsmith-app/hooks/useAIChat.ts`
- [ ] Understand parameters and return type
- [ ] Understand workspace integration
- [ ] Note any complex logic that needs explanation

#### Add Comprehensive JSDoc
- [ ] Add file-level comment explaining purpose
- [ ] Add JSDoc for `useAIChat` function
  ```typescript
  /**
   * Custom hook for AI SDK chat integration with Chartsmith workspace.
   *
   * This hook wraps @ai-sdk/react's useChat hook with Chartsmith-specific
   * configuration. It handles workspace context, message persistence, and
   * integration with existing Jotai atoms.
   *
   * @param options - Configuration options for the chat hook
   * @param options.session - User session for authentication
   * @param options.workspaceId - Workspace ID for chat context
   * @param options.onMessageComplete - Callback when message completes
   * @returns Chat hook interface compatible with useChat
   *
   * @example
   * ```tsx
   * const { messages, input, handleSubmit } = useAIChat({
   *   session,
   *   workspaceId: workspace.id,
   * });
   * ```
   *
   * @see https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
   */
  ```
- [ ] Add JSDoc for helper functions (if any)
- [ ] Add JSDoc for types/interfaces
- [ ] Add inline comments for complex logic

#### Verify Documentation
- [ ] JSDoc renders correctly in IDE
- [ ] Examples are accurate
- [ ] Links work

**Checkpoint:** useAIChat hook fully documented ✓

**Commit:** `docs(frontend): add comprehensive JSDoc to useAIChat hook`

---

### 1.2: Add JSDoc to /api/chat Route (30 minutes)

#### Review Route Implementation
- [ ] Read `chartsmith-app/app/api/chat/route.ts`
- [ ] Understand request/response format
- [ ] Understand authentication flow
- [ ] Understand streaming behavior

#### Add Comprehensive JSDoc
- [ ] Add file-level comment explaining purpose
- [ ] Add JSDoc for route handler
  ```typescript
  /**
   * Next.js API route that proxies chat requests to Go worker.
   *
   * This route acts as a bridge between the frontend useChat hook and
   * the Go backend. It handles authentication, request validation, and
   * streams responses in AI SDK Data Stream Protocol format.
   *
   * @route POST /api/chat
   * @param request - Next.js request object with chat messages
   * @returns Streaming response in AI SDK format
   *
   * @example
   * ```typescript
   * const response = await fetch('/api/chat', {
   *   method: 'POST',
   *   body: JSON.stringify({ messages: [...] }),
   * });
   * ```
   */
  ```
- [ ] Add inline comments for authentication logic
- [ ] Add inline comments for request validation
- [ ] Add inline comments for streaming setup
- [ ] Add inline comments for error handling

#### Verify Documentation
- [ ] JSDoc renders correctly
- [ ] Examples are accurate
- [ ] Error handling documented

**Checkpoint:** /api/chat route fully documented ✓

**Commit:** `docs(frontend): add JSDoc to /api/chat route`

---

### 1.3: Update Component Comments (30 minutes)

#### Update ChatContainer.tsx
- [ ] Read `chartsmith-app/components/ChatContainer.tsx`
- [ ] Remove references to Centrifugo chat
- [ ] Remove references to feature flags
- [ ] Update comments to reflect `useChat` usage
- [ ] Add comments explaining AI SDK integration
- [ ] Update any "TODO" or outdated comments

#### Update ChatMessage.tsx
- [ ] Read `chartsmith-app/components/ChatMessage.tsx`
- [ ] Update comments for AI SDK message format
- [ ] Remove references to old message format
- [ ] Add comments explaining message structure
- [ ] Update streaming-related comments

#### Update atoms/workspace.ts (if adapter functions exist)
- [ ] Read `chartsmith-app/atoms/workspace.ts`
- [ ] Update comments for adapter functions
- [ ] Document integration with AI SDK
- [ ] Remove outdated references

#### Verify Updates
- [ ] No references to removed features
- [ ] Comments match current implementation
- [ ] Comments are helpful and clear

**Checkpoint:** Component comments updated ✓

**Commit:** `docs(frontend): update component comments for AI SDK`

---

### 1.4: Update chartsmith-app/ARCHITECTURE.md (30 minutes)

#### Review Current Architecture Doc
- [ ] Read `chartsmith-app/ARCHITECTURE.md`
- [ ] Identify what needs updating
- [ ] Note existing sections to preserve

#### Add AI SDK Section
- [ ] Add "Chat & LLM Integration" section
  ```markdown
  ## Chat & LLM Integration

  Chartsmith uses the Vercel AI SDK for all chat functionality:

  - **Frontend**: `useChat` hook from `@ai-sdk/react` manages chat state
  - **API Route**: `/api/chat` Next.js route proxies to Go worker
  - **Backend**: Go worker outputs AI SDK Data Stream Protocol (HTTP SSE)
  - **Streaming**: Server-Sent Events (SSE) instead of WebSocket
  - **State**: Managed by AI SDK hook, integrated with Jotai for workspace state

  ### Flow
  ```
  User Input → ChatContainer → useAIChat → /api/chat → Go Worker → AI SDK Protocol → useChat → UI
  ```

  ### Key Components
  - `useAIChat`: Wraps `useChat` with Chartsmith-specific logic
  - `/api/chat`: Next.js API route that proxies to Go worker
  - `pkg/llm/aisdk.go`: Go adapter for AI SDK protocol
  - `pkg/api/chat.go`: HTTP endpoint for chat streaming

  ### Note on Centrifugo
  Centrifugo is still used for non-chat events (plans, renders, artifacts).
  Chat messages flow exclusively through the AI SDK HTTP SSE protocol.
  ```
- [ ] Add flow diagram (ASCII or Mermaid)
- [ ] Document key components
- [ ] Note Centrifugo usage for non-chat events
- [ ] Link to AI SDK documentation

#### Verify Updates
- [ ] Section is clear and accurate
- [ ] Diagrams render correctly
- [ ] Links work
- [ ] No outdated information

**Checkpoint:** Frontend architecture doc updated ✓

**Commit:** `docs(frontend): add AI SDK section to ARCHITECTURE.md`

---

## Phase 2: Backend Documentation (1-2 hours)

### 2.1: Add Go Doc Comments to aisdk.go (45 minutes)

#### Review aisdk.go Implementation
- [ ] Read `pkg/llm/aisdk.go`
- [ ] Understand all functions and types
- [ ] Understand protocol conversion logic
- [ ] Note complex logic that needs explanation

#### Add Package-Level Comment
- [ ] Add package comment explaining purpose
  ```go
  // Package aisdk provides adapters for converting Anthropic SDK streaming
  // events to the Vercel AI SDK Data Stream Protocol format.
  //
  // This package enables the Go backend to output streams compatible with
  // the frontend useChat hook, allowing us to leverage AI SDK patterns
  // while keeping our proven Go LLM orchestration logic.
  //
  // See: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
  package aisdk
  ```

#### Add Function-Level Comments
- [ ] Add Go doc comment for each exported function
  ```go
  // StreamAnthropicToAISDK converts Anthropic SDK streaming events to the
  // Vercel AI SDK Data Stream Protocol format and writes them as Server-Sent
  // Events (SSE) to the provided writer.
  //
  // The function handles:
  //   - Text deltas: Converts to "text-delta" events
  //   - Tool calls: Converts to "tool-call" events with proper IDs
  //   - Tool results: Converts to "tool-result" events
  //   - Finish events: Outputs "finish" event with reason
  //
  // See: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
  func StreamAnthropicToAISDK(ctx context.Context, stream *anthropic.Stream, w io.Writer) error {
      // Implementation
  }
  ```
- [ ] Add comments for complex internal functions
- [ ] Add inline comments for non-obvious logic
- [ ] Document error handling

#### Add Type Documentation
- [ ] Add comments for exported types
- [ ] Document struct fields if needed
- [ ] Add examples if helpful

#### Verify Documentation
- [ ] `go doc` command shows documentation
- [ ] Comments are clear and helpful
- [ ] Links are valid

**Checkpoint:** aisdk.go fully documented ✓

**Commit:** `docs(backend): add Go doc comments to aisdk.go`

---

### 2.2: Add Go Doc Comments to chat.go (30 minutes)

#### Review chat.go Implementation
- [ ] Read `pkg/api/chat.go` (or equivalent)
- [ ] Understand endpoint implementation
- [ ] Understand request/response handling
- [ ] Understand authentication

#### Add Endpoint Documentation
- [ ] Add file-level comment
- [ ] Add function-level comment for handler
  ```go
  // HandleChatStream handles POST /api/v1/chat/stream requests.
  //
  // This endpoint accepts chat messages and streams responses using the
  // Vercel AI SDK Data Stream Protocol. It handles authentication via
  // JWT Bearer tokens and validates requests before processing.
  //
  // Request format:
  //   POST /api/v1/chat/stream
  //   Authorization: Bearer <token>
  //   Content-Type: application/json
  //   Body: { "messages": [...] }
  //
  // Response: Streaming SSE with AI SDK protocol events
  func HandleChatStream(w http.ResponseWriter, r *http.Request) {
      // Implementation
  }
  ```
- [ ] Add comments for authentication logic
- [ ] Add comments for request validation
- [ ] Add comments for streaming setup
- [ ] Add comments for error handling

#### Verify Documentation
- [ ] `go doc` command shows documentation
- [ ] Request/response format documented
- [ ] Error cases documented

**Checkpoint:** chat.go fully documented ✓

**Commit:** `docs(backend): add Go doc comments to chat endpoint`

---

### 2.3: Update conversational.go Comments (30 minutes)

#### Review conversational.go
- [ ] Read `pkg/listener/conversational.go`
- [ ] Identify comments that reference old implementation
- [ ] Note what needs updating

#### Update Comments
- [ ] Update comments to reflect AI SDK path
- [ ] Remove references to old streaming
- [ ] Document new flow
- [ ] Add comments explaining AI SDK integration
- [ ] Update any "TODO" comments

#### Verify Updates
- [ ] No references to removed features
- [ ] Comments match current implementation
- [ ] Comments are helpful

**Checkpoint:** conversational.go comments updated ✓

**Commit:** `docs(backend): update conversational.go comments for AI SDK`

---

### 2.4: Update ARCHITECTURE.md (30 minutes)

#### Review Root ARCHITECTURE.md
- [ ] Read `ARCHITECTURE.md`
- [ ] Identify what needs updating
- [ ] Note existing sections to preserve

#### Update LLM/Chat Section
- [ ] Update or add "Chat & LLM Integration" section
  ```markdown
  ## Chat & LLM Integration

  Chartsmith uses the Vercel AI SDK for all conversational chat functionality.
  The Go worker outputs AI SDK Data Stream Protocol format, which the frontend
  consumes via the useChat hook.

  ### Architecture
  - Frontend: useChat hook manages chat state
  - API Route: /api/chat proxies to Go worker
  - Backend: Go worker outputs AI SDK protocol (HTTP SSE)
  - Streaming: Server-Sent Events instead of WebSocket

  ### Key Components
  - pkg/llm/aisdk.go: Adapter for AI SDK protocol
  - pkg/api/chat.go: HTTP endpoint for chat streaming
  - chartsmith-app/hooks/useAIChat.ts: Frontend hook wrapper
  - chartsmith-app/app/api/chat/route.ts: Next.js API route

  ### Note on Centrifugo
  Centrifugo is still used for non-chat events (plans, renders, artifacts).
  Chat messages flow exclusively through the AI SDK HTTP SSE protocol.
  ```
- [ ] Update "Workers" section if needed
- [ ] Add flow diagram if helpful
- [ ] Link to AI SDK documentation

#### Verify Updates
- [ ] Section is clear and accurate
- [ ] No outdated information
- [ ] Links work

**Checkpoint:** Root architecture doc updated ✓

**Commit:** `docs(backend): update ARCHITECTURE.md for AI SDK`

---

## Phase 3: Root Documentation (30-60 minutes)

### 3.1: Update README.md (15 minutes)

#### Review README.md
- [ ] Read `README.md`
- [ ] Identify if AI SDK should be mentioned
- [ ] Check if architecture section exists

#### Update if Relevant
- [ ] Add brief mention of AI SDK if relevant
- [ ] Link to architecture docs
- [ ] Update technology list if needed
- [ ] Keep changes minimal (README should be high-level)

#### Verify Updates
- [ ] Changes are appropriate for README
- [ ] Links work
- [ ] No unnecessary detail

**Checkpoint:** README.md updated ✓

**Commit:** `docs: update README.md for AI SDK`

---

### 3.2: Update CONTRIBUTING.md (15-30 minutes)

#### Review CONTRIBUTING.md
- [ ] Read `CONTRIBUTING.md`
- [ ] Identify if development patterns changed
- [ ] Check if chat development section exists

#### Update if Patterns Changed
- [ ] Add section on AI SDK development if needed
- [ ] Document how to work with useChat hook
- [ ] Document how to test chat functionality
- [ ] Update any outdated patterns

#### Verify Updates
- [ ] Patterns are accurate
- [ ] Instructions are clear
- [ ] No outdated information

**Checkpoint:** CONTRIBUTING.md updated ✓

**Commit:** `docs: update CONTRIBUTING.md for AI SDK patterns`

---

## Phase 4: Review & Polish (30 minutes)

### 4.1: Documentation Review Checklist

#### Check All Files Updated
- [ ] Frontend files documented
- [ ] Backend files documented
- [ ] Architecture docs updated
- [ ] Root docs updated

#### Check Quality
- [ ] No references to feature flags
- [ ] No references to Centrifugo chat (only non-chat events)
- [ ] No outdated comments
- [ ] Code examples compile
- [ ] Links work
- [ ] Documentation is clear and helpful

#### Check Consistency
- [ ] Terminology consistent across docs
- [ ] Formatting consistent
- [ ] Style consistent

**Checkpoint:** Documentation review complete ✓

**Commit:** `docs: review and polish documentation updates`

---

### 4.2: Final Verification

#### Test Documentation Build
- [ ] Markdown files render correctly
- [ ] Code blocks have correct syntax highlighting
- [ ] Diagrams render (if any)
- [ ] Internal links work
- [ ] External links are valid

#### Test Code Examples
- [ ] TypeScript examples compile
- [ ] Go examples compile
- [ ] Examples are accurate

#### Final Review
- [ ] Read through all updated files
- [ ] Verify accuracy
- [ ] Check for typos
- [ ] Ensure helpfulness

**Checkpoint:** Final verification complete ✓

**Commit:** `docs: final verification of documentation updates`

---

## Testing Phase (30 minutes)

### Documentation Review Tests

#### JSDoc Tests
- [ ] Run TypeScript compiler to verify JSDoc syntax
  ```bash
  cd chartsmith-app
  npm run type-check
  ```
- [ ] Verify JSDoc renders in IDE
- [ ] Verify examples are accurate

#### Go Doc Tests
- [ ] Run `go doc` to verify documentation
  ```bash
  cd pkg/llm
  go doc
  ```
- [ ] Verify all exported functions documented
- [ ] Verify examples are accurate

#### Markdown Tests
- [ ] Verify markdown renders correctly
- [ ] Verify code blocks have correct syntax
- [ ] Verify links work

### Code Review Checklist

- [ ] All public APIs have comprehensive documentation
- [ ] Complex logic has explanatory comments
- [ ] "Why" comments exist for non-obvious decisions
- [ ] Comments are up-to-date with code
- [ ] No outdated comments referencing removed features

---

## Completion Checklist

- [ ] All phases complete
- [ ] All documentation updated
- [ ] All comments updated
- [ ] Architecture docs accurate
- [ ] Code examples compile
- [ ] Links work
- [ ] No references to removed features
- [ ] Documentation is clear and helpful
- [ ] All commits made
- [ ] Ready for review

---

## Commit Strategy

### Commit Messages

Use these commit message formats:

```
docs(frontend): add comprehensive JSDoc to useAIChat hook
docs(frontend): add JSDoc to /api/chat route
docs(frontend): update component comments for AI SDK
docs(frontend): add AI SDK section to ARCHITECTURE.md
docs(backend): add Go doc comments to aisdk.go
docs(backend): add Go doc comments to chat endpoint
docs(backend): update conversational.go comments for AI SDK
docs(backend): update ARCHITECTURE.md for AI SDK
docs: update README.md for AI SDK
docs: update CONTRIBUTING.md for AI SDK patterns
docs: review and polish documentation updates
docs: final verification of documentation updates
```

### Commit Frequency

- Commit after each major section (useAIChat, /api/chat, components, etc.)
- Don't wait until end to commit
- Each commit should be reviewable independently

---

## Common Issues & Solutions

### Issue 1: JSDoc Not Rendering in IDE
**Symptoms:** JSDoc comments don't show up in IDE tooltips  
**Cause:** Missing `@param` or incorrect syntax  
**Solution:** Check JSDoc syntax, ensure all parameters documented

### Issue 2: Go Doc Not Showing
**Symptoms:** `go doc` doesn't show comments  
**Cause:** Comments not directly above function  
**Solution:** Ensure comments are directly above function, no blank lines

### Issue 3: Links Broken
**Symptoms:** External links don't work  
**Cause:** URLs changed or incorrect  
**Solution:** Test all links, update if needed

### Issue 4: Code Examples Don't Compile
**Symptoms:** TypeScript/Go examples have errors  
**Cause:** Examples outdated or incorrect  
**Solution:** Test examples, update to match current code

---

## Success Metrics

**Documentation is complete when:**
- ✅ All new AI SDK code has JSDoc/Go doc comments
- ✅ Architecture docs reflect AI SDK usage
- ✅ Component comments updated to reflect `useChat` usage
- ✅ No references to removed features
- ✅ Code examples compile and work
- ✅ Links are valid
- ✅ Documentation is clear and helpful

---

## Next Steps After Completion

1. **Create PR** - Open pull request for review
2. **Get Review** - Have team review documentation
3. **Merge** - Merge after approval
4. **Proceed to PR#14** - Remove Centrifugo Chat Handlers

---

**Remember:** Good documentation is code for humans. Make it clear, helpful, and accurate! 📚

