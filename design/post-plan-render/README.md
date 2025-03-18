When a plan is executed, ChartSmith should optimistically render the changes before the user decides to accept or reject them

When we finish creating a revision, there are pending patches we show the user. 
We should kick off a background render where we've created a "shadow" copy of the application with all patches accepted.
If there are errors on this render, we should show the error with an "attempt fix" button.

When the user accepts the changes, there's nothing else for us to do.
If the user rejects some/any of the changes, we need to re-render. Once a single change is rejected, we should not re-render until there are no more pending changes.

When rendering automatically with pending patches, we add an "is_autorender" set to true in the workspace_render table.
These are filtered out by default from the front end. 
This allows the happy-path of iterate -> accept to work without cluttering the UI up with render.
But when it fails, the UI will show it with an Attempt Fix button.

