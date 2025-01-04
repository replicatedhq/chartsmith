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
