import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import { AuthData, GlobalState } from '../../types';
import { 
  AUTH_TOKEN_KEY, 
  API_ENDPOINT_KEY, 
  PUSH_ENDPOINT_KEY, 
  USER_ID_KEY, 
  WWW_ENDPOINT_KEY 
} from '../../constants';

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
}

export async function getAuthToken(): Promise<string | undefined> {
  const token = await secretStorage.get(AUTH_TOKEN_KEY);
  return token;
}

export async function getApiEndpoint(): Promise<string | undefined> {
  const endpoint = await secretStorage.get(API_ENDPOINT_KEY);
  return endpoint;
}

export async function getPushEndpoint(): Promise<string | undefined> {
  const endpoint = await secretStorage.get(PUSH_ENDPOINT_KEY);
  return endpoint;
}

export async function getUserId(): Promise<string | undefined> {
  const userId = await secretStorage.get(USER_ID_KEY);
  return userId;
}

export async function getWwwEndpoint(): Promise<string | undefined> {
  const endpoint = await secretStorage.get(WWW_ENDPOINT_KEY);
  return endpoint;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

export async function loadAuthData(): Promise<AuthData | null> {
  const token = await getAuthToken();
  const apiEndpoint = await getApiEndpoint();
  const pushEndpoint = await getPushEndpoint();
  const userId = await getUserId();
  const wwwEndpoint = await getWwwEndpoint();

  if (!token || !apiEndpoint || !userId) {
    return null;
  }

  globalState.authData = {
    token,
    apiEndpoint,
    pushEndpoint: pushEndpoint || '',
    userId,
    wwwEndpoint: wwwEndpoint || ''
  };

  globalState.isLoggedIn = true;
  return globalState.authData;
}

export async function saveAuthData(data: AuthData): Promise<void> {
  // Only convert HTTP to HTTPS for non-localhost URLs
  const isApiLocalhost = new URL(data.apiEndpoint).hostname === 'localhost' || 
                         new URL(data.apiEndpoint).hostname === '127.0.0.1';
  const apiEndpoint = !isApiLocalhost && data.apiEndpoint.startsWith('http:') 
    ? data.apiEndpoint.replace('http:', 'https:') 
    : data.apiEndpoint;
  
  let pushEndpoint = data.pushEndpoint;
  if (pushEndpoint) {
    const isPushLocalhost = new URL(pushEndpoint).hostname === 'localhost' || 
                           new URL(pushEndpoint).hostname === '127.0.0.1';
    pushEndpoint = !isPushLocalhost && pushEndpoint.startsWith('http:')
      ? pushEndpoint.replace('http:', 'https:')
      : pushEndpoint;
  }
  
  let wwwEndpoint = data.wwwEndpoint;
  if (wwwEndpoint) {
    const isWwwLocalhost = new URL(wwwEndpoint).hostname === 'localhost' || 
                          new URL(wwwEndpoint).hostname === '127.0.0.1';
    wwwEndpoint = !isWwwLocalhost && wwwEndpoint.startsWith('http:')
      ? wwwEndpoint.replace('http:', 'https:')
      : wwwEndpoint;
  }
  
  // Store the sanitized data
  await secretStorage.store(AUTH_TOKEN_KEY, data.token);
  await secretStorage.store(API_ENDPOINT_KEY, apiEndpoint);
  
  if (pushEndpoint) {
    await secretStorage.store(PUSH_ENDPOINT_KEY, pushEndpoint);
  }
  
  await secretStorage.store(USER_ID_KEY, data.userId);
  
  if (wwwEndpoint) {
    await secretStorage.store(WWW_ENDPOINT_KEY, wwwEndpoint);
  }

  // Update the global state with sanitized data
  globalState.authData = {
    ...data,
    apiEndpoint,
    pushEndpoint: pushEndpoint || '',
    wwwEndpoint: wwwEndpoint || ''
  };
  
  globalState.isLoggedIn = true;
}

export function clearAuthData(): Promise<void> {
  globalState.authData = null;
  globalState.isLoggedIn = false;
  
  return Promise.all([
    secretStorage.delete(AUTH_TOKEN_KEY),
    secretStorage.delete(API_ENDPOINT_KEY),
    secretStorage.delete(PUSH_ENDPOINT_KEY),
    secretStorage.delete(USER_ID_KEY),
    secretStorage.delete(WWW_ENDPOINT_KEY)
  ]).then(() => {});
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
        console.log('Handling OPTIONS request (CORS preflight)');
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
            console.log(`Received data: ${body}`);
            const parsedData = JSON.parse(body);
            
            // Extract the auth data
            let tokenValue = null;
            let apiEndpointValue = null;
            let pushEndpointValue = null;
            let userIdValue = null;
            let wwwEndpointValue = null;
            
            if (parsedData.token) {
              // Check if token is an object with a token property
              if (typeof parsedData.token === 'object' && parsedData.token.token) {
                tokenValue = parsedData.token.token;
              } else if (typeof parsedData.token === 'string') {
                tokenValue = parsedData.token;
              }
            }
            
            if (parsedData.apiEndpoint) {
              apiEndpointValue = parsedData.apiEndpoint;
            }
            
            if (parsedData.pushEndpoint) {
              pushEndpointValue = parsedData.pushEndpoint;
            }
            
            if (parsedData.userId) {
              userIdValue = parsedData.userId;
            }
            
            if (parsedData.wwwEndpoint) {
              wwwEndpointValue = parsedData.wwwEndpoint;
            }
            
            if (tokenValue && apiEndpointValue && userIdValue) {
              const authData: AuthData = {
                token: tokenValue,
                apiEndpoint: apiEndpointValue,
                pushEndpoint: pushEndpointValue || '',
                userId: userIdValue,
                wwwEndpoint: wwwEndpointValue || ''
              };
              
              await saveAuthData(authData);
              
              res.writeHead(200);
              res.end(JSON.stringify({ success: true }));
              
              if (globalState.authServer) {
                globalState.authServer.close();
                globalState.authServer = null;
              }
              
              resolve(authData.token);
            } else {
              res.writeHead(400);
              res.end(JSON.stringify({ success: false, error: 'Missing authentication data' }));
            }
          } catch (error) {
            console.error(`Error parsing JSON: ${error}`);
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
          }
        });
        return;
      }
      
      // Handle GET requests with query parameters
      const parsedUrl = url.parse(req.url, true);
      const query = parsedUrl.query;
      
      if (req.method === 'GET' && parsedUrl.pathname === '/auth' && query.token && query.apiEndpoint && query.userId) {
        const authData: AuthData = {
          token: query.token as string,
          apiEndpoint: query.apiEndpoint as string,
          pushEndpoint: (query.pushEndpoint as string) || '',
          userId: query.userId as string,
          wwwEndpoint: (query.wwwEndpoint as string) || ''
        };
        
        await saveAuthData(authData);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authentication successful!</h1><p>You can close this window now.</p><script>window.close();</script></body></html>');
        
        if (globalState.authServer) {
          globalState.authServer.close();
          globalState.authServer = null;
        }
        
        resolve(authData.token);
      } else {
        res.writeHead(400);
        res.end('Bad request');
      }
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
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}