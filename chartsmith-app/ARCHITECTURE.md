# Architecture and Design for Chartsmith-app

This is a next.js project that is the front end for chartsmith.

## Monaco Editor Implementation
- Avoid recreating editor instances
- Use a single editor instance with model swapping for better performance
- Properly clean up models to prevent memory leaks
- We want to make sure that we don't show a "Loading..." state because it causes a lot of UI flashes.

## State management
- Do not pass onChange and other callbacks through to child components
- We use jotai for state, each component should be able to get or set the state it needs
- Each component subscribes to the relevant atoms. This is preferred over callbacks.

## SSR
- We use server side rendering to avoid the "loading" state whenever possible. 
- Move code that requires "use client" into separate controls.

## Database and functions
- We prefer server actions over API routes for frontend-to-backend communication.
- Front end should call server actions, which call lib/* functions.
- Database queries are not allowed in the server action. Server actions are just wrappers for which lib functions we expose.
- API routes are used for: LLM operations (called by Go worker), real-time endpoints, and external integrations.

## LLM API Routes
The `/api/llm/*` and `/api/chat` routes are called by the Go worker, not the frontend directly.
- `/api/chat` - Conversational chat with streaming
- `/api/llm/plan` - Generate implementation plans
- `/api/llm/execute-action` - Tool calling for file operations
- `/api/llm/expand` - Expand short prompts
- `/api/llm/summarize` - Summarize content
- `/api/llm/cleanup-values` - Clean up Helm values YAML
- `/api/models` - List available models (can be called by frontend)

All routes use `INTERNAL_API_KEY` header for authentication from the Go worker.
