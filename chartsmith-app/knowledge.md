# Hydration

- Use suppressHydrationWarning on elements where hydration mismatches are expected and harmless (e.g. testing attributes, timestamps)
- For dynamic content that differs between server and client, use useEffect to update the content after initial render
- Avoid using browser-only APIs in the initial render (window, document, etc)
- For dynamic content that differs between server and client, use useEffect to update the content after initial render
- Avoid using browser-only APIs in the initial render (window, document, etc)

# State Management

- Prefer using centralized state from contexts over local component state when data is shared
- Files and workspace data come from Centrifugo real-time updates - don't maintain duplicate state
- Explorer follows new files automatically:
  - Selects most recently added or modified file
  - Tracks both workspace files and chart files
  - Updates selection on both new files and content changes
- Files have composite identity (id, revision_number) - maintain consistent IDs across revisions
- Use filePath property name to match backend naming convention
- Files are represented by WorkspaceFile interface, not DOM File type
- Always handle potentially undefined file paths from Centrifugo updates with default values
- Filter out invalid files (missing paths) from Centrifugo updates before processing
- When auto-selecting files, filter for valid files first to prevent runtime errors

# React Patterns

- Never update state of a component during render of another component
- Move state updates that depend on prop/state changes into useEffect
- Use stable IDs as React keys when available to preserve component state during updates
- Always import UI components from @/components/ui/* to ensure consistent styling and behavior

# Theme

# Layout

- Use min-w-[size] instead of w-[size] for fixed-width sections in flex layouts to prevent overflow
- Keep flex-1 on growing sections between fixed-width elements
- For nav bars with 3 sections (left, center, right), use min-width on outer sections to prevent squishing  - File explorer auto-expansion:
    - Automatically expand parent folders when new files are added
    - Expand new chart nodes and their file paths automatically
    - Preserve user's manual expand/collapse state for existing folders
    
  - For file explorer items with hover actions:
  - Use truncate on text elements to prevent wrapping
  - Add min-w-0 to parent flex container to enable truncation
  - Make action buttons flex-shrink-0 to maintain size
  - Keep hover actions outside of text container
  - For table rows with hover actions:
    - Keep action buttons always visible unless explicitly required to be hidden
    - Add cursor-pointer to action buttons
    - Use consistent padding and icon sizes
    - Maintain hover states for background and text color

  - For collapsible content:
    - Auto-collapse content when it becomes less relevant (e.g. superseded plans)
    - Use line-clamp-2 for collapsed preview
    - Position expand/collapse buttons in top-right
    - Maintain collapsed state until user explicitly expands

  - Plan workflow states:
    - planning: Initial state, no actions shown
    - pending: Intermediate state, no actions shown
    - review: Show approve/reject actions and chat input
    - ignored: Collapsed view, no actions shown
  - For file explorer panels:
    - Use fixed width w-[280px] consistently across nested containers
    - Use flex-shrink-0 to prevent resizing
    - Wrap tree in fixed-width container to maintain consistent width
    - Add min-w-0 to content area to enable truncation
  - For table rows with hover actions:
    - Keep action buttons always visible unless explicitly required to be hidden
    - Add cursor-pointer to action buttons
    - Use consistent padding and icon sizes
    - Maintain hover states for background and text color
- For full-height scrollable containers:
  - Use h-[calc(100vh-3.5rem)] for containers below nav bar (3.5rem is nav height)
  - Use h-full with overflow-auto on parent and py-8 on child for padding
  - Add min-h-0 to prevent flex children from expanding beyond parent
  - For mobile viewport height:
    - Set CSS variable --vh using window.innerHeight * 0.01
    - Update on window resize
    - Use calc(var(--vh, 1vh) * 100) for full height
- For layout transitions between states, add transition-all duration-300 ease-in-out to parent containers
- For transitions between centered and side-aligned layouts:
  - Use absolute positioning with inset-0 for centered state
  - Use left-0 top-0 bottom-0 for side-aligned state
  - Add padding to centered container, not wrapper
  - Avoid nested flex containers during transition
  - Keep max-width and padding only in centered state
  - Use exact width (e.g. w-[400px]) without padding in side-aligned state
  - Use same container structure in both states to ensure smooth transitions
  - Maintain consistent chat container wrapper with absolute positioning
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
- workspace_file table uses composite primary key (id, revision_number) - maintain same id across revisions

# Theme colors:

Light theme:
- Background: #ffffff (bg-light)
- Surface: #f1f5f9 (bg-light-surface)
- Border: #e2e8f0 (border-light-border)
- Text: #0f172a (text-slate-900)

Button styling:
- Primary buttons: bg-primary with text-white for contrast
- Secondary/outline buttons: Use theme-aware hover states

Message styling:
- Regular chat messages: bg-dark-border/40 (dark) or bg-gray-100 (light)
- User messages: bg-primary/20 (dark) or bg-primary/10 (light) with rounded-tr-sm
- Plan messages: bg-dark-border/40 (dark) or bg-gray-100 (light) with rounded-tl-sm and "Proposed Plan" label

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
- For useEffect dependencies:
  - Include all variables used inside the effect
  - For resize event listeners, empty array is acceptable since they don't depend on props/state
  - For real-time connections, include connection parameters (workspaceId, etc.)

# Development

- Do not run npm run dev - custom dev setup in place
- Tailwind plugins used in the application (like @tailwindcss/typography) should be regular dependencies, not devDependencies
- PostCSS plugins (like autoprefixer) should be regular dependencies since they're used in production builds
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
- When updating state from real-time events:
  - Update local state immediately for optimistic UI
  - Handle errors and revert state if needed
  - Use functional updates to ensure latest state
- For modals:
  - Handle both Escape key and click outside to close
  - Add event listeners only when modal is open
  - Clean up listeners on close
  - Use ref to detect clicks outside modal content
- When switching between source/rendered views:
  - Clear selected file and editor content when switching to rendered
  - Conditionally render editor only in source view
  - Maintain file tree visibility state independent of view
- For async operations on messages:
  - Show centered spinner with animate-spin and border-t-transparent when isApplying
  - Disable actions during applying state
  - Maintain consistent layout space during state changes
- Backend sends snake_case (is_complete), normalize to camelCase (isComplete) before updating state
- When using real-time APIs, define separate types for raw server messages vs normalized frontend types
- For streaming message updates, exclude messages state from effect deps to avoid feedback loops
- When updating state from real-time events, use functional updates to preserve existing state
- When handling real-time updates:
  - Capture previous state before updates when needed for transition checks
  - Check state transitions to trigger side effects (e.g. refresh data)
  - Append unknown messages rather than ignoring them
- When updating state from real-time events:
  - Update local state immediately for optimistic UI
  - Handle errors and revert state if needed
  - Use functional updates to ensure latest state
- When handling real-time updates, append unknown messages rather than ignoring them
- Check for undefined rather than falsy values when conditionally rendering responses
- For streaming responses, validate isComplete as boolean type rather than checking for undefined
- For streaming UI transitions, check isComplete on last message before showing next step
- When normalizing Centrifugo messages:
  - Check both top-level message.data and nested message fields for state flags
  - Use strict boolean comparison (=== true) for all flags
  - Normalize snake_case (is_applying) to camelCase (isApplying)
- For streaming responses, validate isComplete as boolean type rather than checking for undefined
- Backend sends snake_case (is_complete), normalize to camelCase (isComplete) before updating state
- For auto-scrolling chat:
  - Add empty div with ref at end of messages
  - Use closest('.overflow-auto') to find scrollable container
  - Set scrollTop directly on container rather than using scrollIntoView
  - Watch all content changes that could affect scroll height
  - Create separate client component for scroll behavior to avoid React static flag errors
  - Use React.memo to optimize re-renders of scrolling container
  - Stop auto-scrolling when user scrolls up (>50px from bottom)
  - Resume auto-scrolling when user scrolls back to bottom
- For streaming UI transitions, check isComplete on last message before showing next step
- For auto-scrolling chat, add empty div with ref at end of messages and scroll on message updates
- For streaming UI transitions, check isComplete on last message before showing next step
- Server-side render layout components when possible to avoid loading states
- Server-side fetch data in layout.tsx for initial render, then use client-side actions for updates
- Move client-side state and effects into dedicated client components
- When using params in page.tsx, type it as Promise<{ id: string }> for dynamic routes
- When using cookies() in server components, must await before accessing values
- Server-side render layout components when possible to avoid loading states
- Server-side fetch data in layout.tsx for initial render, then use client-side actions for updates
- Move client-side state and effects into dedicated client components
- Server-side fetch data in layout.tsx for initial render, then use client-side actions for updates
- Move client-side state and effects into dedicated client components

Next.js 15:
- Dynamic APIs like params, searchParams, cookies(), headers() must be awaited in server components
- 'use client' directive must be the first line in the file with no preceding whitespace
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
