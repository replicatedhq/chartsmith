# Hydration

- Use suppressHydrationWarning on elements where hydration mismatches are expected and harmless (e.g. testing attributes, timestamps)
- For dynamic content that differs between server and client, use useEffect to update the content after initial render
- Avoid using browser-only APIs in the initial render (window, document, etc)

# State Management

- Prefer using centralized state from contexts over local component state when data is shared
- Files and workspace data come from Centrifugo real-time updates - don't maintain duplicate state
- Explorer follows new files automatically - selects most recently added file

# React Patterns

- Never update state of a component during render of another component
- Move state updates that depend on prop/state changes into useEffect
- Use stable IDs as React keys when available to preserve component state during updates

# Theme

Theme colors:

Light theme:
- Background: #ffffff (bg-light)
- Surface: #f1f5f9 (bg-light-surface)
- Border: #e2e8f0 (border-light-border)
- Text: #0f172a (text-slate-900)

Dark theme:
- Background: #0f0f0f (bg-dark)
- Surface: #1a1a1a (bg-dark-surface)
- Border: #2f2f2f (border-dark-border)
- Text: #ffffff (text-white)

Usage:
- Use bg-dark for main page backgrounds
- Use bg-dark-surface for elevated surfaces like cards, inputs, dropdowns
- Use border-dark-border for borders and dividers
- Maintain strong contrast between layers in dark mode

Persistence:
- Theme preference is stored in 'theme' cookie
- Theme cookie is cleared on logout
- Default theme is dark

Hydration:
- Use suppressHydrationWarning on elements where hydration mismatches are expected and harmless (e.g. testing attributes, timestamps)
- For dynamic content that differs between server and client, use useEffect to update the content after initial render
- Avoid using browser-only APIs in the initial render (window, document, etc)

React Hooks:
- Call hooks at the top level of component
- Don't call hooks inside conditionals, loops, or nested functions
- Extract values from hooks before using in JSX conditionals

Development:
- Run lint/type checks before committing, not after every small change
- For small changes that are obviously correct, skip the checks
- Run full build before deploying or when making significant changes
- Hide dev indicators in next.config.ts with devIndicators: { buildActivity: false, buildActivityPosition: "bottom-right", appIsrStatus: false }

State Management:
- Prefer using centralized state from contexts over local component state when data is shared
- Files and workspace data come from Centrifugo real-time updates - don't maintain duplicate state
- Explorer follows new files automatically - selects most recently added file
- Server-side render layout components when possible to avoid loading states
- Server-side fetch data in layout.tsx for initial render, then use client-side actions for updates
- Move client-side state and effects into dedicated client components

Next.js 15:
- Dynamic APIs like params, searchParams, cookies(), headers() must be awaited in server components
- Use React.use() to unwrap these promises in client components
- Prefer awaiting as late as possible to allow more static rendering
- Must await params in both layout.tsx and page.tsx when using dynamic routes
- After awaiting params, pass the extracted values to child components rather than passing params directly
- When using params in page.tsx, type it as Promise<{ id: string }> for dynamic routes
- When using cookies() in server components, must await before accessing values
- Server-side render layout components when possible to avoid loading states
- Server-side fetch data in layout.tsx for initial render, then use client-side actions for updates
- Move client-side state and effects into dedicated client components

Next.js 15:
- Dynamic APIs like params, searchParams, cookies(), headers() must be awaited in server components
- Use React.use() to unwrap these promises in client components
- Prefer awaiting as late as possible to allow more static rendering
- Must await params in both layout.tsx and page.tsx when using dynamic routes
- After awaiting params, pass the extracted values to child components rather than passing params directly
