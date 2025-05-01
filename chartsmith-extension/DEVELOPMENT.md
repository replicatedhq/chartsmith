# ChartSmith Extension Development

This document outlines configuration options for developers working on the ChartSmith VSCode extension.

## Building and Installing the Extension

1. **Build the extension**
   ```bash
   cd chartsmith-extension
   npm install
   npm run package
   npm run package:vsix
   ```
   This creates a `.vsix` file in the `chartsmith-extension` directory.

2. **Install the extension in VS Code**
   - Open VS Code
   - Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
   - Click on the "..." menu (top-right of Extensions view)
   - Select "Install from VSIX..."
   - Navigate to the generated .vsix file in the `chartsmith-extension` directory
   - After installation, reload VS Code when prompted

3. **Reload VS Code Window**
   - After installing or updating the extension, reload the window
   - Command Palette (Ctrl+Shift+P / Cmd+Shift+P) → "Developer: Reload Window"

## Configuring Endpoints

The ChartSmith extension connects to several backend services. In production, these are hosted at `chartsmith.ai`, but during development, you may need to point to local or staging environments.

### VSCode Settings

You can configure the API endpoint by adding the following to your VSCode settings (`settings.json`):

```json
{
  "chartsmith.apiEndpoint": "http://localhost:3000/api"
}
```

> **IMPORTANT**: Always include the `/api` suffix in your endpoint. For production use, the default is `https://chartsmith.ai/api`.

The WWW and Push endpoints are automatically derived from the API endpoint:
- **WWW Endpoint**: Same as the API endpoint but with the `/api` path removed
- **Push Endpoint**: For WebSockets, converted to `ws://` or `wss://` protocol with appropriate paths for Centrifugo

### Development Mode

Enable development mode to access additional debugging features:

```json
{
  "chartsmith.developmentMode": true
}
```

This setting enables:
- Demo content generation when API content is unavailable
- Additional logging and debug information
- Test commands in the command palette

### Development Workflow

1. Configure the API endpoint in your VSCode settings as needed.
2. If you're already logged in, you'll need to log out and log in again for the new endpoint to take effect.
3. The extension will use the configured API endpoint and derive other endpoints from it.

### Notes on HTTPS

The extension will automatically convert HTTP to HTTPS for non-localhost URLs for security reasons. This means:

- Local development (localhost/127.0.0.1): HTTP is allowed
- All other hosts: HTTP will be converted to HTTPS

### Implementation Details

The endpoints are stored in the extension's secret storage. The configuration works as follows:

1. If no endpoint is stored in secret storage, the extension will use the value from VSCode settings.
2. When logging in, the extension will use the API endpoint from VSCode settings.
3. After authentication, the API endpoint provided by the auth server will be stored and used.

If you need to reset the stored endpoints, you can use the command "ChartSmith: Reset Endpoints to Configuration" or log out and log in again.

## Debugging the Extension

### Developer Tools Console

To access the console for debugging:
1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "Developer: Toggle Developer Tools"
3. The console will show extension logs and errors

The extension uses a logger with various levels:
- `log.debug()` - Detailed debugging information
- `log.info()` - Standard operation information
- `log.warn()` - Warnings that don't prevent operation
- `log.error()` - Errors that impact functionality

### Extension Logs

For more structured logs:
1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "Developer: Show Logs..."
3. Select "Extension Host" to see extension-specific logs

### VS Code Debug Mode

For step-by-step debugging:
1. Open the extension project in VS Code
2. Press F5 to launch a new VS Code window with the extension in debug mode
3. Set breakpoints in your code to pause execution
4. Use the Debug Console to inspect variables and run commands

## Testing Commands

The extension provides several commands for testing and debugging:

- `ChartSmith: Test Authentication Token` - Verify the auth token
- `ChartSmith: Verify Authentication Session` - Check if the session is valid
- `ChartSmith: Reset Endpoints to Configuration` - Reset to the endpoints in settings
- `ChartSmith: Show Authentication Diagnostics` - Display detailed authentication information for troubleshooting
- `ChartSmith: Test File Writing` - Test filesystem access
- `ChartSmith: Test Path Resolution` - Test path handling
- `ChartSmith: Refresh Diff Buttons Visibility` - Force refresh of diff buttons

To run these commands:
1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "ChartSmith" to see available commands
3. Select the desired command 