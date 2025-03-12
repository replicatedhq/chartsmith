# Chartsmith App Development Guide

## Commands
- Build/start: `npm run dev` - Starts Next.js development server
- Lint: `npm run lint` - Run ESLint
- Typecheck: `npm run typecheck` - Check TypeScript types
- Test: `npm test` - Run Jest tests
- Single test: `npm test -- -t "test name"` - Run a specific test

## Code Style
- **Imports**: Group imports by type (React, components, utils, types)
- **Components**: Use functional components with React hooks
- **TypeScript**: Use explicit typing, avoid `any`
- **State Management**: Use Jotai for global state
- **Naming**: PascalCase for components, camelCase for variables/functions
- **Styling**: Use Tailwind CSS with descriptive class names
- **Error Handling**: Use try/catch blocks with consistent error logging
- **File Organization**: Group related components in folders
- **Editor**: Monaco editor instances should be carefully managed to prevent memory leaks

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

## Workers
- The go code is where we put all workers. 
- Jobs for workers are enqueued and scheduled using postgres notify and a work_queue table.
- Status from the workers is communicated via Centrifugo messages to the client.