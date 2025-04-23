# ChartSmith Change Log

## Backend Changes

### Fixed Nil Pointer Dereference in LLM Expansion

**File:** `pkg/llm/expand.go`

Added proper error handling in the `ExpandPrompt` function to prevent nil pointer dereference when calling the Anthropic API:

```go
resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
    Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
    MaxTokens: anthropic.F(int64(8192)),
    Messages:  anthropic.F([]anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage))}),
})
if err != nil {
    return "", fmt.Errorf("failed to call Anthropic API: %w", err)
}

// Check if response or response.Content is nil or empty
if resp == nil {
    return "", fmt.Errorf("received nil response from Anthropic API")
}

if len(resp.Content) == 0 {
    return "", fmt.Errorf("received empty content from Anthropic API")
}
```

This fixes the segmentation fault that was occurring when running a plan:
```
panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation code=0x2 addr=0x18 pc=0x103240ea4]
```

## VS Code Extension Changes

### Improved File Diff Handling

**File:** `chartsmith-extension/src/modules/render/index.ts`

Improved the file diff handling to ensure each file diff is treated independently. When multiple files have pending changes, the user can accept or reject changes for each file individually:

```typescript
// Register specific handlers for each diff view
let acceptDisposable = vscode.commands.registerCommand('chartsmith.acceptChanges', async () => {
  // Get the current active diff from the registry
  const diffInfo = global.chartsmithDiffRegistry?.get(activeDiffId);
  
  // Apply changes for this specific file only
  await lifecycle.acceptFileChanges(diffInfo.filePath, workspaceId, diffInfo.pendingContent);
  
  // Clean up just this diff and close this editor
  chartsmithContentMap.delete(diffInfo.oldUri.toString());
  chartsmithContentMap.delete(diffInfo.newUri.toString());
  global.chartsmithDiffRegistry?.delete(activeDiffId);
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
});
```

This approach fixes an issue where accepting changes for one file would either automatically apply changes to all files or cause the accept/reject buttons to disappear for remaining files. Each file diff is now handled individually, providing more control and stability when reviewing multiple file changes.

### Fixed Path Duplication in File Writing

**Files:**
- `chartsmith-extension/src/modules/fileContent/index.ts`
- `chartsmith-extension/src/modules/lifecycle/index.ts`

Fixed an issue where file paths were being duplicated in the path construction, resulting in paths like:
```
/path/to/chart/path/to/chart/filename.yaml
```

The fix improves path handling by:
1. Checking if the file path already contains the chart base path
2. Extracting the correct relative path from the full path
3. Using a simpler path construction approach to avoid duplication

```typescript
// Before (duplicating paths):
const cleanFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
const chartName = path.basename(chartBasePath);
const finalFilePath = cleanFilePath.startsWith(chartName + '/') ?
  cleanFilePath.substring(chartName.length + 1) : cleanFilePath;
const fullFilePath = path.join(chartBasePath, finalFilePath);

// After (preventing duplication):
let simplePath;
if (filePath.includes(chartBasePath)) {
  const pathParts = filePath.split(chartBasePath);
  simplePath = pathParts[pathParts.length - 1].replace(/^\//, '');
} else {
  simplePath = filePath.replace(/^\//, '');
}
const fullFilePath = path.join(chartBasePath, simplePath);
```

This ensures files are written to the correct location without path duplication.

### Fixed Filesystem Writing Implementation

**Files:**
- `chartsmith-extension/src/modules/fileContent/index.ts`
- `chartsmith-extension/src/modules/lifecycle/index.ts`

Fixed issues with filesystem writing implementation:

1. Simplified path construction in `writeContentToFilesystem`:
```typescript
// Simplified path construction
const simplePath = filePath.replace(/^\//, '');
const fullFilePath = path.join(chartBasePath, simplePath);
```

2. Added explicit directory checks and synchronous directory creation:
```typescript
const dirPath = path.dirname(fullFilePath);
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}
```

3. Added content validation before writing:
```typescript
if (!content || content.length === 0) {
  log.error(`Empty content provided for file: ${filePath}`);
  return;
}
```

4. Added explicit VS Code editor integration to ensure files are recognized after writing:
```typescript
vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fullFilePath));
```

5. Fixed function exports in lifecycle module to ensure functions can be called from other modules:
```typescript
// Before: function was not exported
async function acceptFileChanges(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {...}

// After: function is exported
export async function acceptFileChanges(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {...}
```
This resolves the error: `TypeError: l.acceptFileChanges is not a function`

6. Added comprehensive diagnostics through detailed logging and a test command:
```
// Command registration
vscode.commands.registerCommand('chartsmith.testFileWrite', async () => {...});
```

These changes ensure that files retrieved from the API are properly written to the filesystem and recognized by VS Code.

### Implemented File Content Filesystem Writing

**Files:**
- `chartsmith-extension/src/modules/fileContent/index.ts`
- `chartsmith-extension/src/modules/lifecycle/index.ts`

Added functionality to write API-retrieved file content directly to the filesystem:

1. Created a new centralized `writeContentToFilesystem` function in `fileContent/index.ts`:
```typescript
export async function writeContentToFilesystem(
  filePath: string,
  workspaceId: string,
  content: string
): Promise<void> {
  // Retrieves workspace mapping and writes content to the appropriate file path
  // Includes path normalization, directory creation, and error handling
}
```

2. Updated `getFileContent` function to write content to the filesystem at every retrieval point:
```typescript
export async function getFileContent(
  authData: AuthData | null,
  workspaceId: string,
  planId: string,
  filePath: string,
  providedContent?: string
): Promise<string | null> {
  // Write content to filesystem regardless of source: 
  // - Provided content
  // - Cached content
  // - API content
  // - Demo content (development mode)
}
```

3. Refactored `acceptFileChanges` in `lifecycle/index.ts` to use the centralized write function:
```typescript
async function acceptFileChanges(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {
  // Retrieves content from various sources
  // Uses fileContent.writeContentToFilesystem to write content
  // Removes the need for duplicate file writing logic
}
```

4. Added comprehensive error handling and logging throughout the file writing process.

5. Created documentation in `FILESYSTEM_WRITE_IMPLEMENTATION.md` detailing the implementation approach.

### Added Accept/Reject UI for File Diffs

**Files:**
- `chartsmith-extension/src/modules/render/index.ts`
- `chartsmith-extension/package.json`

Added UI elements to accept or reject file changes when viewing diffs:

1. Added buttons in the editor title area with check/x icons
2. Implemented keyboard shortcuts (Alt+A for accept, Alt+R for reject)
3. Added proper context handling to show/hide buttons at appropriate times
4. Implemented command handlers to process accept/reject actions

### Extension Configuration

**File:** `chartsmith-extension/package.json`

Added configuration options for the extension:

```json
"configuration": {
  "title": "ChartSmith",
  "properties": {
    "chartsmith.apiEndpoint": {
      "type": "string",
      "default": "https://chartsmith.ai",
      "description": "API endpoint for ChartSmith service"
    },
    "chartsmith.wwwEndpoint": {
      "type": "string",
      "default": "https://chartsmith.ai",
      "description": "Web endpoint for ChartSmith service"
    },
    "chartsmith.pushEndpoint": {
      "type": "string",
      "default": "",
      "description": "Push endpoint for ChartSmith service (optional)"
    },
    "chartsmith.developmentMode": {
      "type": "boolean",
      "default": false,
      "description": "Enable development mode with features like demo content generation"
    }
  }
}
```

### Added Command to Reset Endpoints

**File:** `chartsmith-extension/src/modules/lifecycle/index.ts`

Added a command to reset endpoints to configuration values:

```javascript
vscode.commands.registerCommand("chartsmith.resetEndpoints", async () => {
  console.log("[DEBUG][LIFECYCLE] Running command: chartsmith.resetEndpoints");
  
  try {
    await config.resetEndpointsToConfig(context.secrets);
    vscode.window.showInformationMessage("Endpoints have been reset to match configuration values");
  } catch (error) {
    console.error("[ERROR][LIFECYCLE] Error resetting endpoints:", error);
    vscode.window.showErrorMessage(`Failed to reset endpoints: ${error}`);
  }
});
```

### Added Explicit Plan Status Updates

**File:** `chartsmith-extension/src/modules/lifecycle/index.ts`

Enhanced plan status updates to ensure UI properly reflects changes:

```javascript
// Explicitly update the plan status
globalState.webviewGlobal.postMessage({
  command: 'updatePlanStatus',
  planId: planId,
  status: 'applied'
});
```

### Fixed Diff View Button Persistence When Switching Tabs

**File:** `chartsmith-extension/src/modules/render/index.ts`

Fixed an issue where the accept/reject buttons would disappear when switching between open diff tabs:

```typescript
// Setup shared command handlers that work across all diff views
function setupSharedCommandHandlers() {
  // Register shared handlers only once instead of per diff view
  acceptCommandDisposable = vscode.commands.registerCommand('chartsmith.acceptChanges', async () => {
    // Find the active diff based on the current editor
    const activeEditor = vscode.window.activeTextEditor;
    // ... identify current diff and process it
  });
  
  // Track editor focus changes to ensure buttons remain visible
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document.uri.scheme === 'chartsmith-diff') {
      // Re-enable buttons when focusing any diff editor
      vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
    }
  });
}
```

This implementation ensures that:
1. Command handlers are registered once globally rather than per diff view
2. Button visibility is maintained when switching between multiple diff tabs
3. The correct diff is identified based on the currently focused editor

This provides a more consistent user experience when reviewing multiple file changes simultaneously.

### Fixed Multiple Diff Tab Support

**Files:**
- `chartsmith-extension/src/modules/render/index.ts`
- `chartsmith-extension/src/extension.ts`

Fixed multiple issues with the diff tab handling:

1. Added reliable active diff identification:
```typescript
function getActiveDiffId(): string | undefined {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor || activeEditor.document.uri.scheme !== 'chartsmith-diff') {
    return undefined;
  }
  
  const uriString = activeEditor.document.uri.toString();
  for (const [id, _] of global.chartsmithDiffRegistry?.entries() || []) {
    if (uriString.includes(id)) {
      return id;
    }
  }
  
  return undefined;
}
```

2. Centralized button visibility management:
```typescript
function updateDiffButtonsVisibility() {
  const hasDiffEditors = vscode.window.visibleTextEditors.some(
    editor => editor.document.uri.scheme === 'chartsmith-diff'
  );
  vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', hasDiffEditors);
}
```

3. Added persistence of diffs across VS Code window reloads:
```typescript
export function saveDiffState(context: vscode.ExtensionContext) {
  const diffState = Array.from(global.chartsmithDiffRegistry.entries()).map(([id, entry]) => ({
    id, filePath: entry.filePath, pendingContent: entry.pendingContent
  }));
  context.globalState.update('chartsmith.diffState', diffState);
}

export function restoreDiffState(context: vscode.ExtensionContext) {
  const diffState = context.globalState.get('chartsmith.diffState') as any[] || [];
  for (const entry of diffState) {
    showFileDiff(entry.filePath, entry.pendingContent);
  }
}
```

These changes fix the following issues:
1. Only the first diff tab working - now all tabs properly handle accept/reject actions
2. Accept/reject buttons remaining visible after accepting changes but not functioning
3. Diff content being lost on VS Code window reload

Added a new command "ChartSmith: Restore Saved Diffs" to recover diffs manually if needed.

## Testing Infrastructure

**File:** `chartsmith-extension/package.json`

Added Jest testing framework and scripts:

```json
"scripts": {
  "test": "jest"
},
"devDependencies": {
  "@types/jest": "^29.5.14",
  "jest": "^29.7.0",
  "ts-jest": "^29.3.2",
}
```

## Summary

These changes address several key issues:

1. Fixed a critical backend crash caused by nil pointer dereference when the Anthropic API returns unexpected response formats
2. Implemented a robust file content writing system to ensure API content is properly saved to the filesystem
3. Fixed filesystem path construction to ensure files are written to the correct location
4. Added UI elements for accepting and rejecting file changes directly in the VS Code diff view
5. Added configuration options and commands for endpoint management
6. Set up testing infrastructure for improved code quality 

## Latest Changes

### Environment Variable Handling Improvements

**Files:**
- `Makefile`
- `CONTRIBUTING.md`
- `cmd/chartsmith/main.go`

- Implemented simplified environment variable handling in the Makefile
- Removed hardcoded API keys and credentials from the Makefile
- Added default values for database and service connections to simplify local development
- Created environment variable checking that only requires setting essential API keys
- Added clear error messages when required environment variables are missing
- Updated CONTRIBUTING.md to emphasize the importance of the `make bootstrap` command
- Added environment variable checker helper function that provides user-friendly guidance
- Simplified dependency between commands and environment checks

### Improved Debug Logging Controls

**Files:**
- `chartsmith-extension/src/modules/logging/index.ts`
- `chartsmith-extension/src/modules/config/index.ts`

- Enhanced the logging module to respect the development mode setting
- Added automatic enabling/disabling of debug logging based on the `chartsmith.developmentMode` setting
- Added configuration change listener to update logging behavior when settings change
- Replaced direct console.log calls with structured logger in the config module
- Added conditional debug output to prevent unnecessary logging in production mode
- Added `isDebugEnabled()` method to the logger for checking debug status

### Documentation Improvements

**Files:**
- `chartsmith-extension/DEVELOPMENT.md`
- `CONTRIBUTING.md`
- `README.md`

- Enhanced VS Code extension development documentation in `chartsmith-extension/DEVELOPMENT.md`
- Added comprehensive sections on building, installing, and debugging the extension
- Added detailed instructions for accessing the developer console for debugging
- Included information about extension test commands for verifying functionality
- Added documentation about development mode settings and endpoint configuration
- Added reference to extension documentation in CONTRIBUTING.md
- Updated README.md with reference to CONTRIBUTING.md for development setup
- Updated CONTRIBUTING.md with additional instructions for the bootstrap command
- Improved setup workflow documentation with clearer terminal and step organization
- Added troubleshooting tips specifically addressing chart data initialization

### UI Improvements

**Files:**
- `chartsmith-extension/src/modules/render/index.ts`
- `chartsmith-extension/src/extension.ts`

- Fixed issue with diff accept/reject buttons disappearing when switching tabs
- Modified extension context handling to ensure command handlers remain available across tab switches
- Implemented proper context sharing between extension activation and render module
- Enhanced diff handling to prevent "No active diff found" errors when accepting changes
- Added additional accept/reject commands that work directly with the active editor
- Improved diff identification with better URI parsing and registry management
- Fixed critical issue with accept/reject buttons by using direct URI-based diff identification
- Added self-healing capability to recreate registry entries for active diffs that may have been lost
- Simplified button handler logic to directly extract diff ID from active editor URI

### Testing Improvements

**Files:**
- `chartsmith-extension/src/modules/lifecycle/index.ts`
- `chartsmith-extension/src/modules/render/index.ts`

- Added command to create mock diffs for testing without API rate limits
- Command creates 3 sample files with realistic changes for testing accept/reject functionality
- Files include YAML for Service, YAML for Deployment, and a JSON configuration
- Enhanced "Test File Writing" command to create initial mock files for diff testing
- Implemented two-step process: first run "Test File Writing" to create files, then "Create Mock Diffs" to generate diffs

## Unreleased

### Added

**Files:**
- `chartsmith-extension/src/modules/render/index.ts`
- `chartsmith-extension/src/extension.ts`

* Improved diff button persistence between tab changes:
  * Buttons now remain visible when switching between tabs
  * Added tab change event listener to detect when user switches tabs
  * Implemented more robust context state management
  * Added additional logging for diagnosing visibility issues

### Fixed 

**Files:**
- `chartsmith-extension/src/modules/lifecycle/index.ts`
- `chartsmith-extension/src/webview/app.tsx`

* Fixed issue with Proceed button not appearing in the VS Code extension:
  * Added explicit normalization of plan state flags (approved/applied)
  * Ensured consistency between plan status and boolean flags
  * Added detailed debugging for plan state and button visibility
  * Improved state updates when proceeding with a plan
  * Added immediate local status updates to avoid UI synchronization issues

