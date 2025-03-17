# Contributing to chartsmith-app

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
