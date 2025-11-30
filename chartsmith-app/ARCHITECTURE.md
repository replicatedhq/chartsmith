# Architecture and Design for Chartsmith-app

This is a next.js project that is the front end for chartsmith.

## AI Integration Architecture

### Dual LLM System
Chartsmith now uses a hybrid approach for AI interactions:

- **Vercel AI SDK (New):** Handles conversational Q&A and simple interactions via `/api/ai-chat`
  - Uses `useChat()` hook for streaming responses
  - Supports multiple providers: Anthropic, OpenRouter
  - Provider/model selection via UI dropdowns
  - Lightweight, conversational interactions

- **Go Worker (Existing):** Handles complex operations
  - Plan generation and execution
  - K8s to Helm conversions
  - Chart rendering and validation
  - Complex tool calling and workspace operations

### Provider Support
- **Anthropic:** Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3 Opus, Claude 3.5 Haiku
- **OpenRouter:** GPT-4, Claude, Gemini, Llama, Mixtral, and others

### Message Routing
- Conversational questions → Vercel AI SDK (`/api/ai-chat`)
- Chart modifications/plans → Go Worker (existing path)
- Conversions → Go Worker (existing path)
- Renders → Go Worker (existing path)

### State Management
- Provider/model selection: `aiProviderAtom`, `aiModelAtom` (Jotai with localStorage)
- Chat state: Managed by Vercel AI SDK's `useChat()` hook
- Workspace state: Existing `workspaceAtom`, `messagesAtom`

## Monaco Editor Implementation
- Avoid recreating editor instances
- Use a single editor instance with model swapping for better performance
- Properly clean up models to prevent memory leaks
- We want to make sure that we don't show a "Loading..." state because it causes a lot of UI flashes.

## State managemnet
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

## AI API Route Exception
- `/api/ai-chat` is an exception to the "no API routes" rule
- This route is required for Vercel AI SDK streaming functionality
- It integrates with existing server actions and lib functions for workspace context
