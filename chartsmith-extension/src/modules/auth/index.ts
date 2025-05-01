import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import { AuthData, GlobalState } from '../../types';
import { 
  AUTH_TOKEN_KEY, 
  API_ENDPOINT_KEY,  
  USER_ID_KEY
} from '../../constants';
import { log } from '../logging';
import { createAuthDataWithDerivedEndpoints, updateWithDerivedEndpoints, processApiEndpoint } from '../endpoints';

let secretStorage: vscode.SecretStorage;
let globalState: GlobalState;
let context: vscode.ExtensionContext;

export function initAuth(
  extensionContext: vscode.ExtensionContext, 
  state: GlobalState
): void {
  context = extensionContext;
  secretStorage = context.secrets;
  globalState = state;
  
  // Initialize configuration defaults
  import('../config').then(config => {
    config.initDefaultConfigIfNeeded(secretStorage).catch(error => {
      console.error('Error initializing configuration defaults:', error);
    });
  });
}

export async function getAuthToken(): Promise<string | undefined> {
  const token = await secretStorage.get(AUTH_TOKEN_KEY);
  return token;
}

export async function getApiEndpoint(): Promise<string | undefined> {
  const endpoint = await secretStorage.get(API_ENDPOINT_KEY);
  return endpoint;
}

export async function getUserId(): Promise<string | undefined> {
  const userId = await secretStorage.get(USER_ID_KEY);
  return userId;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

export async function loadAuthData(): Promise<AuthData | null> {
  const token = await getAuthToken();
  const apiEndpoint = await getApiEndpoint();
  const userId = await getUserId();

  if (!token || !apiEndpoint || !userId) {
    return null;
  }

  // Create AuthData with derived endpoints
  const authData = createAuthDataWithDerivedEndpoints(token, userId, apiEndpoint);
  
  // Store this auth data in global state
  globalState.authData = authData;
  globalState.isLoggedIn = true;
  
  return authData;
}

export async function saveAuthData(data: AuthData): Promise<void> {
  try {
    // Process the API endpoint to ensure it uses HTTPS for non-localhost
    const apiEndpoint = processApiEndpoint(data.apiEndpoint);
    
    log.info(`Saving auth data: token ${data.token ? 'present' : 'missing'}, userId: ${data.userId ? 'present' : 'missing'}, apiEndpoint: ${apiEndpoint}`);
    
    // Store only the essential data
    try {
      await secretStorage.store(AUTH_TOKEN_KEY, data.token);
      log.debug('Token stored in secret storage');
    } catch (err) {
      log.error(`Failed to store token: ${err}`);
      throw err;
    }
    
    try {
      await secretStorage.store(API_ENDPOINT_KEY, apiEndpoint);
      log.debug('API endpoint stored in secret storage');
    } catch (err) {
      log.error(`Failed to store API endpoint: ${err}`);
      throw err;
    }
    
    try {
      await secretStorage.store(USER_ID_KEY, data.userId);
      log.debug('User ID stored in secret storage');
    } catch (err) {
      log.error(`Failed to store user ID: ${err}`);
      throw err;
    }
    
    // Create auth data with derived endpoints
    const authData = createAuthDataWithDerivedEndpoints(
      data.token,
      data.userId,
      apiEndpoint
    );
    
    // Update the global state
    globalState.authData = authData;
    globalState.isLoggedIn = true;
    log.info('Auth data successfully saved and global state updated');
    
    // Refresh the webview after login
    if (globalState.webviewGlobal) {
      log.debug('Sending auth changed message to webview');
      // Send properly derived endpoints to the webview
      globalState.webviewGlobal.postMessage({
        command: 'authChanged',
        status: 'loggedIn',
        authData: {
          apiEndpoint: authData.apiEndpoint,
          pushEndpoint: authData.pushEndpoint,
          wwwEndpoint: authData.wwwEndpoint,
          userId: authData.userId,
          hasToken: !!authData.token
        }
      });
    } else {
      // Try to reload the Chartsmith webview if it exists
      log.debug('No webview found, attempting to focus ChartSmith view');
      try {
        await vscode.commands.executeCommand('chartsmith.view.focus');
      } catch (error) {
        log.error(`Error focusing chartsmith view: ${error}`);
      }
    }
  } catch (error) {
    log.error(`Error in saveAuthData: ${error}`);
    vscode.window.showErrorMessage(`Failed to save authentication data: ${error}`);
    throw error;
  }
}

export async function clearAuthData(): Promise<void> {
  // Store a reference to current webview before clearing state
  const webviewGlobal = globalState.webviewGlobal;
  
  // Clear global state
  globalState.authData = null;
  globalState.isLoggedIn = false;
  
  // Clear storage - only remove the essential keys
  await Promise.all([
    secretStorage.delete(AUTH_TOKEN_KEY),
    secretStorage.delete(API_ENDPOINT_KEY),
    secretStorage.delete(USER_ID_KEY)
  ]);
  
  // Notify webview of logout if available
  if (webviewGlobal) {
    webviewGlobal.postMessage({
      command: 'authChanged',
      status: 'loggedOut'
    });
  } else {
    // Try to reload the Chartsmith webview if it exists
    try {
      await vscode.commands.executeCommand('chartsmith.view.focus');
    } catch (error) {
      console.log("Error focusing chartsmith view:", error);
    }
  }
}

export function startAuthServer(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (globalState.authServer) {
      globalState.authServer.close();
    }

    globalState.authServer = http.createServer(async (req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }
      
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      // Handle different request methods
      if (req.method === 'POST' && req.url === '/') {
        // Handle POST request with JSON body
        let body = '';
        
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            // Check for empty body
            if (!body || body.trim() === '') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Empty request body' }));
              return;
            }
            
            const parsedData = JSON.parse(body);
            log.debug(`Received auth data via POST: ${JSON.stringify({
              has_token: !!parsedData.token,
              has_userId: !!parsedData.userId,
              has_apiEndpoint: !!parsedData.apiEndpoint
            })}`);
            
            let tokenValue = '';
            let userIdValue = '';
            let apiEndpointValue = '';
            
            if (parsedData.token) {
              // Handle both string and object formats for token
              if (typeof parsedData.token === 'object' && parsedData.token.token) {
                tokenValue = parsedData.token.token;
                log.debug('Extracted token from object format');
              } else {
                tokenValue = parsedData.token;
                log.debug('Using token as direct string value');
              }
            }
            
            if (parsedData.userId) {
              userIdValue = parsedData.userId;
            }
            
            if (parsedData.apiEndpoint) {
              apiEndpointValue = parsedData.apiEndpoint;
            }
            
            if (!tokenValue || !userIdValue || !apiEndpointValue) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Missing required fields',
                details: {
                  token: !tokenValue ? 'missing' : 'present',
                  userId: !userIdValue ? 'missing' : 'present',
                  apiEndpoint: !apiEndpointValue ? 'missing' : 'present'
                }
              }));
              return;
            }
            
            // Create AuthData with derived endpoints
            const authData = createAuthDataWithDerivedEndpoints(
              tokenValue,
              userIdValue,
              apiEndpointValue
            );
            
            await saveAuthData(authData);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            console.error('Error parsing JSON body:', error);
            console.error('Request body was:', body);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body', details: String(error) }));
          }
        });
        return;
      }
      
      // Handle traditional GET requests from the web authentication flow
      if (req.method === 'GET' && req.url.startsWith('/auth')) {
        const parsedUrl = url.parse(req.url, true);
        const query = parsedUrl.query;
        
        if (query.token && query.userId && query.apiEndpoint) {
          log.debug(`Received auth data via GET: ${JSON.stringify({
            has_token: !!query.token,
            has_userId: !!query.userId,
            has_apiEndpoint: !!query.apiEndpoint
          })}`);
          
          // Create AuthData with derived endpoints
          const authData = createAuthDataWithDerivedEndpoints(
            query.token as string, 
            query.userId as string, 
            query.apiEndpoint as string
          );
          
          await saveAuthData(authData);
          
          // Send success page with auto-close script
          res.writeHead(200, {
            'Content-Type': 'text/html'
          });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>ChartSmith Authentication</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background-color: #f5f5f5;
                }
                .container {
                  text-align: center;
                  padding: 2rem;
                  background: white;
                  border-radius: 6px;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                  max-width: 500px;
                }
                h1 {
                  color: #333;
                  margin-bottom: 1rem;
                }
                p {
                  color: #555;
                  line-height: 1.5;
                }
                .checkmark {
                  color: #4CAF50;
                  font-size: 64px;
                  margin-bottom: 1rem;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="checkmark">✓</div>
                <h1>Authentication Successful</h1>
                <p>You have been logged in to ChartSmith.</p>
                <p>This window will close automatically in 3 seconds.</p>
                <p>You can now return to VS Code.</p>
              </div>
              <script>
                setTimeout(() => window.close(), 3000);
              </script>
            </body>
            </html>
          `);
          
          // Resolve the promise to indicate authentication is complete
          resolve('Authentication successful');
        } else {
          res.writeHead(400);
          res.end('Missing required query parameters');
        }
        return;
      }
      
      // Handle other requests
      res.writeHead(404);
      res.end('Not found');
    });

    globalState.authServer.on('error', (err) => {
      reject(err);
    });

    globalState.authServer.listen(port, () => {
      console.log(`Auth server listening on port ${port}`);
    });
  });
}

export function stopAuthServer(): void {
  if (globalState.authServer) {
    globalState.authServer.close();
    globalState.authServer = null;
  }
}

export function decodeJwt(token: string): any {
  try {
    // Check if token is valid before attempting to decode
    if (!token || typeof token !== 'string' || token.trim() === '') {
      return null;
    }

    // Split by dots and verify we have at least 3 parts (header.payload.signature)
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    // Get the base64 payload (second part)
    const base64Url = parts[1];
    if (!base64Url) {
      return null;
    }

    // Replace characters for base64 decoding
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decode the base64
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    
    // Parse the JSON
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Verify if the current session is valid by making a test request to the API
 * This helps ensure that we have valid credentials before attempting operations
 */
export async function verifySession(): Promise<boolean> {
  try {
    // Get auth data from storage
    const token = await getAuthToken();
    const apiEndpoint = await getApiEndpoint();
    const userId = await getUserId();
    
    // Basic validation of auth data
    if (!token || !apiEndpoint || !userId) {
      log.info(`verifySession: Missing auth data - hasToken: ${!!token}, hasApiEndpoint: ${!!apiEndpoint}, hasUserId: ${!!userId}`);
      return false;
    }
    
    log.info(`verifySession: Using API endpoint: ${apiEndpoint}`);
    
    try {
      // Import the proper utilities
      const utils = await import('../utils');
      const api = await import('../api');
      
      // Use fetchApi instead of manual URL construction to ensure consistency
      // CRITICAL FIX: Use '/auth/status' instead of '/api/auth/status' to avoid double prefix
      const statusResponse = await api.fetchApi(
        {
          token,
          userId,
          apiEndpoint,
          pushEndpoint: '',
          wwwEndpoint: ''
        },
        '/auth/status', // Changed from '/api/auth/status'
        'GET'
      );
      
      log.info(`Session verification successful: ${JSON.stringify(statusResponse)}`);
      
      // If we got a successful response, check user ID
      if (statusResponse && statusResponse.user && statusResponse.user.id) {
        if (statusResponse.user.id === userId) {
          log.info('User ID in response matches stored user ID');
        } else {
          log.warn('Warning: User ID in response does not match stored user ID');
        }
        return true;
      }
      
      // If we got here without returning true, something is wrong with the response
      log.warn('Response from auth status endpoint did not contain expected user data');
      return false;
    } catch (error: any) {
      log.error(`Error during session verification: ${error}`);
      
      // More helpful error info for redirects
      if (error.message && error.message.includes('307')) {
        log.error('Session verification failed due to redirect. Token likely expired.');
      }
      
      return false;
    }
  } catch (error) {
    log.error(`Unexpected error verifying session: ${error}`);
    return false;
  }
}

/**
 * Attempt to refresh the session by making a request to the auth status endpoint
 * This can sometimes resolve session issues when the token is still valid but not being accepted
 */
export async function refreshSession(): Promise<boolean> {
  try {
    // Get auth data
    const authData = await loadAuthData();
    if (!authData) {
      log.info('refreshSession: No auth data available');
      return false;
    }
    
    log.info(`refreshSession: Using API endpoint: ${authData.apiEndpoint}`);
    
    // Try to fetch actual auth data from the server
    try {
      // Import API module
      const api = await import('../api');
      
      // Make a request to auth status endpoint with properly formatted path
      // CRITICAL FIX: Use '/auth/status' instead of '/api/auth/status'
      const response = await api.fetchApi(
        authData,
        '/auth/status', // Changed from '/api/auth/status'
        'GET'
      );
      
      // Check if response contains valid user info
      if (response && response.user && response.user.id) {
        log.info('Session refresh successful');
        return true;
      } else {
        log.warn('Session refresh failed: Invalid or missing user data in response');
        return false;
      }
    } catch (error: any) {
      log.error(`Error during session refresh: ${error}`);
      
      // More helpful error info for redirects
      if (error.message && error.message.includes('307')) {
        log.error('Session refresh failed due to redirect. Token likely expired.');
      }
      
      return false;
    }
  } catch (error) {
    log.error(`Unexpected error refreshing session: ${error}`);
    return false;
  }
}

/**
 * Get the currently stored authentication data
 * @returns The authentication data or null if not authenticated
 */
export function getAuthData(): AuthData | null {
  const state = (global as any).chartsmithGlobalState;
  if (!state || !state.authData) {
    return null;
  }
  
  // Ensure the authData always has properly derived endpoints
  if (state.authData.apiEndpoint) {
    // Update the authData in-place with properly derived endpoints
    state.authData = updateWithDerivedEndpoints(state.authData);
  }
  
  return state.authData;
}

/**
 * Displays diagnostic information about authentication in a VS Code information message
 * Helpful for debugging authentication issues
 */
export function showAuthDiagnostics(): void {
  try {
    log.info('Showing auth diagnostics...');
    
    // Get auth data
    const authData = getAuthData();
    
    if (!authData) {
      vscode.window.showInformationMessage('Not authenticated');
      log.info('Auth diagnostics: Not authenticated');
      return;
    }
    
    // Check if token is valid by attempting to decode it
    const decodedToken = decodeJwt(authData.token);
    const tokenExpiry = decodedToken?.exp ? new Date(decodedToken.exp * 1000).toISOString() : 'N/A';
    const tokenIsExpired = decodedToken?.exp ? (decodedToken.exp * 1000 < Date.now()) : 'Unknown';
    
    // Build the diagnostic information
    const diagnosticInfo = [
      `API Endpoint: ${authData.apiEndpoint}`,
      `WWW Endpoint: ${authData.wwwEndpoint || 'not set'}`,
      `Push Endpoint: ${authData.pushEndpoint || 'not set'}`,
      `User ID: ${authData.userId}`,
      `Token present: ${!!authData.token}`,
      `Token expiry: ${tokenExpiry}`,
      `Token expired: ${tokenIsExpired}`
    ];
    
    // Log the info
    diagnosticInfo.forEach(info => log.info(`Auth diagnostics: ${info}`));
    
    // Show an information message with diagnostic details
    vscode.window.showInformationMessage('Authentication Diagnostics', ...diagnosticInfo);
    
    // Additionally, attempt a session verification to check backend connectivity
    verifySession().then(isValid => {
      const verificationResult = isValid ? 'Session is valid' : 'Session verification failed';
      log.info(`Auth diagnostics verification: ${verificationResult}`);
      vscode.window.showInformationMessage(`Session verification: ${verificationResult}`);
    }).catch(error => {
      log.error(`Auth diagnostics verification error: ${error}`);
      vscode.window.showErrorMessage(`Session verification error: ${error}`);
    });
  } catch (error) {
    log.error(`Error showing auth diagnostics: ${error}`);
    vscode.window.showErrorMessage(`Failed to show authentication diagnostics: ${error}`);
  }
}