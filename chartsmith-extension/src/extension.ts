import * as vscode from 'vscode';
import * as http from 'http';

interface AuthData {
  token: string;
  apiEndpoint: string;
}

let authData: AuthData | null = null;
let isLoggedIn = false;
let authServer: http.Server | null = null;
let webviewGlobal: vscode.Webview | null = null;
let outputChannel: vscode.OutputChannel;
let secretStorage: vscode.SecretStorage;

// Storage keys
const AUTH_TOKEN_KEY = 'chartsmith.authToken';
const API_ENDPOINT_KEY = 'chartsmith.apiEndpoint';

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('ChartSmith');
  context.subscriptions.push(outputChannel);
  secretStorage = context.secrets;
  
  outputChannel.appendLine('ChartSmith extension activated');
  
  // Check if we have stored credentials
  try {
    const storedToken = await secretStorage.get(AUTH_TOKEN_KEY);
    const storedApiEndpoint = await secretStorage.get(API_ENDPOINT_KEY);
    
    if (storedToken && storedApiEndpoint) {
      outputChannel.appendLine('Found stored authentication data');
      authData = { 
        token: storedToken,
        apiEndpoint: storedApiEndpoint 
      };
      isLoggedIn = true;
      outputChannel.appendLine(`API endpoint: ${storedApiEndpoint}`);
    } else if (storedToken) {
      // Handle case where we have token but not endpoint
      outputChannel.appendLine('Found token but missing API endpoint');
      isLoggedIn = false; // Force re-login to get both pieces of data
      await secretStorage.delete(AUTH_TOKEN_KEY); // Clear the token
    } else {
      outputChannel.appendLine('No stored authentication data found');
    }
  } catch (error) {
    outputChannel.appendLine(`Error retrieving stored authentication data: ${error}`);
  }
  
  const provider = new ChartSmithViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'chartsmith.view',
      provider
    )
  );
}

function getRandomPort(): number {
  return Math.floor(Math.random() * (65535 - 10000)) + 10000;
}

function startAuthServer(): number {
  const port = getRandomPort();
  outputChannel.appendLine(`Starting auth server on port ${port}`);
  outputChannel.show();
  
  authServer = http.createServer((req, res) => {
    outputChannel.appendLine(`Received ${req.method} request to ${req.url}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      outputChannel.appendLine('Handling OPTIONS request (CORS preflight)');
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.method === 'POST' && req.url === '/') {
      outputChannel.appendLine('Handling POST request to /');
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          outputChannel.appendLine(`Received data: ${body}`);
          const parsedData = JSON.parse(body);
          
          // Check if we have token and API endpoint data
          outputChannel.appendLine(`Auth data structure: ${JSON.stringify(parsedData)}`);
          
          // Extract token - handle both formats {"token": "xyz"} and {"token": {"token": "xyz"}}
          let tokenValue = null;
          let apiEndpointValue = null;
          
          if (parsedData.token) {
            // Check if token is an object with a token property
            if (typeof parsedData.token === 'object' && parsedData.token.token) {
              tokenValue = parsedData.token.token;
              outputChannel.appendLine('Extracted token from nested object');
            } else if (typeof parsedData.token === 'string') {
              tokenValue = parsedData.token;
              outputChannel.appendLine('Using token string directly');
            }
          }
          
          // Extract API endpoint
          if (parsedData.apiEndpoint) {
            apiEndpointValue = parsedData.apiEndpoint;
          }
          
          if (tokenValue && apiEndpointValue) {
            outputChannel.appendLine('Valid auth data found in response');
            outputChannel.appendLine(`API endpoint: ${apiEndpointValue}`);
            
            // Store the auth data in memory
            authData = { 
              token: tokenValue,
              apiEndpoint: apiEndpointValue 
            };
            isLoggedIn = true;
            
            // Store auth data in secure storage
            try {
              await secretStorage.store(AUTH_TOKEN_KEY, tokenValue);
              await secretStorage.store(API_ENDPOINT_KEY, apiEndpointValue);
              outputChannel.appendLine('Auth data stored securely');
            } catch (storageError) {
              outputChannel.appendLine(`Error storing auth data: ${storageError}`);
            }
            
            if (webviewGlobal) {
              outputChannel.appendLine('Sending auth-success message to webview');
              webviewGlobal.postMessage({ type: 'auth-success' });
            }
          } else if (tokenValue && !apiEndpointValue) {
            outputChannel.appendLine('Token found but no API endpoint in response');
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Missing API endpoint in response' }));
            return;
          } else if (!tokenValue && apiEndpointValue) {
            outputChannel.appendLine('API endpoint found but no valid token in response');
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Missing or invalid token in response' }));
            return;
          } else {
            outputChannel.appendLine('Required auth data missing in response');
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Missing authentication data in response' }));
            return;
          }
          
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
          outputChannel.appendLine('Sent success response to client');
          
          if (authServer) {
            outputChannel.appendLine('Scheduling server shutdown');
            setTimeout(() => {
              authServer?.close();
              authServer = null;
              outputChannel.appendLine('Auth server shut down');
            }, 1000);
          }
        } catch (error) {
          outputChannel.appendLine(`Error parsing JSON: ${error}`);
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
    } else {
      outputChannel.appendLine(`Unhandled request: ${req.method} ${req.url}`);
      res.writeHead(404);
      res.end();
    }
  });
  
  authServer.listen(port, () => {
    outputChannel.appendLine(`Auth server listening on port ${port}`);
  });
  
  authServer.on('error', (err) => {
    outputChannel.appendLine(`Server error: ${err}`);
  });
  
  return port;
}

class ChartSmithViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    outputChannel.appendLine('Resolving webview view');
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    
    webviewGlobal = webviewView.webview;
    
    webviewView.webview.onDidReceiveMessage(
      async message => {
        outputChannel.appendLine(`Received message from webview: ${JSON.stringify(message)}`);
        
        switch (message.command) {
          case 'login': {
            outputChannel.appendLine('Handling login command');
            const port = startAuthServer();
            const authUrl = `https://chartsmith.ai/auth/extension?next=http://localhost:${port}`;
            outputChannel.appendLine(`Opening auth URL: ${authUrl}`);
            vscode.env.openExternal(vscode.Uri.parse(authUrl));
            break;
          }
          case 'logout': {
            outputChannel.appendLine('Handling logout command');
            // Clear auth data from secure storage
            try {
              await secretStorage.delete(AUTH_TOKEN_KEY);
              await secretStorage.delete(API_ENDPOINT_KEY);
              outputChannel.appendLine('Auth data removed from secure storage');
              
              // Update the state
              authData = null;
              isLoggedIn = false;
              
              // Update the webview
              if (webviewGlobal) {
                webviewGlobal.postMessage({ type: 'auth-logout' });
              }
              
              // Refresh the webview
              webviewView.webview.html = this._getHtmlForWebview();
              outputChannel.appendLine('Webview refreshed after logout');
            } catch (error) {
              outputChannel.appendLine(`Error during logout: ${error}`);
            }
            break;
          }
          case 'checkAuthStatus': {
            outputChannel.appendLine('Checking auth status');
            webviewGlobal?.postMessage({ 
              type: 'auth-status', 
              isLoggedIn: isLoggedIn
            });
            break;
          }
          default:
            outputChannel.appendLine(`Unknown command: ${message.command}`);
        }
      }
    );

    webviewView.webview.html = this._getHtmlForWebview();
    outputChannel.appendLine('Webview HTML content set');
  }

  private _getHtmlForWebview() {
    outputChannel.appendLine('Generating HTML for webview');
    outputChannel.appendLine(`Current login state: ${isLoggedIn ? 'logged in' : 'not logged in'}`);
    
    const loginButtonState = isLoggedIn ? 'display: none;' : '';
    const loggedInState = isLoggedIn ? '' : 'display: none;';
    
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ChartSmith</title>
        <style>
          body {
            padding: 10px;
            margin: 0;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
          }
          h1 {
            text-align: center;
            margin-top: 20px;
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 2px;
            margin: 10px auto;
            display: block;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .logged-in-info {
            margin-top: 20px;
            text-align: center;
          }
          .logout-button {
            margin-top: 20px;
            font-size: 12px;
            padding: 4px 8px;
            opacity: 0.8;
          }
          .auth-status {
            font-size: 12px;
            text-align: center;
            margin-top: 30px;
            color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
        <h1>ChartSmith</h1>
        
        <div id="login-container" style="${loginButtonState}">
          <p style="text-align: center;">Please log in to use ChartSmith</p>
          <button id="login-button">Login</button>
        </div>
        
        <div id="logged-in-container" style="${loggedInState}">
          <div class="logged-in-info">
            <p>You are logged in to ChartSmith!</p>
            <p>You can now use ChartSmith to work with your Helm charts.</p>
            <button id="logout-button" class="logout-button">Logout</button>
          </div>
        </div>
        
        <div class="auth-status" id="auth-status"></div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            const loginButton = document.getElementById('login-button');
            const logoutButton = document.getElementById('logout-button');
            const loginContainer = document.getElementById('login-container');
            const loggedInContainer = document.getElementById('logged-in-container');
            const authStatus = document.getElementById('auth-status');
            
            console.log('ChartSmith webview initialized');
            
            // Initialize by checking auth status
            vscode.postMessage({
              command: 'checkAuthStatus'
            });
            
            // Login button click handler
            loginButton?.addEventListener('click', () => {
              console.log('Login button clicked');
              authStatus.textContent = 'Logging in...';
              vscode.postMessage({
                command: 'login'
              });
            });
            
            // Logout button click handler
            logoutButton?.addEventListener('click', () => {
              console.log('Logout button clicked');
              vscode.postMessage({
                command: 'logout'
              });
            });
            
            window.addEventListener('message', event => {
              const message = event.data;
              console.log('Received message:', message);
              
              if (message.type === 'auth-success') {
                console.log('Auth success! Updating UI');
                loginContainer.style.display = 'none';
                loggedInContainer.style.display = 'block';
                authStatus.textContent = 'Authentication successful!';
              } else if (message.type === 'auth-logout') {
                console.log('Logged out! Updating UI');
                loginContainer.style.display = 'block';
                loggedInContainer.style.display = 'none';
                authStatus.textContent = 'Logged out successfully';
              } else if (message.type === 'auth-status') {
                console.log('Auth status update:', message.isLoggedIn);
                if (message.isLoggedIn) {
                  loginContainer.style.display = 'none';
                  loggedInContainer.style.display = 'block';
                  authStatus.textContent = 'You are authenticated with ChartSmith';
                } else {
                  loginContainer.style.display = 'block';
                  loggedInContainer.style.display = 'none';
                  authStatus.textContent = 'Not logged in';
                }
              }
            });
          }())
        </script>
      </body>
      </html>`;
  }
}

// Helper function to get the authentication token
// This can be called from other parts of your extension when you need to make API calls
export async function getAuthToken(): Promise<string | undefined> {
  // First check if we have it in memory
  if (authData && authData.token) {
    return authData.token;
  }
  
  // If not in memory but we're supposed to be logged in, try to get it from storage
  if (isLoggedIn) {
    try {
      const token = await secretStorage.get(AUTH_TOKEN_KEY);
      if (token) {
        return token;
      }
    } catch (error) {
      outputChannel.appendLine(`Error retrieving token from storage: ${error}`);
    }
  }
  
  // Not logged in or token not found
  return undefined;
}

// Helper function to get the API endpoint
export async function getApiEndpoint(): Promise<string | undefined> {
  // First check if we have it in memory
  if (authData && authData.apiEndpoint) {
    return authData.apiEndpoint;
  }
  
  // If not in memory but we're supposed to be logged in, try to get it from storage
  if (isLoggedIn) {
    try {
      const endpoint = await secretStorage.get(API_ENDPOINT_KEY);
      if (endpoint) {
        return endpoint;
      }
    } catch (error) {
      outputChannel.appendLine(`Error retrieving API endpoint from storage: ${error}`);
    }
  }
  
  // Not logged in or endpoint not found
  return undefined;
}

// Helper function to check if user is authenticated
export function isAuthenticated(): boolean {
  return isLoggedIn;
}

export function deactivate() {
  outputChannel.appendLine('Extension deactivating');
  if (authServer) {
    outputChannel.appendLine('Closing auth server');
    authServer.close();
    authServer = null;
  }
}