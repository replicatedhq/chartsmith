# ChartSmith Authentication Flow

This document explains how authentication works in the ChartSmith VSCode extension and how to troubleshoot common issues.

## Authentication Flow

1. When the user clicks "Login" in the extension, the following happens:
   - The extension starts a local HTTP server on a random port (between 3000-4000)
   - The browser opens `<wwwEndpoint>/auth/extension?next=http://localhost:<port>`
   - The user completes authentication on the web UI
   - The web UI redirects back to the local server with auth tokens
   - The local server saves these tokens and endpoints in VSCode's secret storage

2. After authentication, API requests include an authorization header:
   ```
   Authorization: Bearer <token>
   ```

3. All subsequent API requests use the stored endpoints and token

## Configuring Endpoints

The extension uses three main endpoints:
- `apiEndpoint`: API server (default: https://chartsmith.ai)
- `wwwEndpoint`: Web UI (default: https://chartsmith.ai)
- `pushEndpoint`: WebSocket server (default: not set)

For development, you can configure these endpoints in VSCode settings.json:

```json
{
  "chartsmith.apiEndpoint": "http://localhost:8000",
  "chartsmith.wwwEndpoint": "http://localhost:3000",
  "chartsmith.pushEndpoint": "http://localhost:8000"
}
```

## Troubleshooting

### HTTP 307 Redirect Error

If you see an error like `Failed to upload chart: Error: HTTP error 307: /login`, this indicates an authentication issue. The server is redirecting to the login page because:

1. **Not logged in**: The extension doesn't have valid authentication tokens
2. **Token expired**: The stored token has expired
3. **Endpoint mismatch**: The configured endpoints don't match the backend services

#### How to fix:

1. **Log out and log in again**:
   - Click the "Logout" button in the extension
   - Click "Login" to authenticate again
   - Make sure you complete the authentication in the browser

2. **Check endpoint configuration**:
   - Ensure your endpoint configuration in VSCode settings matches your development environment
   - For local development, your API and push endpoints should point to your API server (e.g., `http://localhost:8000`)
   - Your www endpoint should point to your web UI (e.g., `http://localhost:3000`)

3. **Verify development servers**:
   - Confirm that your local servers are running
   - Test direct API access with a tool like curl:
     ```
     curl http://localhost:8000/health
     ```

4. **Debug mode**:
   - Enable developer tools in VSCode:
     - Press F1 and type "Developer: Toggle Developer Tools"
     - Look for console.log messages related to authentication
   - Check the logs in the "Output" panel (select "ChartSmith" from the dropdown)

### JWT Decoding Errors

If you encounter errors like:
```
Error decoding JWT: TypeError: Cannot read properties of undefined (reading 'replace')
```

This usually indicates:
1. The token is missing
2. The token is in an unexpected format
3. The authentication process didn't complete correctly

#### How to fix:

1. **Use the Token Test Command**:
   - Press F1 and type "ChartSmith: Test Authentication Token"
   - This will run diagnostics on your stored token
   - Check the developer console for detailed output
   
2. **Verify Your Session**:
   - Press F1 and type "ChartSmith: Verify Authentication Session"
   - This will make a test request to the API to verify your credentials
   - If it fails, you need to log out and log in again
   
3. **Clear Your Tokens and Login Again**:
   - Click the "Logout" button to clear all stored credentials
   - Click "Login" and complete the process in the browser
   - Make sure the browser window completes the entire login flow

4. **Check Browser Console During Login**:
   - Open your browser's developer tools during login
   - Look for any errors in the console
   - Make sure the browser is redirected back to the local server

### Session Errors

If you encounter a HTTP 307 redirect to /login when uploading a chart, this indicates your authentication session is not valid:

```
[DEBUG] Error during chart upload: Error: HTTP error 307: /login
```

This can happen for several reasons:
1. Your token has expired
2. The token was not properly saved during login
3. The API endpoint configuration doesn't match your actual API server
4. The authentication flow with the server didn't complete correctly

#### How to fix:

1. **Verify Your Session First**:
   - Press F1 and type "ChartSmith: Verify Authentication Session"
   - This will tell you immediately if your session is valid
   - If your session is invalid, the command will automatically attempt to refresh it
   - This refresh can sometimes resolve temporary authentication issues
   
2. **Investigate API Endpoint Configuration**:
   - Make sure your VSCode settings match your actual API server
   - For local development with default ports:
     ```json
     "chartsmith.apiEndpoint": "http://localhost:8000"
     ```
   - The API server must be running and accessible

3. **Complete Authentication Flow**:
   - Log out and log in again
   - When the browser window opens, make sure you complete the login process
   - The browser should redirect to a success page that says "Authentication successful!"
   - If you don't see this page, the authentication flow didn't complete

4. **Check Network Traffic**:
   - Use the browser's Network tab to monitor requests during login
   - There should be a successful request to your local server (http://localhost:XXXX)
   - If this request fails, the token won't be saved correctly

### Enhanced Debugging

The extension includes enhanced debugging capabilities for troubleshooting authentication issues:

1. **Token Validation Debugging**:
   - When uploading a chart, detailed token validation logs will appear in the developer console
   - These logs show:
     - Whether a token exists
     - Token expiration time (if available)
     - Whether the token is valid

2. **Request/Response Debugging**:
   - Detailed information about HTTP requests and responses
   - Complete headers and response data
   - Specific detection of redirects to login pages

3. **Config Debugging**:
   - Logs showing what configuration values are loaded from VSCode settings
   - Information about endpoint configuration from both settings and storage

To access these debug logs:
1. Open the Developer Tools (F1 and type "Developer: Toggle Developer Tools")
2. Look for log entries with the `[DEBUG]` prefix
3. Entries are organized by component (`[AUTH]`, `[CONFIG]`, etc.)

These logs can help determine exactly where the authentication flow is breaking down.

### Certificate Issues

For HTTPS endpoints in development:

1. **Self-signed certificates**:
   - The extension enforces HTTPS for non-localhost URLs
   - For development with self-signed certificates, always use localhost URLs
   
2. **HTTP to HTTPS conversion**:
   - The extension automatically converts HTTP to HTTPS for non-localhost URLs
   - If your server requires HTTP, use localhost URLs

## Implementation Details

The authentication flow is implemented in these files:

- `src/modules/auth/index.ts`: Core authentication logic
- `src/modules/lifecycle/index.ts`: Login/logout commands
- `src/modules/api/index.ts`: API request handling with auth tokens
- `src/modules/config/index.ts`: Endpoint configuration

The main steps involved in the authentication flow:

1. `chartsmith.login` command starts a local HTTP server
2. User completes authentication on the web UI
3. Web UI redirects to the local server with tokens
4. Local server saves tokens in VSCode's secret storage
5. Local server sends success response and closes
6. VSCode extension uses the stored tokens for API requests 