# Vercel AI SDK Migration - PR-by-PR Implementation Plan

## Overview
This plan outlines the step-by-step migration of Chartsmith to Vercel AI SDK while maintaining the existing Go worker backend architecture. The approach is designed to be incremental, reviewable, and non-breaking.

## Architecture Strategy
- ✅ **Keep:** Go worker for backend processing (plan execution, conversions, tool calling)
- ✅ **Keep:** Centrifugo for real-time WebSocket notifications
- ✅ **Keep:** PostgreSQL database schema
- ✅ **Keep:** Existing workspace management and file operations
- ➕ **Add:** Vercel AI SDK for chat streaming (alongside existing implementation)
- ➕ **Add:** Provider/model selection UI (Anthropic + OpenRouter)
- ➕ **Add:** New Next.js API routes using Vercel AI SDK

---

## PR #1: Dependencies & Configuration Setup
**Alignment:** Technical Requirements - AI SDK Setup

### Objective
Install and configure Vercel AI SDK packages with provider support (Anthropic + OpenRouter).

### Changes
1. **Update `chartsmith-app/package.json`**
   - ✅ Add `ai@latest` (Vercel AI SDK)
   - ✅ Add `@ai-sdk/anthropic@latest`
   - ✅ Add `@ai-sdk/openai@latest` (for OpenRouter support)
   - ✅ Update `next` to latest 15.x
   - ✅ Update `react` and `react-dom` to latest 19.x
   - ✅ Update `@anthropic-ai/sdk` to latest

2. **Add Environment Variables**
   - Add to `.env.local.example`:
     ```
     # AI Provider Configuration
     ANTHROPIC_API_KEY=your_anthropic_key
     OPENROUTER_API_KEY=your_openrouter_key
     NEXT_PUBLIC_DEFAULT_AI_PROVIDER=anthropic
     NEXT_PUBLIC_DEFAULT_AI_MODEL=claude-3-5-sonnet-20241022
     ```

3. **Update `next.config.ts`**
   - Ensure compatibility with AI SDK streaming

### Testing
- ✅ `npm install` runs successfully
- ✅ No breaking changes to existing functionality
- ✅ `npm run dev` starts without errors

### Requirements Met
- ✅ Technical Requirements: Setup Vercel AI SDK
- ✅ Maintain existing functionality

---

## PR #2: Provider & Model Selection UI Components
**Alignment:** Nice to Have - Demonstrate easy provider switching

### Objective
Create UI components for selecting AI provider (Anthropic/OpenRouter) and model.

### Changes
1. **Create `chartsmith-app/components/ProviderSelector.tsx`**
   ```typescript
   // Dropdown for selecting provider (Anthropic, OpenRouter)
   // Stores selection in Jotai atom
   ```

2. **Create `chartsmith-app/components/ModelSelector.tsx`**
   ```typescript
   // Dropdown for selecting model based on provider
   // Anthropic: claude-3-7-sonnet, claude-3-5-sonnet, claude-3-opus
   // OpenRouter: gpt-4, claude-3.5, etc.
   ```

3. **Create `chartsmith-app/atoms/ai-provider.ts`**
   ```typescript
   export const aiProviderAtom = atom<'anthropic' | 'openrouter'>('anthropic');
   export const aiModelAtom = atom<string>('claude-3-5-sonnet-20241022');
   ```

4. **Update `chartsmith-app/components/ChatContainer.tsx`**
   - Add provider/model selector dropdowns below chat input
   - Position them next to each other as specified
   - Integrate with Jotai atoms for state management

5. **Create `chartsmith-app/lib/ai/models.ts`**
   ```typescript
   // Model configurations for each provider
   export const ANTHROPIC_MODELS = [...];
   export const OPENROUTER_MODELS = [...];
   ```

### Testing
- ✅ Dropdowns render correctly
- ✅ Provider selection updates model options
- ✅ State persists across chat interactions
- ✅ UI is responsive and accessible

### Requirements Met
- ✅ Nice to Have: Demonstrate easy provider switching
- ✅ User can choose between providers and models from dropdowns

---

## PR #3: Vercel AI SDK API Route for Chat Streaming
**Alignment:** Must Have - Replace custom chat UI with Vercel AI SDK

### Objective
Create a new Next.js API route using Vercel AI SDK for streaming chat responses.

### Changes
1. **Create `chartsmith-app/app/api/ai-chat/route.ts`**
   ```typescript
   import { anthropic } from '@ai-sdk/anthropic';
   import { createOpenAI } from '@ai-sdk/openai';
   import { streamText } from 'ai';
   
   // Initialize OpenRouter client
   const openrouter = createOpenAI({
     baseURL: 'https://openrouter.ai/api/v1',
     apiKey: process.env.OPENROUTER_API_KEY,
   });
   
   export async function POST(req: Request) {
     // Extract provider, model, messages from request
     // Get workspace context from database
     // Build system prompt (reuse existing logic)
     // Stream response using Vercel AI SDK
   }
   ```

2. **Create `chartsmith-app/lib/ai/provider-factory.ts`**
   ```typescript
   // Factory for creating provider instances
   export function getProvider(provider: string, model: string) {
     if (provider === 'anthropic') {
       return anthropic(model);
     } else if (provider === 'openrouter') {
       return openrouter(model);
     }
   }
   ```

3. **Create `chartsmith-app/lib/ai/system-prompt.ts`**
   ```typescript
   // Extract system prompt building logic from Go worker
   // Reuse existing persona logic (developer/operator)
   // Include chart context, file context, etc.
   ```

### Key Design Decisions
- **Coexistence:** New `/api/ai-chat` route runs alongside existing Go worker
- **Context Building:** Reuse existing database queries for workspace/file context
- **System Prompts:** Port system prompt logic from Go to TypeScript
- **Streaming:** Use Vercel AI SDK's native streaming (no Centrifugo for this route)

### Testing
- ✅ API route handles POST requests
- ✅ Streaming works with both Anthropic and OpenRouter
- ✅ System prompts include correct context
- ✅ Errors are handled gracefully

### Requirements Met
- ✅ Must Have: Migrate from direct @anthropic-ai/sdk to AI SDK Core
- ✅ Must Have: Maintain streaming functionality
- ✅ Must Have: Keep existing system prompts and behavior

---

## PR #4: Frontend Chat UI Migration to useChat Hook
**Alignment:** Must Have - Replace custom chat UI with Vercel AI SDK

### Objective
Migrate `ChatContainer.tsx` to use Vercel AI SDK's `useChat()` hook for conversational chat.

### Changes
1. **Update `chartsmith-app/components/ChatContainer.tsx`**
   ```typescript
   import { useChat } from 'ai/react';
   
   export function ChatContainer({ session }: ChatContainerProps) {
     const [aiProvider] = useAtom(aiProviderAtom);
     const [aiModel] = useAtom(aiModelAtom);
     
     const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
       api: '/api/ai-chat',
       body: {
         workspaceId: workspace?.id,
         provider: aiProvider,
         model: aiModel,
         sessionId: session.id,
       },
     });
     
     // Integrate with existing UI components
   }
   ```

2. **Update `chartsmith-app/components/ChatMessage.tsx`**
   - Ensure compatibility with Vercel AI SDK message format
   - Map SDK message types to existing UI components

3. **Update `chartsmith-app/components/PromptInput.tsx`**
   - Use `input` and `handleInputChange` from `useChat()`
   - Maintain existing role selector functionality

4. **Hybrid Approach for Complex Operations**
   ```typescript
   // Use Vercel AI SDK for: Conversational chat
   // Keep Go worker for: Plan generation, conversions, renders
   
   if (isConversationalChat) {
     // Use useChat() hook -> /api/ai-chat
   } else if (isPlanRequest) {
     // Use existing createChatMessageAction() -> Go worker
   }
   ```

### Testing
- ✅ Chat input and submission work
- ✅ Streaming messages display correctly
- ✅ Message history persists
- ✅ Provider/model switching works mid-conversation
- ✅ Complex operations (plans, conversions) still use Go worker

### Requirements Met
- ✅ Must Have: Replace custom chat UI with Vercel AI SDK
- ✅ Must Have: Maintain all existing chat functionality
- ✅ Must Have: Keep existing system prompts and behavior

---

## PR #5: Integration with Existing Architecture
**Alignment:** Must Have - All existing features continue to work

### Objective
Ensure seamless integration between Vercel AI SDK chat and existing Go worker features.

### Changes
1. **Update `chartsmith-app/lib/workspace/workspace.ts`**
   - Add function to determine chat intent (conversational vs. plan)
   - Route to appropriate handler (AI SDK or Go worker)

2. **Create `chartsmith-app/lib/ai/intent-classifier.ts`**
   ```typescript
   // Classify user intent using Vercel AI SDK
   // Determine if message requires:
   // - Conversational response (AI SDK)
   // - Plan generation (Go worker)
   // - Chart conversion (Go worker)
   // - Render operation (Go worker)
   ```

3. **Update `chartsmith-app/app/api/ai-chat/route.ts`**
   - Add tool calling support for:
     - `latest_subchart_version`
     - `latest_kubernetes_version`
   - Match existing Go worker tools

4. **Database Integration**
   - Save AI SDK chat messages to `workspace_chat` table
   - Maintain compatibility with existing schema
   - Preserve chat history and revision tracking

5. **Update `chartsmith-app/contexts/WorkspaceContext.tsx`**
   - Handle both AI SDK messages and Go worker messages
   - Unified message list management

### Testing
- ✅ Intent classification works correctly
- ✅ Conversational messages use AI SDK
- ✅ Plan/conversion requests use Go worker
- ✅ Tool calling functions properly
- ✅ Messages saved to database correctly
- ✅ Chat history displays all message types

### Requirements Met
- ✅ Must Have: All existing features continue to work
- ✅ Must Have: Tool calling, file context work correctly
- ✅ Must Have: Maintain message history

---

## PR #6: Tool Calling & Advanced Features
**Alignment:** Must Have - Tool calling, file context, etc.

### Objective
Implement tool calling in Vercel AI SDK to match Go worker capabilities.

### Changes
1. **Update `chartsmith-app/app/api/ai-chat/route.ts`**
   ```typescript
   import { streamText, tool } from 'ai';
   import { z } from 'zod';
   
   const result = await streamText({
     model: getProvider(provider, model),
     messages,
     tools: {
       latest_subchart_version: tool({
         description: 'Get latest version of a subchart',
         parameters: z.object({
           chart_name: z.string(),
         }),
         execute: async ({ chart_name }) => {
           // Call existing ArtifactHub API
         },
       }),
       latest_kubernetes_version: tool({
         description: 'Get latest Kubernetes version',
         parameters: z.object({
           semver_field: z.enum(['major', 'minor', 'patch']),
         }),
         execute: async ({ semver_field }) => {
           // Return K8s version
         },
       }),
     },
   });
   ```

2. **Create `chartsmith-app/lib/ai/tools.ts`**
   - Define all tool functions
   - Reuse existing ArtifactHub integration
   - Match Go worker tool signatures

3. **File Context Integration**
   - Add relevant files to system prompt
   - Reuse existing `ChooseRelevantFilesForChatMessage` logic
   - Include chart structure in context

### Testing
- ✅ Tool calls execute correctly
- ✅ ArtifactHub lookups work
- ✅ File context included in prompts
- ✅ Tool responses integrated into chat

### Requirements Met
- ✅ Must Have: Tool calling works
- ✅ Must Have: File context included
- ✅ Match existing Go worker functionality

---

## PR #7: Testing & Validation
**Alignment:** Must Have - Tests pass or are updated

### Objective
Ensure all existing tests pass and add new tests for AI SDK integration.

### Changes
1. **Update Existing Tests**
   - Fix any tests broken by UI changes
   - Update snapshots for new provider/model selectors

2. **Add New Unit Tests**
   - `lib/ai/provider-factory.test.ts`
   - `lib/ai/intent-classifier.test.ts`
   - `components/ProviderSelector.test.tsx`
   - `components/ModelSelector.test.tsx`

3. **Add New E2E Tests**
   - Test conversational chat with Anthropic
   - Test conversational chat with OpenRouter
   - Test provider switching mid-conversation
   - Test plan generation still uses Go worker
   - Test tool calling in AI SDK chat

4. **Update Playwright Tests**
   - `tests/chat.spec.ts` - Update for new UI
   - Add tests for provider/model selection

### Testing
- ✅ `npm run test:unit` passes
- ✅ `npm run test:e2e` passes
- ✅ All existing features work
- ✅ New features tested

### Requirements Met
- ✅ Must Have: Tests pass or are updated
- ✅ Must Have: All existing features work

---

## PR #8: Documentation & Architecture Updates
**Alignment:** Submission Requirements - Update ARCHITECTURE.md

### Objective
Document the new AI SDK integration and migration approach.

### Changes
1. **Update `chartsmith-app/ARCHITECTURE.md`**
   ```markdown
   ## AI Integration Architecture
   
   ### Dual LLM System
   - **Vercel AI SDK (New):** Conversational chat, streaming responses
   - **Go Worker (Existing):** Plan generation, conversions, complex operations
   
   ### Provider Support
   - Anthropic (Claude models)
   - OpenRouter (Multi-model access)
   
   ### Message Flow
   [Diagram showing AI SDK vs Go worker routing]
   ```

2. **Update Root `ARCHITECTURE.md`**
   - Document coexistence of AI SDK and Go worker
   - Explain intent classification and routing

3. **Create `MIGRATION.md`**
   - Document migration decisions
   - Explain why hybrid approach was chosen
   - Future migration path (optional: full Go worker migration)

4. **Update `README.md`**
   - Add AI provider configuration instructions
   - Document new environment variables
   - Add provider/model selection usage

5. **Update `.env.local.example`**
   - Add all new environment variables
   - Document optional vs required keys

### Requirements Met
- ✅ Submission: Update ARCHITECTURE.md
- ✅ Document significant architectural choices
- ✅ Explain coexistence strategy

---

## PR #9: Performance Optimization & Polish
**Alignment:** Nice to Have - Improve streaming experience

### Objective
Optimize streaming performance and polish the user experience.

### Changes
1. **Streaming Optimizations**
   - Implement React 19 streaming optimizations
   - Add loading states during provider switches
   - Optimize token streaming rendering

2. **UI Polish**
   - Add smooth transitions for provider changes
   - Improve loading indicators
   - Add tooltips for provider/model options
   - Show token usage (if available from provider)

3. **Error Handling**
   - Graceful fallback if provider unavailable
   - Clear error messages for API key issues
   - Retry logic for transient failures

4. **State Management**
   - Persist provider/model selection to localStorage
   - Sync AI SDK state with Jotai atoms
   - Optimize re-renders

### Testing
- ✅ No unnecessary re-renders
- ✅ Smooth streaming experience
- ✅ Error handling works gracefully
- ✅ Provider switches are instant

### Requirements Met
- ✅ Nice to Have: Improve streaming experience
- ✅ Nice to Have: Simplify state management

---

## PR #10: Demo Video & Final Submission
**Alignment:** Submission Requirements - Demo Video

### Objective
Create demo video and prepare final submission.

### Changes
1. **Create Demo Video (Loom)**
   - Show application starting successfully
   - Demonstrate creating a new chart via chat
   - Show streaming responses working
   - Highlight provider switching (Anthropic → OpenRouter)
   - Show model switching within provider
   - Walk through 1-2 key code changes:
     - `useChat()` hook integration
     - Provider factory pattern
   - Demonstrate tool calling still works
   - Show existing features (plans, conversions) still work

2. **Prepare Pull Request**
   - Clean commit history
   - Comprehensive PR description
   - Before/after comparisons
   - Performance metrics (if applicable)

3. **Final Testing Checklist**
   - [ ] All tests pass
   - [ ] No console errors
   - [ ] Provider switching works
   - [ ] Streaming works with both providers
   - [ ] Complex operations use Go worker
   - [ ] Tool calling works
   - [ ] File context included correctly
   - [ ] Documentation complete

### Requirements Met
- ✅ Submission: Demo Video
- ✅ Submission: Pull Request ready
- ✅ All Must Have requirements met
- ✅ All Nice to Have requirements met

---

## Summary

### Requirements Coverage

#### Must Have ✅
1. ✅ Replace custom chat UI with Vercel AI SDK (PRs #3, #4)
2. ✅ Migrate from direct @anthropic-ai/sdk to AI SDK Core (PR #3)
3. ✅ Maintain all existing chat functionality (PRs #4, #5)
4. ✅ Keep existing system prompts and behavior (PRs #3, #5)
5. ✅ All existing features continue to work (PRs #5, #6, #7)
6. ✅ Tests pass or are updated (PR #7)

#### Nice to Have ✅
1. ✅ Demonstrate easy provider switching (PR #2)
2. ✅ Improve streaming experience (PRs #4, #9)
3. ✅ Simplify state management (PRs #2, #4, #9)

### Architecture Principles Maintained
- ✅ Go worker preserved for backend processing
- ✅ Centrifugo still used for real-time notifications
- ✅ PostgreSQL schema unchanged
- ✅ Next.js server actions pattern maintained
- ✅ Jotai for state management
- ✅ Minimal disruption to existing code

### Implementation Approach
- **Incremental:** Each PR is independently reviewable and testable
- **Non-breaking:** Existing functionality preserved at each step
- **Hybrid:** AI SDK for chat, Go worker for complex operations
- **Extensible:** Easy to add more providers in the future
- **Well-documented:** Architecture decisions explained

---

## Next Steps

1. **Review this plan** with the hiring partner
2. **Get approval** for the hybrid approach
3. **Start with PR #1** (Dependencies)
4. **Progress sequentially** through PRs
5. **Review and test** after each PR
6. **Create demo video** after PR #9
7. **Submit final PR** to `replicatedhq/chartsmith`

---

## Estimated Timeline

- PR #1: 1-2 hours (Dependencies)
- PR #2: 3-4 hours (UI Components)
- PR #3: 6-8 hours (API Route)
- PR #4: 6-8 hours (Frontend Migration)
- PR #5: 8-10 hours (Integration)
- PR #6: 6-8 hours (Tool Calling)
- PR #7: 6-8 hours (Testing)
- PR #8: 3-4 hours (Documentation)
- PR #9: 4-6 hours (Polish)
- PR #10: 2-3 hours (Demo & Submission)

**Total Estimated Time:** 45-61 hours

---

## Questions for Review

1. ✅ Is the hybrid approach (AI SDK + Go worker) acceptable?
2. ✅ Should we prioritize full Go worker migration in a future phase?
3. ✅ Are there specific OpenRouter models to support?
4. ✅ Should provider/model selection be per-workspace or global?
5. ✅ Any specific performance metrics to target?

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-30  
**Author:** AI Assistant  
**Status:** Ready for Review

