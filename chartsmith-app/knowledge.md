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

# Layout

- Use min-w-[size] instead of w-[size] for fixed-width sections in flex layouts to prevent overflow
- Keep flex-1 on growing sections between fixed-width elements
- For nav bars with 3 sections (left, center, right), use min-width on outer sections to prevent squishing
- For full-height scrollable containers, use h-full with overflow-auto on parent and py-8 on child for padding
- For elements that appear/disappear on hover:
  - Always reserve space for the element with fixed width/height
  - Use opacity for show/hide instead of conditional rendering
  - Use flex layout with fixed dimensions to prevent layout shifts
- For modal dialogs:
  - Use fixed positioning with inset-0 to cover entire viewport
  - Set z-index high enough to appear above all other UI (z-[9999])
  - Add explicit position styles to override any parent positioning context
  - Center content with flex layout
  - Render at root level to avoid inheriting positioning context
- For layout transitions between states, add transition-all duration-300 ease-in-out to parent containers
- For modal dialogs:
  - Use fixed positioning with inset-0 to cover entire viewport
  - Set z-index high enough to appear above all other UI (z-[9999])
  - Add explicit position styles to override any parent positioning context
  - Center content with flex layout
- For smooth width transitions in flex layouts:
  - Use flex-shrink-0 instead of flex-none
  - Add transitions to both parent and child containers
  - Maintain consistent transition properties (duration and timing function)
  - For sequenced transitions, use longer duration (500ms) and transitionDelay on second element
  - For major layout transitions, consider mounting second element after delay rather than transitioning opacity
  - For sequenced transitions, use useState + useEffect with setTimeout instead of CSS transition-delay
  - For sequenced transitions, use transitionend event to trigger next animation instead of fixed delays
  - For major layout transitions, consider mounting second element after delay rather than transitioning opacity
  - When transitioning between layouts, update all related UI state (e.g. sidebar visibility) before starting transition
- Don't reset loading states when redirecting to a new page, only reset on error

# Database

- When scanning pgvector columns into Go slices, cast vector to float[] with `column::float[]`
- Vector similarity searches use `<=>` operator
- Vectors are stored in native pgvector format but must be cast when scanning to application
- For array parameters with pgx, use `&pgtype.Array[T]{Elements: slice, Valid: true}`

# Theme colors:

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
- Use opacity modifiers (e.g. border-dark-border/40) for subtle borders
- Add extra padding at page bottom (pb-16) for better mobile spacing

Persistence:
- Theme preference is stored in 'theme' cookie
- Theme cookie is cleared on logout
- Default theme is dark

Hydration:
- Use suppressHydrationWarning on elements where hydration mismatches are expected and harmless (e.g. testing attributes, timestamps)
- For dynamic content that differs between server and client, use useEffect to update the content after initial render
- Avoid using browser-only APIs in the initial render (window, document, etc)
- Prevent theme flash by setting both classList and color-scheme in inline script before React hydration
- Use :root[class='theme'] for better CSS specificity than :root.theme

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
- When handling real-time updates, append unknown messages rather than ignoring them
- Check for undefined rather than falsy values when conditionally rendering responses
- For streaming responses, validate isComplete as boolean type rather than checking for undefined
- For streaming UI transitions, check isComplete on last message before showing next step
- Backend sends snake_case (is_complete), normalize to camelCase (isComplete) before updating state
- When using real-time APIs, define separate types for raw server messages vs normalized frontend types
- For streaming message updates, exclude messages state from effect deps to avoid feedback loops
- When updating state from real-time events, use functional updates to preserve existing state
- When handling real-time updates, append unknown messages rather than ignoring them
- Check for undefined rather than falsy values when conditionally rendering responses
- For streaming responses, validate isComplete as boolean type rather than checking for undefined
- For streaming UI transitions, check isComplete on last message before showing next step
- When normalizing Centrifugo messages, get top-level fields like is_complete from message.data, not from nested objects
- For streaming responses, validate isComplete as boolean type rather than checking for undefined
- Backend sends snake_case (is_complete), normalize to camelCase (isComplete) before updating state
- For auto-scrolling chat, add empty div with ref at end of messages and scroll on message updates
- For streaming UI transitions, check isComplete on last message before showing next step
- For auto-scrolling chat, add empty div with ref at end of messages and scroll on message updates
- For streaming UI transitions, check isComplete on last message before showing next step
- Server-side render layout components when possible to avoid loading states
- Server-side fetch data in layout.tsx for initial render, then use client-side actions for updates
- Move client-side state and effects into dedicated client components

Next.js 15:
- Dynamic APIs like params, searchParams, cookies(), headers() must be awaited in server components
- Use React.use() to unwrap these promises in client components
- Prefer awaiting as late as possible to allow more static rendering
- Must await params in both layout.tsx and page.tsx when using dynamic routes
- After awaiting params, pass the extracted values to child components rather than passing params directly
- When using cookies() in server components, must await before accessing values
- Server-side render layout components when possible to avoid loading states
- Server-side fetch data in layout.tsx for initial render, then use client-side actions for updates
- Move client-side state and effects into dedicated client components
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
