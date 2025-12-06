# Architecture and Design for Chartsmith-app

This is a next.js project that is the front end for chartsmith.

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
- We generally avoid Next.JS API routes, prioritizing server actions.
- EXCEPTION: `app/api/chat/route.ts` is used for the AI chat stream.
- Front end should call server actions, which call lib/* functions.
- Database queries are not allowed in the server action. Server actions are just wrappers for which lib functions we expose.

## AI SDK Integration
- We use Vercel AI SDK Core (`streamText`, `tool`) in `app/api/chat/route.ts` for LLM interaction.
- We use OpenAI (`@ai-sdk/openai`) as our LLM provider (model: `gpt-4o`).
- We use Vercel AI SDK React (`useChat`) in `components/ChatContainer.tsx` for the chat UI.
- Tools (like `create_plan`, `latest_subchart_version`) are defined in the API route and executed server-side using `inputSchema` (Zod validation).
- Streaming is handled via the AI SDK standard protocol.
