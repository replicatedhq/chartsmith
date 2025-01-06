# State Management

- Prefer using centralized state from contexts over local component state when data is shared
- Files and workspace data come from Centrifugo real-time updates - don't maintain duplicate state
- Explorer follows new files automatically - selects most recently added file
- File tree visibility is tied to workspace.currentRevisionNumber > 0 or incompleteRevisionNumber
- When handling real-time updates, append unknown messages rather than ignoring them
- Check for undefined rather than falsy values when conditionally rendering responses
- For streaming responses, validate isComplete as boolean type rather than checking for undefined
- For streaming UI transitions, check isComplete on last message before showing next step
- Backend sends snake_case (is_complete), normalize to camelCase (isComplete) before updating state
- When using real-time APIs, define separate types for raw server messages vs normalized frontend types

# Theme

- Theme can be 'light', 'dark', or 'auto'
- Use resolvedTheme from ThemeContext when component needs actual 'light'/'dark' value
- System theme detection uses matchMedia('(prefers-color-scheme: dark)')
- Server-side theme detection uses Sec-CH-Prefers-Color-Scheme header
- Components that expect only 'light'/'dark' (like editors, UI components) must use resolvedTheme
- For client components using theme, add "use client" directive and useTheme hook

# Layout

- Use min-w-[size] instead of w-[size] for fixed-width sections in flex layouts to prevent overflow
- Keep flex-1 on growing sections between fixed-width elements
- For nav bars with 3 sections (left, center, right), use min-width on outer sections to prevent squishing
- For full-height scrollable containers, use h-full with overflow-auto on parent and py-8 on child for padding
- For modals:
  - Handle click outside with e.target === e.currentTarget check
  - Add ESC key listener when modal opens, remove on close
  - Use stopPropagation on modal content to prevent click-outside from triggering
