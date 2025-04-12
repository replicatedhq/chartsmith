import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import * as url from 'url';
import { Centrifuge } from 'centrifuge';
import WebSocket = require('ws');

// Interface for storing workspace mapping information
interface WorkspaceMapping {
  localPath: string;       // Local directory path
  workspaceId: string;     // ChartSmith workspace ID
  lastUpdated: string;     // Timestamp of last update
}

interface AuthData {
  token: string;
  apiEndpoint: string;
  pushEndpoint: string;
  userId: string;
  wwwEndpoint: string;
}

// Connection status for Centrifugo
enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'  // Added reconnecting state
}

// Reconnection parameters
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | null = null;

let authData: AuthData | null = null;
let isLoggedIn = false;
let authServer: http.Server | null = null;
let webviewGlobal: vscode.Webview | null = null;
let outputChannel: vscode.OutputChannel;
let secretStorage: vscode.SecretStorage;
let context: vscode.ExtensionContext;
let pushToken: string | null = null; // Session-specific push token
let centrifuge: Centrifuge | null = null; // Centrifugo client
let connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED; // Connection status

// Storage keys
const AUTH_TOKEN_KEY = 'chartsmith.authToken';
const API_ENDPOINT_KEY = 'chartsmith.apiEndpoint';
const PUSH_ENDPOINT_KEY = 'chartsmith.pushEndpoint';
const USER_ID_KEY = 'chartsmith.userId';
const WWW_ENDPOINT_KEY = 'chartsmith.wwwEndpoint';
const WORKSPACE_MAPPINGS_KEY = 'chartsmith.workspaceMappings'; // Used for global state

export async function activate(extensionContext: vscode.ExtensionContext) {
  context = extensionContext;
  outputChannel = vscode.window.createOutputChannel('ChartSmith');
  context.subscriptions.push(outputChannel);
  secretStorage = context.secrets;
  
  outputChannel.appendLine('ChartSmith extension activated');
  
  // Check if we have stored credentials
  try {
    const storedToken = await secretStorage.get(AUTH_TOKEN_KEY);
    const storedApiEndpoint = await secretStorage.get(API_ENDPOINT_KEY);
    const storedPushEndpoint = await secretStorage.get(PUSH_ENDPOINT_KEY);
    const storedUserId = await secretStorage.get(USER_ID_KEY);
    const storedWwwEndpoint = await secretStorage.get(WWW_ENDPOINT_KEY);
    
    if (storedToken && storedApiEndpoint) {
      outputChannel.appendLine('Found stored authentication data');
      authData = { 
        token: storedToken,
        apiEndpoint: storedApiEndpoint,
        pushEndpoint: storedPushEndpoint || '', // Use empty string if not found
        userId: storedUserId || '', // Use empty string if not found
        wwwEndpoint: storedWwwEndpoint || '' // Use empty string if not found
      };
      isLoggedIn = true;
      outputChannel.appendLine(`API endpoint: ${storedApiEndpoint}`);
      if (storedPushEndpoint) {
        outputChannel.appendLine(`Push endpoint: ${storedPushEndpoint}`);
      } else {
        outputChannel.appendLine('No push endpoint found (older login)');
      }
      if (storedUserId) {
        outputChannel.appendLine(`User ID: ${storedUserId}`);
      } else {
        outputChannel.appendLine('No user ID found (older login)');
      }
      if (storedWwwEndpoint) {
        outputChannel.appendLine(`WWW endpoint: ${storedWwwEndpoint}`);
      } else {
        outputChannel.appendLine('No WWW endpoint found (older login)');
      }
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
          let pushEndpointValue = null;
          let userIdValue = null;
          let wwwEndpointValue = null;
          
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
          
          // Extract Push endpoint
          if (parsedData.pushEndpoint) {
            pushEndpointValue = parsedData.pushEndpoint;
            outputChannel.appendLine(`Found push endpoint: ${pushEndpointValue}`);
          }
          
          // Extract User ID
          if (parsedData.userId) {
            userIdValue = parsedData.userId;
            outputChannel.appendLine(`Found user ID: ${userIdValue}`);
          }
          
          // Extract WWW endpoint
          if (parsedData.wwwEndpoint) {
            wwwEndpointValue = parsedData.wwwEndpoint;
            outputChannel.appendLine(`Found WWW endpoint: ${wwwEndpointValue}`);
          }
          
          if (tokenValue && apiEndpointValue) {
            outputChannel.appendLine('Valid auth data found in response');
            outputChannel.appendLine(`API endpoint: ${apiEndpointValue}`);
            
            // Store the auth data in memory
            authData = { 
              token: tokenValue,
              apiEndpoint: apiEndpointValue,
              pushEndpoint: pushEndpointValue || '', // Use empty string if not provided
              userId: userIdValue || '', // Use empty string if not provided
              wwwEndpoint: wwwEndpointValue || '' // Use empty string if not provided
            };
            isLoggedIn = true;
            
            // Store auth data in secure storage
            try {
              await secretStorage.store(AUTH_TOKEN_KEY, tokenValue);
              await secretStorage.store(API_ENDPOINT_KEY, apiEndpointValue);
              if (pushEndpointValue) {
                await secretStorage.store(PUSH_ENDPOINT_KEY, pushEndpointValue);
              }
              if (userIdValue) {
                await secretStorage.store(USER_ID_KEY, userIdValue);
                outputChannel.appendLine(`Stored user ID: ${userIdValue}`);
              }
              if (wwwEndpointValue) {
                await secretStorage.store(WWW_ENDPOINT_KEY, wwwEndpointValue);
                outputChannel.appendLine(`Stored WWW endpoint: ${wwwEndpointValue}`);
              }
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
              await secretStorage.delete(PUSH_ENDPOINT_KEY); // Also delete push endpoint
              await secretStorage.delete(USER_ID_KEY);
              await secretStorage.delete(WWW_ENDPOINT_KEY);
              outputChannel.appendLine('Auth data removed from secure storage');
              
              // Clear workspace mappings
              context.globalState.update(WORKSPACE_MAPPINGS_KEY, []);
              outputChannel.appendLine('Workspace mappings cleared');
              
              // Update the state
              authData = null;
              isLoggedIn = false;
              
              // Disconnect from Centrifugo if connected
              if (centrifuge) {
                outputChannel.appendLine('Disconnecting from Centrifugo during logout');
                disconnectFromCentrifugo();
              }
              
              // Clear push token
              pushToken = null;
              
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
          case 'testConnection': {
            outputChannel.appendLine('Test connection command received');
            
            // Toggle through connection states for testing
            if (connectionStatus === ConnectionStatus.DISCONNECTED) {
              forceConnectionStatus(ConnectionStatus.CONNECTING);
            } else if (connectionStatus === ConnectionStatus.CONNECTING) {
              forceConnectionStatus(ConnectionStatus.CONNECTED);
            } else {
              forceConnectionStatus(ConnectionStatus.DISCONNECTED);
            }
            
            // Show message in output
            outputChannel.appendLine(`Connection status toggled to: ${connectionStatus}`);
            outputChannel.show();
            break;
          }
          case 'createChart': {
            outputChannel.appendLine('Create chart command received');
            // For now, just show a notification since we'll implement this later
            vscode.window.showInformationMessage('Create new Helm chart feature coming soon!');
            break;
          }
          case 'uploadChart': {
            // Log the button press
            if (message.log) {
              outputChannel.appendLine(message.log);
            }
            outputChannel.appendLine('Upload chart command received');
            outputChannel.show();
            
            // Get all folders in the workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
              outputChannel.appendLine('No workspace folders found');
              vscode.window.showErrorMessage('Please open a folder containing Helm charts.');
              break;
            }
            
            // List all directories in the workspace to find potential charts
            this.findHelmChartDirectories(workspaceFolders).then(chartDirectories => {
              if (chartDirectories.length === 0) {
                outputChannel.appendLine('No Helm charts found in workspace');
                vscode.window.showErrorMessage('No Helm charts found in the workspace. Charts must contain a Chart.yaml file.');
                return;
              }
              
              // Create quick pick items with relative paths for better display
              const quickPickItems = chartDirectories.map(dir => {
                let relativePath = dir.path;
                for (const folder of workspaceFolders) {
                  if (relativePath.startsWith(folder.uri.fsPath)) {
                    relativePath = relativePath.replace(folder.uri.fsPath, folder.name);
                    break;
                  }
                }
                return {
                  label: relativePath,
                  description: `Chart: ${dir.chartName || 'Unknown'}`,
                  detail: dir.path,
                };
              });
              
              // Show quick pick to select a chart directory
              vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select a Helm chart to upload to ChartSmith',
                ignoreFocusOut: true,
              }).then(selection => {
                if (!selection) {
                  outputChannel.appendLine('Chart selection cancelled');
                  return;
                }
                
                const chartDir = selection.detail;
                outputChannel.appendLine(`Selected chart directory: ${chartDir}`);
                
                // Create temporary tarball of the chart
                this.createChartTarball(chartDir, selection.description?.split(': ')[1] || 'chart')
                  .then(async tarballInfo => {
                    if (tarballInfo) {
                      const { path, size } = tarballInfo;
                      outputChannel.appendLine(`Created chart tarball: ${path}`);
                      outputChannel.appendLine(`Tarball size: ${this.formatFileSize(size)}`);
                      
                      // Show an information message that upload is in progress
                      vscode.window.showInformationMessage(`Uploading chart to ChartSmith (${this.formatFileSize(size)})...`);
                      
                      try {
                        // Get API endpoint and token
                        const token = await getAuthToken();
                        const apiEndpoint = await getApiEndpoint();
                        
                        outputChannel.appendLine(`Auth check: token ${token ? 'found' : 'missing'}, API endpoint ${apiEndpoint ? 'found' : 'missing'}`);
                        
                        if (!token || !apiEndpoint) {
                          outputChannel.appendLine('ERROR: Authentication data not found');
                          vscode.window.showErrorMessage('Authentication data not found. Please log in again.');
                          throw new Error('Authentication data not found. Please log in again.');
                        }
                        
                        // Force show the output channel to help with debugging
                        outputChannel.show();
                        
                        // Construct the upload URL, being careful with slashes
                        const uploadUrl = this.constructApiUrl(apiEndpoint, 'upload-chart');
                        outputChannel.appendLine(`Uploading chart to: ${uploadUrl}`);
                        
                        // Log the token (partially masked for security)
                        if (token) {
                          const maskedToken = token.length > 8 
                            ? `${token.substring(0, 4)}...${token.substring(token.length - 4)}`
                            : '********';
                          outputChannel.appendLine(`Using authentication token: ${maskedToken}`);
                          outputChannel.appendLine(`Token length: ${token.length} characters`);
                        }
                        
                        // Upload the chart
                        const uploadResponse = await this.uploadChartToServer(uploadUrl, path, token);
                        
                        // Log basic response information
                        outputChannel.appendLine(`Chart upload successful`);
                        
                        if (typeof uploadResponse === 'object') {
                          // Log chart ID if available
                          if (uploadResponse.id) {
                            outputChannel.appendLine(`Chart ID: ${uploadResponse.id}`);
                          }
                          
                          // Extract the workspaceId from the response and save the mapping
                          if (uploadResponse.workspaceId) {
                            outputChannel.appendLine(`Workspace ID: ${uploadResponse.workspaceId}`);
                            
                            // Save the mapping between local directory and ChartSmith workspace
                            this.saveWorkspaceMapping(chartDir, uploadResponse.workspaceId);
                            
                            const allMappings = this.getAllWorkspaceMappings();
                            outputChannel.appendLine(`Total workspace mappings: ${allMappings.length}`);
                          } else {
                            outputChannel.appendLine(`Warning: No workspaceId received from server`);
                          }
                        } else {
                          outputChannel.appendLine(`Response received (non-object type)`);
                        }
                        
                        // Show success message with option to view details
                        vscode.window.showInformationMessage(
                          `Chart uploaded successfully! (${this.formatFileSize(size)})`, 
                          'View Details'
                        ).then(selection => {
                          if (selection === 'View Details') {
                            outputChannel.show();
                          }
                        });
                      } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        outputChannel.appendLine(`Error uploading chart: ${errorMessage}`);
                        vscode.window.showErrorMessage(`Failed to upload chart: ${errorMessage}`);
                      } finally {
                        // Clean up the temporary file
                        this.deleteFile(path);
                      }
                    }
                  })
                  .catch(error => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    outputChannel.appendLine(`Error creating chart tarball: ${errorMessage}`);
                    vscode.window.showErrorMessage(`Failed to package chart: ${errorMessage}`);
                  });
              });
            }).catch(error => {
              const errorMessage = error instanceof Error ? error.message : String(error);
              outputChannel.appendLine(`Error finding Helm charts: ${errorMessage}`);
              vscode.window.showErrorMessage('Error scanning for Helm charts.');
            });
            
            break;
          }
          case 'downloadChart': {
            outputChannel.appendLine('Download chart command received');
            // For now, just show a notification since we'll implement this later
            vscode.window.showInformationMessage('Import chart from ChartSmith feature coming soon!');
            break;
          }
          case 'openInChartSmith': {
            const workspaceId = message.workspaceId;
            if (workspaceId) {
              outputChannel.appendLine(`Opening workspace in ChartSmith: ${workspaceId}`);
              
              // Get the WWW endpoint
              getWwwEndpoint().then(wwwEndpoint => {
                // Use wwwEndpoint if available, otherwise fall back to chartsmith.ai
                const baseUrl = wwwEndpoint || 'https://chartsmith.ai';
                outputChannel.appendLine(`Using WWW endpoint: ${baseUrl}`);
                
                // Construct the URL
                const chartsmithUrl = `${baseUrl}/workspace/${workspaceId}`;
                outputChannel.appendLine(`Opening URL: ${chartsmithUrl}`);
                
                // Open in default browser
                vscode.env.openExternal(vscode.Uri.parse(chartsmithUrl));
              }).catch(error => {
                outputChannel.appendLine(`Error getting WWW endpoint: ${error}`);
                // Fall back to chartsmith.ai if there's an error
                const chartsmithUrl = `https://chartsmith.ai/workspace/${workspaceId}`;
                vscode.env.openExternal(vscode.Uri.parse(chartsmithUrl));
              });
            } else {
              outputChannel.appendLine('No workspace ID provided');
              vscode.window.showErrorMessage('No workspace ID available to open in ChartSmith');
            }
            break;
          }
          case 'logError': {
            // Log errors from the webview
            const errorText = message.text;
            outputChannel.appendLine(`ERROR FROM WEBVIEW: ${errorText}`);
            outputChannel.show(); // Show the output channel to make the error visible
            break;
          }
          case 'logDebug': {
            // Log debug information from the webview
            const debugText = message.text;
            outputChannel.appendLine(`DEBUG FROM WEBVIEW: ${debugText}`);
            break;
          }
          case 'sendChatMessage': {
            const messageText = message.text;
            outputChannel.appendLine(`Chat message received: ${messageText}`);
            
            // Process the message and get a response
            this.handleChatMessage(messageText, webviewView.webview);
            break;
          }
          case 'checkWorkspaceMappings': {
            outputChannel.appendLine('Checking workspace mappings');
            
            // Get all workspace mappings
            const mappings = this.getAllWorkspaceMappings();
            const hasMappings = mappings.length > 0;
            
            outputChannel.appendLine(`Found ${mappings.length} workspace mappings`);
            
            // Get workspace folders information to help with relative paths
            const workspaceFolders = vscode.workspace.workspaceFolders || [];
            const workspaceFoldersInfo = workspaceFolders.map(folder => ({
              name: folder.name,
              path: folder.uri.fsPath
            }));

            // Update webview with mapping status and workspace folders
            webviewView.webview.postMessage({
              type: 'workspaceMappingsUpdate',
              hasMappings,
              mappings,
              workspaceFolders: workspaceFoldersInfo
            });
            
            // If we have mappings, fetch messages for the first workspace
            if (hasMappings && mappings.length > 0) {
              const firstMapping = mappings[0];
              outputChannel.appendLine(`Loading messages for workspace: ${firstMapping.workspaceId}`);
              
              // Fetch push token for this session
              fetchPushToken().then(token => {
                if (token) {
                  pushToken = token;
                  outputChannel.appendLine(`Stored push token for session`);
                  
                  // Connect to Centrifugo using the push token (JWT)
                  // The pushToken contains the JWT for authentication
                  // The pushEndpoint from authData is where the WebSocket server is running
                  const pushEndpoint = authData?.pushEndpoint;
                  if (pushEndpoint) {
                    connectToCentrifugo(pushEndpoint, token);
                  } else {
                    outputChannel.appendLine(`Cannot connect to Centrifugo: missing push endpoint`);
                  }
                }
              }).catch(error => {
                outputChannel.appendLine(`Error fetching push token: ${error}`);
              });
              
              // Fetch messages for this workspace
              this.fetchWorkspaceMessages(firstMapping.workspaceId, webviewView.webview);
            }
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

  /**
   * Save workspace mapping between local directory and ChartSmith workspace
   * @param localPath Local directory path
   * @param workspaceId ChartSmith workspace ID
   */
  private saveWorkspaceMapping(localPath: string, workspaceId: string): void {
    try {
      // Get current mappings or initialize empty array
      const currentMappings: WorkspaceMapping[] = context.globalState.get(WORKSPACE_MAPPINGS_KEY, []);
      
      // Check if mapping already exists for this local path
      const existingIndex = currentMappings.findIndex(mapping => mapping.localPath === localPath);
      
      // Create new mapping object
      const newMapping: WorkspaceMapping = {
        localPath,
        workspaceId,
        lastUpdated: new Date().toISOString()
      };
      
      // Update or add the mapping
      if (existingIndex >= 0) {
        currentMappings[existingIndex] = newMapping;
        outputChannel.appendLine(`Updated workspace mapping for ${localPath} -> ${workspaceId}`);
      } else {
        currentMappings.push(newMapping);
        outputChannel.appendLine(`Added new workspace mapping: ${localPath} -> ${workspaceId}`);
      }
      
      // Save back to global state
      context.globalState.update(WORKSPACE_MAPPINGS_KEY, currentMappings);
      
      // Show notification with path to make it clear what was linked
      vscode.window.showInformationMessage(`Linked local chart at ${path.basename(localPath)} with ChartSmith workspace`);
      
      // If we have a webview reference, update it to show the chat interface
      if (webviewGlobal) {
        // Get workspace folders information to help with relative paths
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const workspaceFoldersInfo = workspaceFolders.map(folder => ({
          name: folder.name,
          path: folder.uri.fsPath
        }));

        webviewGlobal.postMessage({
          type: 'workspaceMappingsUpdate',
          hasMappings: true,
          mappings: currentMappings,
          workspaceFolders: workspaceFoldersInfo
        });
        outputChannel.appendLine('Updated webview with new workspace mapping status');
        
        // Fetch push token for this session
        fetchPushToken().then(token => {
          if (token) {
            pushToken = token;
            outputChannel.appendLine(`Stored push token for session`);
            
            // Connect to Centrifugo using the push token (JWT)
            // The pushToken contains the JWT for authentication
            // The pushEndpoint from authData is where the WebSocket server is running
            const pushEndpoint = authData?.pushEndpoint;
            if (pushEndpoint) {
              connectToCentrifugo(pushEndpoint, token);
            } else {
              outputChannel.appendLine(`Cannot connect to Centrifugo: missing push endpoint`);
            }
          }
        }).catch(error => {
          outputChannel.appendLine(`Error fetching push token: ${error}`);
        });
        
        // Fetch messages for this workspace
        this.fetchWorkspaceMessages(workspaceId, webviewGlobal);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Error saving workspace mapping: ${errorMessage}`);
    }
  }
  
  /**
   * Get workspace mapping for a local directory
   * @param localPath Local directory path to find mapping for
   * @returns The workspace mapping if found, undefined otherwise
   */
  private getWorkspaceMapping(localPath: string): WorkspaceMapping | undefined {
    try {
      const mappings: WorkspaceMapping[] = context.globalState.get(WORKSPACE_MAPPINGS_KEY, []);
      return mappings.find(mapping => mapping.localPath === localPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Error getting workspace mapping: ${errorMessage}`);
      return undefined;
    }
  }
  
  /**
   * Get all workspace mappings
   * @returns Array of all workspace mappings
   */
  private getAllWorkspaceMappings(): WorkspaceMapping[] {
    return context.globalState.get(WORKSPACE_MAPPINGS_KEY, []);
  }
  
  /**
   * Remove a workspace mapping
   * @param localPath Local directory path to remove mapping for
   */
  private removeWorkspaceMapping(localPath: string): void {
    try {
      const mappings: WorkspaceMapping[] = context.globalState.get(WORKSPACE_MAPPINGS_KEY, []);
      const updatedMappings = mappings.filter(mapping => mapping.localPath !== localPath);
      
      if (mappings.length !== updatedMappings.length) {
        context.globalState.update(WORKSPACE_MAPPINGS_KEY, updatedMappings);
        outputChannel.appendLine(`Removed workspace mapping for ${localPath}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Error removing workspace mapping: ${errorMessage}`);
    }
  }
  
  /**
   * Fetch messages for a workspace from the API
   * @param workspaceId The workspace ID to fetch messages for
   * @param webview The webview to update with messages
   */
  private async fetchWorkspaceMessages(workspaceId: string, webview: vscode.Webview): Promise<void> {
    try {
      outputChannel.appendLine(`Fetching messages for workspace: ${workspaceId}`);
      
      // Get auth token and API endpoint
      const token = await getAuthToken();
      const apiEndpoint = await getApiEndpoint();
      
      if (!token || !apiEndpoint) {
        throw new Error('Authentication data not found. Please log in again.');
      }
      
      // Construct the API URL
      const messagesUrl = this.constructApiUrl(apiEndpoint, `workspace/${workspaceId}/messages`);
      outputChannel.appendLine(`Fetching messages from: ${messagesUrl}`);
      
      // Make the HTTP request to fetch messages
      return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(messagesUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        
        const options = {
          method: 'GET',
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.path,
          headers: {
            'Authorization': `Token ${token}`,
            'User-Agent': 'ChartSmith-VSCode-Extension'
          }
        };
        
        const req = (isHttps ? https : http).request(options, (res) => {
          let responseData = '';
          
          res.on('data', (chunk) => {
            responseData += chunk.toString();
          });
          
          res.on('end', () => {
            outputChannel.appendLine(`Response status: ${res.statusCode}`);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                // Parse response data
                const messages = JSON.parse(responseData);
                outputChannel.appendLine(`Received ${Array.isArray(messages) ? messages.length : 0} messages`);
                
                // Send messages to webview
                webview.postMessage({
                  type: 'messagesLoaded',
                  messages: messages
                });
                
                resolve();
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                outputChannel.appendLine(`Error parsing messages: ${errorMessage}`);
                reject(error);
              }
            } else {
              // Handle error responses
              let errorMessage = `Failed to fetch messages. Server returned status ${res.statusCode}`;
              
              try {
                const errorResponse = JSON.parse(responseData);
                if (errorResponse.error) {
                  errorMessage += `: ${errorResponse.error}`;
                }
              } catch (e) {
                errorMessage += `: ${responseData}`;
              }
              
              outputChannel.appendLine(errorMessage);
              reject(new Error(errorMessage));
            }
          });
        });
        
        req.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(`Error fetching messages: ${errorMessage}`);
          reject(error);
        });
        
        req.end();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Error in fetchWorkspaceMessages: ${errorMessage}`);
      
      // Don't throw the error up - we don't want to break the UI
      // Just inform the user that messages couldn't be loaded
      webview.postMessage({
        type: 'messagesError',
        error: errorMessage
      });
    }
  }
  
  /**
   * Handle a chat message from the user
   * @param message The message text from the user
   * @param webview The webview to send the response to
   */
  private async handleChatMessage(message: string, webview: vscode.Webview): Promise<void> {
    try {
      outputChannel.appendLine(`Processing chat message: ${message}`);
      
      // Get current workspace mappings
      const mappings = this.getAllWorkspaceMappings();
      if (!mappings || mappings.length === 0) {
        throw new Error('No workspace mapping found. Please upload a chart first.');
      }
      
      // Use the first workspace mapping (we only support one at the moment)
      const workspaceId = mappings[0].workspaceId;
      outputChannel.appendLine(`Using workspace ID: ${workspaceId}`);
      
      // Get auth token and API endpoint
      const token = await getAuthToken();
      const apiEndpoint = await getApiEndpoint();
      
      if (!token || !apiEndpoint) {
        throw new Error('Authentication data not found. Please log in again.');
      }
      
      // Construct the API URL for sending messages
      // Use singular 'message' not 'messages'
      const sendUrl = this.constructApiUrl(apiEndpoint, `workspace/${workspaceId}/message`);
      outputChannel.appendLine(`Sending message to: ${sendUrl}`);
      
      // Create the request to send the message
      return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(sendUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        
        // Prepare request options
        const options = {
          method: 'POST',
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.path,
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'ChartSmith-VSCode-Extension'
          }
        };
        
        // Create request
        const req = (isHttps ? https : http).request(options, (res) => {
          let responseData = '';
          
          res.on('data', (chunk) => {
            responseData += chunk.toString();
          });
          
          res.on('end', () => {
            outputChannel.appendLine(`========== CHAT API RESPONSE ==========`);
            outputChannel.appendLine(`Status code: ${res.statusCode}`);
            outputChannel.appendLine(`Raw response data: ${responseData}`);
            
            // Log headers
            const headersLog = Object.entries(res.headers).map(([key, value]) => `${key}: ${value}`).join('\n  ');
            outputChannel.appendLine(`Response headers:\n  ${headersLog}`);
            outputChannel.appendLine(`=======================================`);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                // Parse response data
                const responseJson = JSON.parse(responseData);
                
                // Log the full parsed response
                outputChannel.appendLine(`Parsed response: ${JSON.stringify(responseJson, null, 2)}`);
                
                // No need to extract response text - instead use the direct API response for chat messages
                // We'll let the Centrifugo updates handle the actual chat display
                
                // Store the message ID - we'll get updates via Centrifugo
                if (responseJson.id) {
                  outputChannel.appendLine(`Received message ID: ${responseJson.id}`);
                  
                  // Send initial message to UI if it has a prompt (even if response is null)
                  if (responseJson.prompt) {
                    webview.postMessage({
                      type: 'chatMessageUpdated',
                      message: responseJson
                    });
                    outputChannel.appendLine('Sent initial message to webview via chatMessageUpdated');
                  }
                } else {
                  // Legacy format fallback - shouldn't happen with new API
                  let responseText = "Waiting for response...";
                  
                  // Check various possible response formats
                  if (responseJson.response !== undefined) {
                    if (responseJson.response === null) {
                      responseText = "Waiting for response...";
                    } else if (typeof responseJson.response === 'string') {
                      responseText = responseJson.response;
                    } else if (typeof responseJson.response === 'object' && responseJson.response && responseJson.response.text) {
                      responseText = responseJson.response.text;
                    } else {
                      responseText = JSON.stringify(responseJson.response);
                    }
                  } else if (responseJson.message !== undefined) {
                    responseText = typeof responseJson.message === 'string' 
                      ? responseJson.message 
                      : JSON.stringify(responseJson.message);
                  } else if (responseJson.content !== undefined) {
                    responseText = typeof responseJson.content === 'string' 
                      ? responseJson.content 
                      : JSON.stringify(responseJson.content);
                  } else if (responseJson.text !== undefined) {
                    responseText = typeof responseJson.text === 'string' 
                      ? responseJson.text 
                      : JSON.stringify(responseJson.text);
                  } else {
                    // Fallback to stringifying the whole response
                    responseText = JSON.stringify(responseJson);
                  }
                  
                  // Send legacy response to the webview
                  webview.postMessage({ 
                    type: 'chatResponse', 
                    text: responseText 
                  });
                  outputChannel.appendLine('Sent legacy response to webview via chatResponse');
                }
                
                // No need to log responseText as it's handled differently now
                
                resolve();
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                outputChannel.appendLine(`Error parsing response: ${errorMessage}`);
                reject(error);
              }
            } else {
              // Handle error responses
              let errorMessage = `Failed to send message. Server returned status ${res.statusCode}`;
              
              try {
                const errorResponse = JSON.parse(responseData);
                if (errorResponse.error) {
                  errorMessage += `: ${errorResponse.error}`;
                }
              } catch (e) {
                errorMessage += `: ${responseData}`;
              }
              
              outputChannel.appendLine(errorMessage);
              reject(new Error(errorMessage));
            }
          });
        });
        
        req.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(`Error sending message: ${errorMessage}`);
          reject(error);
        });
        
        // Write message data - use 'prompt' as the key
        const messageData = JSON.stringify({
          prompt: message
        });
        
        outputChannel.appendLine(`Sending message with payload: ${messageData}`);
        req.write(messageData);
        req.end();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Error handling chat message: ${errorMessage}`);
      
      // Send an error response
      webview.postMessage({ 
        type: 'chatResponse', 
        text: `I'm sorry, I encountered an error: ${errorMessage}` 
      });
    }
  }
  
  private async findHelmChartDirectories(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<Array<{path: string, chartName?: string}>> {
    outputChannel.appendLine('------------ Searching for Helm charts in workspace... ------------');
    outputChannel.appendLine(`Number of workspace folders to search: ${workspaceFolders.length}`);
    
    const chartDirs: Array<{path: string, chartName?: string}> = [];
    
    // For each workspace folder, search for Chart.yaml files
    for (const folder of workspaceFolders) {
      outputChannel.appendLine(`\nSearching in workspace folder: ${folder.name} (${folder.uri.fsPath})`);
      
      try {
        // Find all Chart.yaml files in the workspace
        const pattern = new vscode.RelativePattern(folder, '**/Chart.yaml');
        outputChannel.appendLine(`Using search pattern: ${pattern.pattern}`);
        
        const exclude = '**/node_modules/**'; // Exclude node_modules
        outputChannel.appendLine(`Using exclude pattern: ${exclude}`);
        
        const chartFiles = await vscode.workspace.findFiles(pattern, exclude);
        
        outputChannel.appendLine(`Found ${chartFiles.length} potential chart file(s)`);
        
        // For each Chart.yaml file, get its directory and read the chart name
        for (const file of chartFiles) {
          outputChannel.appendLine(`\nProcessing chart file: ${file.fsPath}`);
          
          // Ensure we extract the directory correctly regardless of platform
          const dirPath = path.dirname(file.fsPath);
          outputChannel.appendLine(`Chart directory: ${dirPath}`);
          
          try {
            // Read Chart.yaml to get chart name
            outputChannel.appendLine(`Reading chart file contents...`);
            const document = await vscode.workspace.openTextDocument(file);
            const content = document.getText();
            
            // Extract chart name with a more robust regex
            const nameMatch = content.match(/^name:\s*(.+)$/m);
            const chartName = nameMatch ? nameMatch[1].trim() : undefined;
            
            chartDirs.push({ 
              path: dirPath, 
              chartName 
            });
            
            outputChannel.appendLine(`Chart name extracted: ${chartName || 'Unknown'}`);
            
            // Also extract version if available
            const versionMatch = content.match(/^version:\s*(.+)$/m);
            const version = versionMatch ? versionMatch[1].trim() : 'Unknown';
            outputChannel.appendLine(`Chart version: ${version}`);
            
            // Log directory contents to verify structure
            try {
              const dirContents = fs.readdirSync(dirPath);
              outputChannel.appendLine(`Directory contents (${dirContents.length} files):`);
              dirContents.forEach(item => {
                outputChannel.appendLine(`  - ${item}`);
              });
            } catch (err) {
              outputChannel.appendLine(`Error listing directory contents: ${err}`);
            }
          } catch (error) {
            outputChannel.appendLine(`Error reading chart file ${file.fsPath}: ${error}`);
            chartDirs.push({ path: dirPath });
          }
        }
      } catch (error) {
        outputChannel.appendLine(`Error searching workspace folder ${folder.name}: ${error instanceof Error ? error.message : String(error)}`);
        outputChannel.appendLine(`Error stack: ${error instanceof Error && error.stack ? error.stack : 'No stack available'}`);
      }
    }
    
    outputChannel.appendLine(`\n------------ Search complete. Found ${chartDirs.length} chart(s) ------------`);
    
    return chartDirs;
  }
  
  /**
   * Creates a tarball of a Helm chart
   * @param chartDir The directory containing the Helm chart
   * @param chartName The name of the chart (for the file name)
   * @returns Promise with tarball info (path and size) or null if failed
   */
  private async createChartTarball(chartDir: string, chartName: string): Promise<{ path: string, size: number } | null> {
    outputChannel.appendLine('\n========== Creating Chart Tarball ==========');
    outputChannel.appendLine(`Chart directory: ${chartDir}`);
    outputChannel.appendLine(`Chart name: ${chartName}`);
    
    try {
      // Verify the chart directory exists
      if (!fs.existsSync(chartDir)) {
        throw new Error(`Chart directory does not exist: ${chartDir}`);
      }
      
      // Create a safe chart name for the file (remove special characters)
      const safeChartName = chartName.replace(/[^a-zA-Z0-9_-]/g, '') || 'chart';
      outputChannel.appendLine(`Using safe chart name for file: ${safeChartName}`);
      
      // Create temporary directory
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chartsmith-'));
      outputChannel.appendLine(`Created temp directory: ${tempDir}`);
      
      const tarballPath = path.join(tempDir, `${safeChartName}.tgz`);
      outputChannel.appendLine(`Tarball will be created at: ${tarballPath}`);
      
      // Log chart directory contents
      outputChannel.appendLine('\nChart directory contents:');
      try {
        const dirContents = fs.readdirSync(chartDir);
        dirContents.forEach(item => {
          const itemPath = path.join(chartDir, item);
          const stats = fs.statSync(itemPath);
          outputChannel.appendLine(`  - ${item}${stats.isDirectory() ? '/' : ''}`);
        });
      } catch (err) {
        outputChannel.appendLine(`Error listing chart directory contents: ${err}`);
      }
      
      // Create tarball using tar command
      return new Promise((resolve, reject) => {
        outputChannel.appendLine('\nStarting tarball creation...');
        
        // Save current working directory
        const cwd = process.cwd();
        outputChannel.appendLine(`Current working directory: ${cwd}`);
        
        try {
          // Change to the parent directory
          const parentDir = path.dirname(chartDir);
          outputChannel.appendLine(`Changing to parent directory: ${parentDir}`);
          process.chdir(parentDir);
          
          // Create tarball with the chart directory as the root (no parent directories)
          // -C changes directory to the chart directory before creating the tarball
          // . means include everything in the current directory (which is the chart directory after -C)
          const tarCommand = `tar -czf "${tarballPath}" -C "${chartDir}" .`;
          outputChannel.appendLine(`Running tar command: ${tarCommand}`);
          
          child_process.exec(tarCommand, (error, stdout, stderr) => {
            try {
              // Change back to original directory first to avoid any further issues
              outputChannel.appendLine(`Returning to original directory: ${cwd}`);
              process.chdir(cwd);
              
              if (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                outputChannel.appendLine(`Tar command error: ${errorMessage}`);
                outputChannel.appendLine(`stderr: ${stderr}`);
                reject(new Error(`Failed to create tarball: ${errorMessage}`));
                return;
              }
              
              outputChannel.appendLine('Tar command completed successfully');
              
              // Verify the tarball was created
              if (!fs.existsSync(tarballPath)) {
                outputChannel.appendLine(`ERROR: Tarball file not found at expected location: ${tarballPath}`);
                reject(new Error('Tarball file not created'));
                return;
              }
              
              outputChannel.appendLine(`Tarball file created successfully: ${tarballPath}`);
              
              // List the contents of the tarball to verify its structure
              const listCommand = `tar -tvf "${tarballPath}"`;
              outputChannel.appendLine(`Running list command: ${listCommand}`);
              
              child_process.exec(listCommand, (listError, listStdout, listStderr) => {
                if (listError) {
                  outputChannel.appendLine(`Failed to list tarball contents: ${listError}`);
                  outputChannel.appendLine(`stderr: ${listStderr}`);
                } else {
                  outputChannel.appendLine(`Tarball contents:\n${listStdout}`);
                }
                
                // Get file size (still continue even if listing fails)
                try {
                  const stats = fs.statSync(tarballPath);
                  outputChannel.appendLine(`Tarball size: ${stats.size} bytes`);
                  resolve({ path: tarballPath, size: stats.size });
                } catch (statsError) {
                  const errorMessage = statsError instanceof Error ? statsError.message : String(statsError);
                  outputChannel.appendLine(`Error getting tarball stats: ${errorMessage}`);
                  reject(new Error(`Failed to get tarball stats: ${errorMessage}`));
                }
              });
            } catch (finalError) {
              outputChannel.appendLine(`Unexpected error in tar command callback: ${finalError}`);
              reject(new Error(`Unexpected error: ${finalError}`));
            }
          });
        } catch (chDirError) {
          // Make sure we restore the working directory
          try {
            process.chdir(cwd);
          } catch (restoreError) {
            outputChannel.appendLine(`Failed to restore working directory: ${restoreError}`);
          }
          
          outputChannel.appendLine(`Error changing directory: ${chDirError}`);
          reject(new Error(`Failed to change directory: ${chDirError}`));
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Error creating tarball: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }
      return null;
    }
  }
  
  /**
   * Formats a file size in bytes to a human-readable string
   * @param bytes File size in bytes
   * @returns Formatted file size string
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
  
  /**
   * Deletes a file
   * @param filePath Path to the file to delete
   */
  private deleteFile(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
      outputChannel.appendLine(`Deleted temporary file: ${filePath}`);
      
      // Try to remove parent directory if it's empty
      const dirPath = path.dirname(filePath);
      if (dirPath.includes('chartsmith-')) {
        const files = fs.readdirSync(dirPath);
        if (files.length === 0) {
          fs.rmdirSync(dirPath);
          outputChannel.appendLine(`Removed empty directory: ${dirPath}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Error deleting file ${filePath}: ${errorMessage}`);
    }
  }
  
  /**
   * Constructs an API URL from base endpoint and path, handling slashes correctly
   * @param baseUrl The base API endpoint
   * @param path The API path to append
   * @returns The complete API URL
   */
  private constructApiUrl(baseUrl: string, path: string): string {
    // Remove trailing slash from base URL if present
    const baseUrlNormalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Remove leading slash from path if present
    const pathNormalized = path.startsWith('/') ? path.slice(1) : path;
    
    // Combine with slash
    return `${baseUrlNormalized}/${pathNormalized}`;
  }
  
  /**
   * Uploads a chart tarball to the server
   * @param uploadUrl The URL to upload to
   * @param filePath The path to the chart tarball
   * @param token The authentication token
   * @returns Promise with the server response
   */
  private async uploadChartToServer(uploadUrl: string, filePath: string, token: string): Promise<any> {
    outputChannel.appendLine('\n========== Uploading Chart to Server ==========');
    outputChannel.appendLine(`Upload URL: ${uploadUrl}`);
    outputChannel.appendLine(`File path: ${filePath}`);
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      const error = new Error(`File does not exist: ${filePath}`);
      outputChannel.appendLine(`ERROR: ${error.message}`);
      return Promise.reject(error);
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    outputChannel.appendLine(`File size: ${stats.size} bytes (${this.formatFileSize(stats.size)})`);
    
    return new Promise((resolve, reject) => {
      try {
        const fileStream = fs.createReadStream(filePath);
        const fileName = path.basename(filePath);
        
        // Generate a boundary for multipart/form-data
        const boundary = `----ChartSmithFormBoundary${Date.now().toString(16)}`;
        
        // Parse the URL to determine protocol
        const parsedUrl = url.parse(uploadUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        
        outputChannel.appendLine(`Hostname: ${parsedUrl.hostname}, Path: ${parsedUrl.path}`);
        outputChannel.appendLine(`Protocol: ${isHttps ? 'HTTPS' : 'HTTP'}`);
        
        // Prepare request options
        const options = {
          method: 'POST',
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.path,
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'User-Agent': 'ChartSmith-VSCode-Extension'
          }
        };
        
        outputChannel.appendLine(`Preparing request with options: ${JSON.stringify({
          method: options.method,
          hostname: options.hostname,
          port: options.port,
          path: options.path
        })}`);
        
        outputChannel.appendLine(`Auth header: Token ${token.substring(0, 4)}...${token.substring(token.length - 4)}`);
        outputChannel.appendLine(`Uploading file with name: ${fileName}`);
        outputChannel.appendLine(`Upload form field name: file`);
        
        // Create request
        outputChannel.appendLine('Creating HTTP request...');
        const req = (isHttps ? https : http).request(options, (res) => {
          outputChannel.appendLine(`Server response received - Status: ${res.statusCode}`);
          outputChannel.appendLine(`Response headers: ${JSON.stringify(res.headers)}`);
          
          let responseData = '';
          
          res.on('data', (chunk) => {
            const chunkStr = chunk.toString();
            outputChannel.appendLine(`Received response chunk (${chunkStr.length} bytes)`);
            responseData += chunkStr;
          });
          
          res.on('end', () => {
            outputChannel.appendLine('Response received completely');
            
            // Log truncated response for debugging
            const loggedResponse = responseData.length > 500 
              ? responseData.substring(0, 500) + '...(truncated)'
              : responseData;
            outputChannel.appendLine(`Response body: ${loggedResponse}`);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              outputChannel.appendLine('Request successful (2xx status code)');
              
              try {
                // Try to parse as JSON first
                outputChannel.appendLine('Attempting to parse response as JSON...');
                const parsedResponse = JSON.parse(responseData);
                outputChannel.appendLine('Successfully parsed response as JSON');
                
                // Check if we have a workspaceId in the response
                if (parsedResponse.workspaceId) {
                  outputChannel.appendLine(`Found workspaceId in response: ${parsedResponse.workspaceId}`);
                } else {
                  outputChannel.appendLine('No workspaceId found in response');
                }
                
                resolve(parsedResponse);
              } catch (error: unknown) {
                // If response is not JSON, return as is
                if (error instanceof Error) {
                  outputChannel.appendLine(`Response is not valid JSON: ${error.message}`);
                } else {
                  outputChannel.appendLine(`Response is not valid JSON: Unknown error`);
                }
                resolve({ text: responseData });
              }
            } else {
              // For error responses, try to extract more details
              outputChannel.appendLine(`Error response with status code: ${res.statusCode}`);
              let errorMessage = `Server returned status ${res.statusCode}`;
              
              try {
                // Try to parse error response as JSON
                const errorResponse = JSON.parse(responseData);
                if (errorResponse.error) {
                  errorMessage += `: ${errorResponse.error}`;
                  outputChannel.appendLine(`Error detail from 'error' field: ${errorResponse.error}`);
                } else if (errorResponse.message) {
                  errorMessage += `: ${errorResponse.message}`;
                  outputChannel.appendLine(`Error detail from 'message' field: ${errorResponse.message}`);
                } else {
                  const errorJson = JSON.stringify(errorResponse);
                  errorMessage += `: ${errorJson}`;
                  outputChannel.appendLine(`Error detail (full JSON): ${errorJson}`);
                }
              } catch (e: unknown) {
                // If not JSON, use raw response
                errorMessage += `: ${responseData}`;
                if (e instanceof Error) {
                  outputChannel.appendLine(`Error response is not valid JSON: ${e.message}`);
                } else {
                  outputChannel.appendLine(`Error response is not valid JSON: Unknown error`);
                }
                outputChannel.appendLine(`Using raw response as error message`);
              }
              
              outputChannel.appendLine(`Rejecting with error: ${errorMessage}`);
              reject(new Error(errorMessage));
            }
          });
        });
        
        req.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(`HTTP request error: ${errorMessage}`);
          if (error instanceof Error && error.stack) {
            outputChannel.appendLine(`Error stack: ${error.stack}`);
          }
          reject(new Error(`Upload request failed: ${errorMessage}`));
        });
        
        outputChannel.appendLine('Setting up form data...');
        
        // Write multipart form data
        const boundaryBuffer = Buffer.from(`--${boundary}\r\n`);
        const endBoundaryBuffer = Buffer.from(`\r\n--${boundary}--\r\n`);
        
        // Write form field headers
        outputChannel.appendLine('Writing form field headers...');
        req.write(boundaryBuffer);
        req.write(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
        req.write(Buffer.from(`Content-Type: application/gzip\r\n\r\n`));
        
        // Set up file stream error handler before piping
        fileStream.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(`File stream error: ${errorMessage}`);
          reject(new Error(`File read error: ${errorMessage}`));
        });
        
        // Stream the file
        outputChannel.appendLine('Beginning to stream file...');
        let bytesSent = 0;
        
        fileStream.on('data', (chunk) => {
          bytesSent += chunk.length;
          if (bytesSent % (512 * 1024) === 0) { // Log every 512KB
            outputChannel.appendLine(`Streaming file: ${bytesSent} bytes sent so far`);
          }
          req.write(chunk);
        });
        
        fileStream.on('end', () => {
          outputChannel.appendLine(`File streaming complete. Total bytes sent: ${bytesSent}`);
          
          // Write the end boundary
          outputChannel.appendLine('Writing end boundary and finalizing request...');
          req.write(endBoundaryBuffer);
          req.end();
          outputChannel.appendLine('HTTP request finalized');
        });
        
        // Log when the request is actually sent
        req.on('socket', (socket) => {
          socket.on('connect', () => {
            outputChannel.appendLine('Socket connected - request is being sent');
          });
        });
        
        outputChannel.appendLine('Upload request set up complete, waiting for file to stream...');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error setting up upload: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
          outputChannel.appendLine(`Error stack: ${error.stack}`);
        }
        reject(new Error(`Failed to set up upload: ${errorMessage}`));
      }
    });
  }

  private _getHtmlForWebview() {
    outputChannel.appendLine('Generating HTML for webview');
    outputChannel.appendLine(`Current login state: ${isLoggedIn ? 'logged in' : 'not logged in'}`);
    
    // Use simple strings instead of template literals for these values
    const loginButtonState = isLoggedIn ? 'display: none;' : '';
    const loggedInState = isLoggedIn ? '' : 'display: none;';
    
    // Create a simpler HTML without complex JavaScript
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ChartSmith</title>
        <!-- Add marked.js for markdown rendering -->
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script>
          // Configure marked.js options for security and rendering
          marked.setOptions({
            gfm: true,               // GitHub flavored markdown
            breaks: true,            // Convert line breaks to <br>
            headerIds: false,        // Don't add IDs to headers (more secure)
            mangle: false,           // Don't mangle email addresses
            silent: true,            // Ignore errors
            sanitize: false,         // Use DOMPurify instead (below)
          });
        </script>
        <!-- Add DOMPurify for sanitizing HTML from markdown -->
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
        <style>
          body {
            padding: 10px;
            margin: 0;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            position: relative;
            height: 100vh;
            overflow: hidden;
          }
          html {
            height: 100%;
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
            border-radius: 4px;
            margin: 10px auto;
            display: block;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }
          button:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          }
          .logged-in-info {
            margin-top: 20px;
            text-align: center;
            display: flex;
            flex-direction: column;
            height: calc(100vh - 100px);
          }
          .logout-button {
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 12px;
            padding: 4px 8px;
            opacity: 0.8;
            margin: 0;
            display: inline-block;
          }
          .auth-status {
            font-size: 12px;
            text-align: center;
            margin-top: 30px;
            color: var(--vscode-descriptionForeground);
          }
          .header-container {
            position: relative;
          }
          .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 20px;
            margin-bottom: 20px;
          }
          .action-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
            text-align: center;
            cursor: pointer;
            width: 100%;
            max-width: 300px;
            margin: 10px auto;
            border: 2px solid var(--vscode-button-background);
            position: relative;
            overflow: hidden;
          }
          .action-button::after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.1);
            opacity: 0;
            transition: opacity 0.3s;
          }
          .action-button:hover::after {
            opacity: 1;
          }
          .button-icon {
            font-size: 16px;
            font-weight: bold;
          }
          .chat-container {
            margin-top: 20px;
            display: flex;
            flex-direction: column;
            height: calc(100vh - 200px);
            min-height: 300px;
            position: relative;
            flex-grow: 1;
          }
          .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            padding-top: 54px; /* Space for the header */
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            margin-bottom: 10px;
            position: absolute;
            top: 0;
            bottom: 60px; /* Give more space for input */
            left: 0;
            right: 0;
            overflow-y: auto;
            scroll-behavior: smooth;
            box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
          }
          .chat-input-container {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            display: flex;
            padding: 10px 14px 14px 14px;
            background: var(--vscode-activityBar-background, #333);
            background-image: linear-gradient(to top, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.05) 100%);
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
            box-shadow: 0 -1px 3px rgba(0,0,0,0.15);
            border-top: 1px solid rgba(255,255,255,0.05);
            transition: all 0.3s ease;
          }
          .chat-input {
            flex: 1;
            padding: 10px 45px 10px 14px;
            border: 1px solid rgba(255,255,255,0.12);
            background-color: rgba(0,0,0,0.2);
            color: var(--vscode-activityBar-foreground, #fff);
            border-radius: 8px;
            font-family: var(--vscode-font-family);
            width: 100%;
            height: 40px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            box-shadow: 0 1px 2px rgba(0,0,0,0.1) inset, 0 1px 0 rgba(255,255,255,0.03);
            font-size: 13px;
          }
          .chat-input:focus {
            outline: none;
            background-color: rgba(0,0,0,0.25);
            border-color: var(--vscode-focusBorder, #007fd4);
            box-shadow: 0 0 0 2px rgba(0,127,212,0.2), 0 1px 2px rgba(0,0,0,0.1) inset;
            transform: translateY(-1px);
          }
          .chat-input::placeholder {
            color: rgba(255,255,255,0.5);
          }
          .chat-send-button {
            position: absolute;
            right: 18px;
            top: 50%;
            transform: translateY(-50%);
            width: 30px;
            height: 30px;
            background: var(--vscode-button-background, #0e639c);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            padding: 0;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            z-index: 2;
          }
          .chat-send-button:hover {
            background: var(--vscode-button-hoverBackground, #1177bb);
            transform: translateY(-50%) scale(1.05);
            box-shadow: 0 2px 5px rgba(0,0,0,0.25);
          }
          .chat-send-button:active {
            transform: translateY(-50%) scale(0.95);
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          }
          .chat-send-button:focus {
            outline: none;
            box-shadow: 0 0 0 2px rgba(0,127,212,0.4), 0 2px 4px rgba(0,0,0,0.2);
          }
          .chat-send-button svg {
            fill: #fff;
            width: 18px;
            height: 18px;
            margin-left: 2px; /* Slight adjustment for the airplane icon */
            filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));
          }
          .message {
            margin-bottom: 12px;
            padding: 10px 12px;
            border-radius: 8px;
            max-width: 80%;
            position: relative;
            line-height: 1.4;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            word-break: break-word;
            transition: transform 0.2s ease;
            display: block;
          }
          .message:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          }
          .message-container {
            display: flex;
            flex-direction: column;
          }
          .message-text {
            margin-bottom: 4px;
            text-align: left;
          }
          
          /* Markdown styling for message text */
          .message-text p {
            margin: 0 0 10px 0;
          }
          .message-text p:last-child {
            margin-bottom: 0;
          }
          .message-text pre {
            background-color: rgba(0, 0, 0, 0.1);
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 8px 0;
          }
          .message-text code {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 90%;
            background-color: rgba(0, 0, 0, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
          }
          .message-text pre code {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
          }
          .message-text a {
            color: var(--vscode-textLink-foreground, #3794ff);
            text-decoration: none;
          }
          .message-text a:hover {
            text-decoration: underline;
          }
          .message-text ul, .message-text ol {
            margin-top: 4px;
            margin-bottom: 4px;
            padding-left: 24px;
          }
          .message-text blockquote {
            border-left: 3px solid rgba(127, 127, 127, 0.5);
            margin: 8px 0;
            padding-left: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .message-text table {
            border-collapse: collapse;
            margin: 8px 0;
          }
          .message-text th, .message-text td {
            border: 1px solid rgba(127, 127, 127, 0.3);
            padding: 6px 8px;
          }
          .message-text th {
            background-color: rgba(0, 0, 0, 0.1);
          }
          .message-timestamp-debug {
            display: none; /* Hide all timestamp debug elements */
            font-size: 9px;
            opacity: 0.7;
            font-family: monospace;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 2px;
            margin-top: 2px;
          }
          .user-message {
            background-color: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #fff);
            align-self: flex-end;
            margin-left: auto;
            border-bottom-right-radius: 2px;
            text-align: left;
          }
          .assistant-message {
            background-color: var(--vscode-editor-lineHighlightBackground, rgba(255,255,255,0.08));
            color: var(--vscode-editor-foreground);
            align-self: flex-start;
            margin-right: auto;
            border-bottom-left-radius: 2px;
            text-align: left;
            border-left: 2px solid var(--vscode-activityBarBadge-background, #007ACC);
          }
          .system-message {
            background-color: var(--vscode-editorError-background, rgba(255, 0, 0, 0.1));
            color: var(--vscode-editorError-foreground, #f44);
            font-style: italic;
            font-size: 12px;
            text-align: center;
            width: 100%;
            max-width: 100%;
            margin: 5px 0;
          }
          .chat-header {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            padding: 12px 14px;
            background-color: var(--vscode-activityBar-background, #333);
            background-image: linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.05) 100%);
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
            z-index: 10;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            border-bottom: 1px solid rgba(255,255,255,0.05);
            transition: all 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .icon-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            padding: 0;
            margin: 0;
            background-color: transparent;
            border-radius: 4px;
            border: 1px solid rgba(255,255,255,0.1);
            color: var(--vscode-activityBar-foreground, #fff);
            cursor: pointer;
            box-shadow: none;
          }
          .icon-button:hover {
            background-color: rgba(255,255,255,0.1);
            transform: translateY(0);
            box-shadow: none;
          }
          .chart-path-container {
            display: flex;
            align-items: center;
            font-size: 12px;
            position: relative;
            padding-left: 20px;
            flex-grow: 1;
          }
          .connection-status {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-left: 8px;
            transition: all 0.3s ease;
          }
          .connection-status.connected {
            background-color: #4CAF50; /* Green */
            box-shadow: 0 0 5px #4CAF50;
          }
          .connection-status.connecting {
            background-color: #FFC107; /* Yellow */
            box-shadow: 0 0 5px #FFC107;
          }
          .connection-status.reconnecting {
            background-color: #FF9800; /* Orange */
            box-shadow: 0 0 5px #FF9800;
            animation: pulse 1.5s infinite;
          }
          .connection-status.disconnected {
            background-color: #F44336; /* Red */
            box-shadow: 0 0 5px #F44336;
          }
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          #connection-status-container {
            display: flex;
            align-items: center;
          }
          .chart-path-container:before {
            content: "";
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 16px;
            height: 16px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364D2FF'%3E%3Cpath d='M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z'/%3E%3C/svg%3E");
            background-size: contain;
            background-repeat: no-repeat;
            filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
          }
          .chart-path-label {
            font-weight: bold;
            margin-right: 8px;
            color: var(--vscode-activityBar-foreground, #fff);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 10px;
          }
          .chart-path {
            font-family: var(--vscode-editor-font-family, monospace);
            color: var(--vscode-activityBar-foreground, #fff);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            background-color: rgba(255,255,255,0.1);
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
          }
          .message-header {
            font-weight: bold;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <h1>ChartSmith</h1>
          <button id="logout-button" class="logout-button" style="${loggedInState}">Logout</button>
        </div>
        
        <div id="login-container" style="${loginButtonState}">
          <p style="text-align: center;">Please log in to use ChartSmith</p>
          <button id="login-button">Login</button>
        </div>
        
        <div id="logged-in-container" style="${loggedInState}">
          <div class="logged-in-info">
            <div class="action-buttons">
              <button id="create-chart-button" class="action-button">
                <span class="button-icon">+</span>
                Create New Helm Chart
              </button>
              
              <button id="upload-chart-button" class="action-button">
                <span class="button-icon">↑</span>
                Upload Chart to ChartSmith
              </button>
              
              <button id="download-chart-button" class="action-button">
                <span class="button-icon">↓</span>
                Import Chart from ChartSmith
              </button>
            </div>
            
            <!-- Chat Interface (hidden by default, only shown when a workspace is mapped) -->
            <div id="chat-container" class="chat-container" style="display: none;">
              <div class="chat-header">
                <div class="chart-path-container">
                  <span class="chart-path-label">Chart:</span>
                  <span id="chart-local-path" class="chart-path">Loading chart path...</span>
                </div>
                <div class="header-actions">
                  <button id="open-in-chartsmith" class="icon-button" title="Open in ChartSmith">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.5 2H2.5C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H12.5C13.3284 14 14 13.3284 14 12.5V8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M7.5 8.5L14 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M10 2H14V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <div id="connection-status-container">
                    <div id="connection-status" class="connection-status disconnected" title="Disconnected"></div>
                    <div id="connection-debug" style="display: none; margin-left: 5px; cursor: pointer; font-size: 10px; color: rgba(255,255,255,0.5);" title="Debug: Toggle connection status">⚙️</div>
                  </div>
                </div>
              </div>
              <div id="chat-messages" class="chat-messages">
                <!-- Messages will be inserted here dynamically -->
              </div>
              <div class="chat-input-container">
                <input type="text" id="chat-input" class="chat-input" placeholder="Ask a question about your chart...">
                <button id="chat-send-button" class="chat-send-button" title="Send message">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <script>
          // Simple script to avoid potential issues
          const vscode = acquireVsCodeApi();
          
          // Log when initialized
          console.log('ChartSmith webview initialized');
          
          // Get button elements
          const loginButton = document.getElementById('login-button');
          const logoutButton = document.getElementById('logout-button');
          const createChartButton = document.getElementById('create-chart-button');
          const uploadChartButton = document.getElementById('upload-chart-button');
          const downloadChartButton = document.getElementById('download-chart-button');
          const loginContainer = document.getElementById('login-container');
          const loggedInContainer = document.getElementById('logged-in-container');
          
          // Chat elements
          const chatContainer = document.getElementById('chat-container');
          const chatInput = document.getElementById('chat-input');
          const chatSendButton = document.getElementById('chat-send-button');
          const chatMessages = document.getElementById('chat-messages');
          const openInChartsmithButton = document.getElementById('open-in-chartsmith');
          
          // Initialize by checking auth status
          vscode.postMessage({
            command: 'checkAuthStatus'
          });
          
          // Check for workspace mappings to determine if chat should be shown
          vscode.postMessage({
            command: 'checkWorkspaceMappings'
          });
          
          // Variable to store current workspace ID
          let currentWorkspaceId = null;
          
          // Function to clear workspace state
          function clearWorkspaceState() {
            // Clear workspace ID
            currentWorkspaceId = null;
            console.log('Workspace state cleared');
          }
          
          // Login button click handler
          if (loginButton) {
            loginButton.addEventListener('click', function() {
              console.log('Login button clicked');
              vscode.postMessage({
                command: 'login'
              });
            });
          }
          
          // Logout button click handler
          if (logoutButton) {
            logoutButton.addEventListener('click', function() {
              console.log('Logout button clicked');
              // Clear workspace state when logging out
              clearWorkspaceState();
              vscode.postMessage({
                command: 'logout'
              });
            });
          }
          
          // Create new chart button click handler
          if (createChartButton) {
            createChartButton.addEventListener('click', function() {
              console.log('Create new chart button clicked');
              vscode.postMessage({
                command: 'createChart'
              });
            });
          }
          
          // Upload chart button click handler
          if (uploadChartButton) {
            console.log('Upload button found, adding click listener');
            uploadChartButton.addEventListener('click', function() {
              console.log('Upload button clicked');
              vscode.postMessage({
                command: 'uploadChart',
                log: 'UPLOAD BUTTON PRESSED'
              });
            });
          }
          
          // Download chart button click handler
          if (downloadChartButton) {
            downloadChartButton.addEventListener('click', function() {
              console.log('Download chart button clicked');
              vscode.postMessage({
                command: 'downloadChart'
              });
            });
          }
          
          // Function to add a message to the chat
          function addMessage(text, isUser, messageId, timestamp) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
            
            // Create message container with timestamp display
            const messageContainer = document.createElement('div');
            messageContainer.classList.add('message-container');
            
            // Add the actual message text
            const messageText = document.createElement('div');
            messageText.classList.add('message-text');
            // Store the raw text for future comparisons
            messageText.setAttribute('data-raw-text', text);
            // Render markdown and sanitize HTML
            messageText.innerHTML = DOMPurify.sanitize(marked.parse(text));
            messageContainer.appendChild(messageText);
            
            // Store timestamp for sorting purposes but don't display it visually
            const now = timestamp || (new Date().toISOString());
            messageElement.setAttribute('data-timestamp', now);
            
            // Hide any existing debug footers
            setTimeout(() => {
              document.querySelectorAll('.message-timestamp-debug').forEach(el => {
                el.style.display = 'none';
              });
            }, 50);
            
            // Add container to message
            messageElement.appendChild(messageContainer);
            
            // Add data-id attribute if messageId is provided
            if (messageId) {
              messageElement.setAttribute('data-message-id', messageId);
            }
            
            // Add timestamp attribute in ISO format
            messageElement.setAttribute('data-timestamp', now);
            
            // If this is a user message, store the text content for later matching
            if (isUser && text) {
              messageElement.setAttribute('data-message-text', text);
            }
            
            // Add to chat
            chatMessages.appendChild(messageElement);
            
            // Scroll to the bottom immediately
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            return messageElement;
          }
          
          // Function to find a message by ID
          function findMessageById(messageId) {
            if (!messageId) return null;
            
            const messages = chatMessages.querySelectorAll('.message[data-message-id]');
            for (let i = 0; i < messages.length; i++) {
              if (messages[i].getAttribute('data-message-id') === messageId) {
                return messages[i];
              }
            }
            return null;
          }
          
          // Function to update or add a chat message
          function updateOrAddChatMessage(message) {
            if (!message) return;
            
            // Check if we have a valid message ID
            if (!message.id) {
              console.error("ERROR: Received message without ID field");
              console.error("Message payload:", JSON.stringify(message));
              vscode.postMessage({
                command: 'logError',
                text: 'Received chat message without ID field: ' + JSON.stringify(message)
              });
              return;
            }
            
            // Log the message details for debugging
            console.log("Processing message update for ID: " + message.id);
            console.log("Message timestamp: " + (message.createdAt || "none"));
            console.log("Message full object:", JSON.stringify(message));
            vscode.postMessage({
              command: 'logDebug',
              text: "Message update - ID: " + message.id + ", Timestamp: " + (message.createdAt || "none")
            });
            
            // Try to find existing message by its ID
            // We store messages with suffix -prompt for user input and -response for assistant response
            let userMsgElement = findMessageById(message.id + '-prompt');
            const responseMsgElement = findMessageById(message.id + '-response');
            
            // If we can't find the user message by ID, try to find it by text content
            // This helps match temporary messages created when user sends a message
            if (!userMsgElement && message.prompt) {
              // Find all user messages and look for matching text
              const allUserMessages = chatMessages.querySelectorAll('.user-message');
              for (let i = 0; i < allUserMessages.length; i++) {
                const msgEl = allUserMessages[i];
                const promptText = msgEl.getAttribute('data-message-text');
                
                // If this message has the same text as our prompt, it's likely our temp message
                if (promptText === message.prompt) {
                  console.log("Found matching temp message by text:", promptText);
                  userMsgElement = msgEl;
                  
                  // Update the ID to match the server-assigned ID
                  userMsgElement.setAttribute('data-message-id', message.id + '-prompt');
                  
                  // Also update the timestamp display
                  if (message.createdAt) {
                    userMsgElement.setAttribute('data-timestamp', message.createdAt);
                    // No longer updating timestamp elements - they're hidden
                  }
                  
                  break;
                }
              }
            }
            
            if (responseMsgElement) {
              // Update existing response
              console.log('Updating existing response message');
              
              // Update the response text
              const messageTextElement = responseMsgElement.querySelector('.message-text');
              
              // Handle null response appropriately
              const displayText = message.response === null ? 
                "Waiting for response..." : 
                (message.response || '');
              
              if (messageTextElement) {
                // Just update the content directly without animations
                // This prevents visual disruption when streaming responses
                // Compare the raw text content for change detection
                const currentText = messageTextElement.getAttribute('data-raw-text') || '';
                if (currentText !== displayText) {
                  // Store the raw text for future comparisons
                  messageTextElement.setAttribute('data-raw-text', displayText);
                  // Render markdown and sanitize HTML
                  messageTextElement.innerHTML = DOMPurify.sanitize(marked.parse(displayText));
                }
              } else {
                // Create a message text element if it doesn't exist
                const newMessageText = document.createElement('div');
                newMessageText.classList.add('message-text');
                newMessageText.setAttribute('data-raw-text', displayText);
                newMessageText.innerHTML = DOMPurify.sanitize(marked.parse(displayText));
                responseMsgElement.appendChild(newMessageText);
              }
              
              // No longer updating timestamp elements - they're hidden
              
              // Update the timestamp attribute
              if (message.createdAt) {
                responseMsgElement.setAttribute('data-timestamp', message.createdAt);
                
                // Debug server timestamp
                console.log("Updated timestamp for message " + message.id + " to " + message.createdAt);
                vscode.postMessage({
                  command: 'logDebug',
                  text: "Updated timestamp: " + message.id + " to " + message.createdAt
                });
              }
            } else if (userMsgElement) {
              // Found user message but no response - add the response
              console.log('Adding response to existing message');
              
              // Handle null response appropriately
              const displayText = message.response === null ? 
                "Waiting for response..." : 
                (message.response || '');
              
              const responseElement = addMessage(displayText, false, message.id + '-response', message.createdAt);
              
              // Set the timestamp from the server
              if (message.createdAt) {
                responseElement.setAttribute('data-timestamp', message.createdAt);
                
                // No longer updating timestamp elements - they're hidden
              }
            } else {
              // Neither found - add both as new messages
              console.log('Adding new message pair');
              
              // Add user message (prompt)
              const userElement = addMessage(message.prompt || '', true, message.id + '-prompt', message.createdAt);
              
              // Add response message (even if null)
              // Handle null response appropriately
              const displayText = message.response === null ? 
                "Waiting for response..." : 
                (message.response || '');
              
              const responseElement = addMessage(displayText, false, message.id + '-response', message.createdAt);
              
              // Set timestamps from server
              if (message.createdAt) {
                userElement.setAttribute('data-timestamp', message.createdAt);
                responseElement.setAttribute('data-timestamp', message.createdAt);
                
                // No longer updating timestamp elements - they're hidden
              }
            }
            
            // Sort messages by timestamp if needed
            sortMessagesByTimestamp();
          }
          
          // Function to sort messages by timestamp
          function sortMessagesByTimestamp() {
            // Log start of sorting for debugging
            console.log("SORTING MESSAGES BY TIMESTAMP");
            vscode.postMessage({
              command: 'logDebug',
              text: 'Starting message sort by timestamp'
            });
            
            // Get all messages with timestamps
            const messages = Array.from(chatMessages.querySelectorAll('.message[data-timestamp]'));
            
            // Log found messages
            console.log("Found " + messages.length + " messages with timestamps");
            
            // Debug log all messages and their timestamps
            messages.forEach((msg, index) => {
              const id = msg.getAttribute('data-message-id') || 'unknown';
              const timestamp = msg.getAttribute('data-timestamp') || 'none';
              console.log("Message " + index + ": ID=" + id + ", timestamp=" + timestamp);
              vscode.postMessage({
                command: 'logDebug',
                text: "Before sort - Message " + index + ": ID=" + id + ", timestamp=" + timestamp
              });
            });
            
            // SIMPLIFIED SORTING APPROACH
            // 1. Group messages by their base ID (without -prompt or -response)
            // 2. Sort groups strictly by their actual ISO timestamps as strings
            // 3. Within each group, ensure prompts come before responses
            
            // Group messages by conversation ID (removing -prompt or -response suffixes)
            const messageGroups = {};
            messages.forEach(msg => {
              const fullId = msg.getAttribute('data-message-id') || '';
              // Extract the base message ID without -prompt or -response
              const baseId = fullId.split('-')[0];
              
              if (baseId) {
                if (!messageGroups[baseId]) {
                  messageGroups[baseId] = [];
                }
                messageGroups[baseId].push(msg);
              }
            });
            
            // Sort the groups by the timestamp of the prompt message
            const sortedGroupIds = Object.keys(messageGroups).sort((a, b) => {
              const groupA = messageGroups[a];
              const groupB = messageGroups[b];
              
              // Find prompt messages from each group
              const promptMsgA = groupA.find(msg => (msg.getAttribute('data-message-id') || '').endsWith('-prompt'));
              const promptMsgB = groupB.find(msg => (msg.getAttribute('data-message-id') || '').endsWith('-prompt'));
              
              // Get timestamps (or empty string if not found)
              const timestampA = promptMsgA ? promptMsgA.getAttribute('data-timestamp') || '' : '';
              const timestampB = promptMsgB ? promptMsgB.getAttribute('data-timestamp') || '' : '';
              
              // Direct string comparison for ISO timestamps (works because of YYYY-MM-DD format)
              return timestampA.localeCompare(timestampB);
            });
            
            // Create a document fragment to batch DOM changes
            // This reduces reflow and repaint, leading to smoother updates
            const fragment = document.createDocumentFragment();
            
            // Clean up any existing debug sort info in all messages before removing them
            messages.forEach(message => {
              const timestampEl = message.querySelector('.message-timestamp-debug');
              if (timestampEl && timestampEl.textContent && timestampEl.textContent.includes(" | Sort: ")) {
                timestampEl.textContent = timestampEl.textContent.split(" | Sort: ")[0];
              }
              // Then remove them from the DOM
              message.remove();
            });
            
            // Then prepare to re-insert in sorted order
            let sortIndex = 0;
            
            // For debug - log the sorted group IDs
            console.log("Sorted group IDs:", sortedGroupIds);
            
            sortedGroupIds.forEach(groupId => {
              const group = messageGroups[groupId];
              
              // Log the group
              console.log("Group " + groupId + ":", group.map(msg => {
                return {
                  id: msg.getAttribute('data-message-id'),
                  timestamp: msg.getAttribute('data-timestamp')
                };
              }));
              
              // For each group, always show prompt before response
              const promptMsg = group.find(msg => (msg.getAttribute('data-message-id') || '').endsWith('-prompt'));
              const responseMsg = group.find(msg => (msg.getAttribute('data-message-id') || '').endsWith('-response'));
              
              // Add prompt to DOM if it exists
              if (promptMsg) {
                sortIndex++;
                fragment.appendChild(promptMsg);
                
                // Add debug information
                const id = promptMsg.getAttribute('data-message-id') || 'unknown';
                const timestamp = promptMsg.getAttribute('data-timestamp') || 'none';
                console.log("Sorted message " + sortIndex + ": ID=" + id + ", timestamp=" + timestamp);
                
                vscode.postMessage({
                  command: 'logDebug',
                  text: "After sort - Message " + sortIndex + ": ID=" + id + ", timestamp=" + timestamp
                });
                
                // No longer adding debug sorting information
              }
              
              // Add response to DOM if it exists
              if (responseMsg) {
                sortIndex++;
                fragment.appendChild(responseMsg);
                
                // Add debug information
                const id = responseMsg.getAttribute('data-message-id') || 'unknown';
                const timestamp = responseMsg.getAttribute('data-timestamp') || 'none';
                console.log("Sorted message " + sortIndex + ": ID=" + id + ", timestamp=" + timestamp);
                
                vscode.postMessage({
                  command: 'logDebug',
                  text: "After sort - Message " + sortIndex + ": ID=" + id + ", timestamp=" + timestamp
                });
                
                // No longer adding debug sorting information
              }
            });
            
            // Add any ungrouped messages at the end (those without IDs or temporary messages)
            const ungroupedMessages = messages.filter(msg => {
              const fullId = msg.getAttribute('data-message-id') || '';
              const baseId = fullId.split('-')[0];
              return !baseId || !messageGroups[baseId];
            });
            
            // Sort ungrouped messages by timestamp
            ungroupedMessages.sort((a, b) => {
              const timestampA = a.getAttribute('data-timestamp') || '';
              const timestampB = b.getAttribute('data-timestamp') || '';
              return timestampA.localeCompare(timestampB);
            });
            
            ungroupedMessages.forEach(message => {
              sortIndex++;
              fragment.appendChild(message);
              
              // Add debug information
              const id = message.getAttribute('data-message-id') || 'unknown';
              const timestamp = message.getAttribute('data-timestamp') || 'none';
              console.log("Ungrouped message " + sortIndex + ": ID=" + id + ", timestamp=" + timestamp);
              
              // No longer adding debug sorting information
            });
            
            // Now add the entire fragment to the DOM in one operation
            // This is much more efficient than adding elements one by one
            chatMessages.appendChild(fragment);
            
            // Always scroll to the bottom, but with a small delay to allow DOM updates
            setTimeout(() => {
              // Directly set scrollTop - this is more reliable than scrollTo for staying at the bottom
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 10);
            
            // Log completion of sorting
            console.log("MESSAGE SORTING COMPLETE");
          }
          
          // Function to send a message
          function sendMessage() {
            const messageText = chatInput.value.trim();
            if (!messageText) return;
            
            // Generate a temporary element ID for the message (will be replaced when we get server response)
            const tempId = 'temp-' + new Date().getTime();
            
            // Add user message to chat with a temporary ID
            const messageElement = addMessage(messageText, true, tempId + '-prompt');
            
            // Store the message text as a data attribute to facilitate future matching
            messageElement.setAttribute('data-message-text', messageText);
            
            // Send message to extension
            vscode.postMessage({
              command: 'sendChatMessage',
              text: messageText,
              tempId: tempId
            });
            
            // Clear input field
            chatInput.value = '';
            
            // Disable input while waiting for response
            chatInput.disabled = true;
            chatSendButton.disabled = true;
          }
          
          // Send button click handler
          if (chatSendButton) {
            chatSendButton.addEventListener('click', sendMessage);
          }
          
          // Send message on Enter key
          if (chatInput) {
            chatInput.addEventListener('keypress', function(e) {
              if (e.key === 'Enter') {
                sendMessage();
              }
            });
          }
          
          // Open in ChartSmith button click handler
          if (openInChartsmithButton) {
            openInChartsmithButton.addEventListener('click', function() {
              console.log('Open in ChartSmith button clicked');
              if (currentWorkspaceId) {
                vscode.postMessage({
                  command: 'openInChartSmith',
                  workspaceId: currentWorkspaceId
                });
              } else {
                console.log('No workspace ID available');
              }
            });
          }
          
          // Function to update connection status indicator
          function updateConnectionStatusUI(status) {
            var connectionStatusElement = document.getElementById('connection-status');
            if (!connectionStatusElement) return;
            
            // Remove all status classes
            connectionStatusElement.classList.remove('connected', 'connecting', 'disconnected');
            
            // Add the appropriate class
            connectionStatusElement.classList.add(status);
            
            // Update the tooltip
            switch(status) {
              case 'connected':
                connectionStatusElement.title = 'Connected to server';
                break;
              case 'connecting':
                connectionStatusElement.title = 'Connecting to server...';
                break;
              case 'reconnecting':
                connectionStatusElement.title = 'Attempting to reconnect...';
                break;
              case 'disconnected':
              default:
                connectionStatusElement.title = 'Disconnected';
                break;
            }
            
            console.log('Connection status updated:', status);
          }
          
          // Set up the debug connection status button (hidden by default)
          document.addEventListener('DOMContentLoaded', function() {
            var connectionStatus = document.getElementById('connection-status');
            var connectionDebug = document.getElementById('connection-debug');
            
            if (connectionStatus) {
              // Show debug button on right-click
              connectionStatus.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                if (connectionDebug) {
                  connectionDebug.style.display = connectionDebug.style.display === 'none' ? 'block' : 'none';
                }
              });
            }
            
            if (connectionDebug) {
              // Add click handler for debug button
              connectionDebug.addEventListener('click', function() {
                console.log('Debug: toggle connection status');
                vscode.postMessage({
                  command: 'testConnection'
                });
              });
            }
          });
          
          // Message handler
          window.addEventListener('message', function(event) {
            var message = event.data;
            console.log('Received message:', message);
            
            if (message.type === 'connectionStatus') {
              updateConnectionStatusUI(message.status);
            } else if (message.type === 'auth-success') {
              console.log('Auth success! Updating UI');
              if (loginContainer) loginContainer.style.display = 'none';
              if (loggedInContainer) loggedInContainer.style.display = 'block';
            } else if (message.type === 'auth-logout') {
              console.log('Logged out! Updating UI');
              // Clear workspace state on logout
              clearWorkspaceState();
              if (loginContainer) loginContainer.style.display = 'block';
              if (loggedInContainer) loggedInContainer.style.display = 'none';
            } else if (message.type === 'auth-status') {
              console.log('Auth status update:', message.isLoggedIn);
              if (message.isLoggedIn) {
                if (loginContainer) loginContainer.style.display = 'none';
                if (loggedInContainer) loggedInContainer.style.display = 'block';
              } else {
                if (loginContainer) loginContainer.style.display = 'block';
                if (loggedInContainer) loggedInContainer.style.display = 'none';
              }
            } else if (message.type === 'chatMessageUpdated') {
              console.log('Received chat message update:', message.message);
              // Process the chat message update
              updateOrAddChatMessage(message.message);
              
              // Re-enable input after receiving response
              if (chatInput) chatInput.disabled = false;
              if (chatSendButton) chatSendButton.disabled = false;
              
              // Focus the input field for convenience
              if (chatInput) chatInput.focus();
            } else if (message.type === 'chatResponse') {
              // Legacy format - Add assistant message to chat
              addMessage(message.text, false);
              
              // Re-enable input after receiving response
              if (chatInput) chatInput.disabled = false;
              if (chatSendButton) chatSendButton.disabled = false;
              
              // Focus the input field for convenience
              if (chatInput) chatInput.focus();
            } else if (message.type === 'workspaceMappingsUpdate') {
              // Update UI based on whether we have mappings
              var actionButtons = document.querySelector('.action-buttons');
              
              if (message.hasMappings) {
                console.log('Workspace mappings found, showing chat interface and hiding buttons');
                // Show chat interface
                if (chatContainer) chatContainer.style.display = 'flex';
                
                // Hide action buttons since we already have a linked workspace
                if (actionButtons) {
                  actionButtons.style.display = 'none';
                }
                
                // Display the first workspace's local path in the chart path element
                if (message.mappings && message.mappings.length > 0) {
                  var chartPathElement = document.getElementById('chart-local-path');
                  if (chartPathElement) {
                    var localPath = message.mappings[0].localPath;
                    
                    // Store the workspace ID for use with the "Open in ChartSmith" button
                    currentWorkspaceId = message.mappings[0].workspaceId;
                    console.log('Stored workspace ID: ' + currentWorkspaceId);
                    
                    // Try to create a relative path from the absolute path
                    try {
                      // Get workspace folders from message if available
                      if (message.workspaceFolders && Array.isArray(message.workspaceFolders)) {
                        // Check each workspace folder
                        for (var i = 0; i < message.workspaceFolders.length; i++) {
                          var folder = message.workspaceFolders[i];
                          // Check if the path starts with this workspace folder
                          if (localPath.startsWith(folder.path)) {
                            // Get relative path by removing the workspace folder path
                            var relativePath = folder.name + localPath.substring(folder.path.length);
                            chartPathElement.textContent = relativePath;
                            chartPathElement.title = localPath; // Keep full path in tooltip
                            console.log('Showing relative path: ' + relativePath);
                            break;
                          }
                        }
                      } else {
                        // If no workspace folders available, try to shorten the path
                        var pathParts = localPath.split('/');
                        var shortPath = pathParts.slice(-2).join('/'); // Just last two segments
                        chartPathElement.textContent = '.../' + shortPath;
                        chartPathElement.title = localPath; // Keep full path in tooltip
                      }
                    } catch (e) {
                      console.error('Error creating relative path: ' + e);
                      chartPathElement.textContent = localPath;
                      chartPathElement.title = localPath;
                    }
                  }
                }
              } else {
                console.log('No workspace mappings found, hiding chat interface and showing buttons');
                // Hide chat interface
                if (chatContainer) chatContainer.style.display = 'none';
                
                // Show action buttons
                if (actionButtons) {
                  actionButtons.style.display = 'flex';
                }
              }
            } else if (message.type === 'messagesLoaded') {
              console.log('Messages loaded:', message.messages);
              
              // Clear existing messages first
              if (chatMessages) chatMessages.innerHTML = '';
              
              // Add all messages to the chat
              if (message.messages && Array.isArray(message.messages) && chatMessages) {
                console.log('Messages array length:', message.messages.length);
                
                // For debugging, log the entire messages array
                console.log('Messages array:', JSON.stringify(message.messages));
                
                // Add messages in chronological order
                message.messages.forEach(function(msg) {
                  // Simple debug
                  console.log('Message:', JSON.stringify(msg));
                  
                  // Check for ChartSmith specific format with prompt/response
                  if (msg.prompt !== undefined && msg.response !== undefined) {
                    console.log('Found ChartSmith message format with prompt/response');
                    
                    // Check for missing ID
                    if (!msg.id) {
                      console.error("ERROR: Historical message without ID field");
                      console.error("Message payload:", JSON.stringify(msg));
                      vscode.postMessage({
                        command: 'logError',
                        text: 'Historical message without ID field: ' + JSON.stringify(msg)
                      });
                      return; // Skip this message
                    }
                    
                    // Use the updateOrAddChatMessage function to properly handle message IDs
                    console.log("Processing message with ID: " + msg.id);
                    updateOrAddChatMessage({
                      id: msg.id,
                      prompt: msg.prompt,
                      response: msg.response,
                      createdAt: msg.createdAt || new Date().toISOString()
                    });
                    
                    // Skip the rest of the processing since we've already added both messages
                    return;
                  }
                  
                  // If not using ChartSmith format, use the standard format checking
                  // Add message based on role
                  var isUser = msg.role === 'user';
                  
                  // Attempt to extract content with multiple fallback options
                  var content;
                  
                  // Simple content extraction with fallbacks
                  if (msg.content) {
                    if (typeof msg.content === 'string') {
                      content = msg.content;
                    } else {
                      content = JSON.stringify(msg.content);
                    }
                  } else if (msg.text) {
                    content = msg.text;
                  } else if (msg.message) {
                    content = msg.message;
                  } else {
                    content = 'No content available';
                  }
                  
                  // Check for missing ID
                  if (!msg.id) {
                    console.error("ERROR: Standard format message without ID field");
                    console.error("Message payload:", JSON.stringify(msg));
                    vscode.postMessage({
                      command: 'logError',
                      text: 'Standard format message without ID field: ' + JSON.stringify(msg)
                    });
                    return; // Skip this message
                  }
                    
                  // Add the message to the UI
                  console.log('Adding message:', content);
                  const msgElement = addMessage(content, isUser, msg.id);
                  
                  // Add timestamp if available
                  if (msg.timestamp || msg.createdAt) {
                    msgElement.setAttribute('data-timestamp', msg.timestamp || msg.createdAt);
                  }
                });
                
                // Sort messages by timestamp
                sortMessagesByTimestamp();
                
                // Scroll to the bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } else if (message.type === 'messagesError') {
              console.error('Error loading messages:', message.error);
              // Optionally show an error message in the chat
              if (chatMessages) {
                var errorElement = document.createElement('div');
                errorElement.classList.add('message', 'system-message');
                errorElement.textContent = 'Could not load previous messages: ' + message.error;
                chatMessages.appendChild(errorElement);
              }
            }
          });
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

// Helper function to get the WWW endpoint
export async function getWwwEndpoint(): Promise<string | undefined> {
  // First check if we have it in memory
  if (authData && authData.wwwEndpoint) {
    return authData.wwwEndpoint;
  }
  
  // If not in memory but we're supposed to be logged in, try to get it from storage
  if (isLoggedIn) {
    try {
      const endpoint = await secretStorage.get(WWW_ENDPOINT_KEY);
      if (endpoint) {
        return endpoint;
      }
    } catch (error) {
      outputChannel.appendLine(`Error retrieving WWW endpoint from storage: ${error}`);
    }
  }
  
  // Not logged in or endpoint not found
  return undefined;
}

// Helper function to get the Push endpoint
export async function getPushEndpoint(): Promise<string | undefined> {
  // First check if we have it in memory
  if (authData && authData.pushEndpoint) {
    return authData.pushEndpoint;
  }
  
  // If not in memory but we're supposed to be logged in, try to get it from storage
  if (isLoggedIn) {
    try {
      const endpoint = await secretStorage.get(PUSH_ENDPOINT_KEY);
      if (endpoint) {
        return endpoint;
      }
    } catch (error) {
      outputChannel.appendLine(`Error retrieving Push endpoint from storage: ${error}`);
    }
  }
  
  // Not logged in or endpoint not found
  return undefined;
}

// Helper function to check if user is authenticated
export function isAuthenticated(): boolean {
  return isLoggedIn;
}

// Helper function to get the session-specific push token
export function getPushToken(): string | null {
  return pushToken;
}

/**
 * Connect to the Centrifugo server for real-time updates
 * @param pushEndpoint The push endpoint URL 
 * @param token The JWT token for authentication
 * 
 * Common issues:
 * 1. WebSocket URL construction - must correctly convert HTTP to WS
 * 2. JWT token format - must be valid and properly formatted
 * 3. CORS issues - server must allow WebSocket connection
 * 4. Network/firewall issues - WebSockets might be blocked
 */
async function connectToCentrifugo(pushEndpoint: string, token: string): Promise<void> {
  outputChannel.appendLine('Connecting to Centrifugo server...');
  
  try {
    // Disconnect existing client if there is one
    if (centrifuge) {
      outputChannel.appendLine('Disconnecting existing Centrifugo client');
      await disconnectFromCentrifugo();
    }
    
    // Update connection status to connecting
    connectionStatus = ConnectionStatus.CONNECTING;
    updateConnectionStatus();
    
    // Parse the push endpoint URL but use it as-is (just converting http→ws protocol)
    let parsedUrl = new URL(pushEndpoint);
    
    // Just convert the protocol from HTTP to WebSocket, keep everything else the same
    const protocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Build the WebSocket URL using the original endpoint, only changing the protocol
    const wsEndpoint = pushEndpoint.replace(/^http/, 'ws');
    
    // Log detailed connection information
    outputChannel.appendLine('----------------------------------------------------------');
    outputChannel.appendLine('DETAILED WEBSOCKET CONNECTION INFO:');
    outputChannel.appendLine(`Original push endpoint: ${pushEndpoint}`);
    outputChannel.appendLine(`WebSocket URL: ${wsEndpoint}`);
    outputChannel.appendLine(`Protocol conversion: ${parsedUrl.protocol} → ${protocol}`);
    outputChannel.appendLine('----------------------------------------------------------');
    
    // First, try to check if the HTTP endpoint is reachable
    const infoEndpoint = pushEndpoint.replace(/\/connection\/websocket$/, '/info');
    outputChannel.appendLine(`Testing connection with info endpoint: ${infoEndpoint}`);
    
    try {
      // Create an HTTP/HTTPS request to test the endpoint
      const testRequest = (parsedUrl.protocol === 'https:' ? https : http).request(infoEndpoint, {
        method: 'GET',
        timeout: 5000
      }, (res) => {
        outputChannel.appendLine(`Info endpoint response: status=${res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          outputChannel.appendLine(`Info endpoint data: ${data.substring(0, 200)}`);
        });
      });
      
      testRequest.on('error', (error) => {
        outputChannel.appendLine(`WARNING: Info endpoint error: ${error.message}. This MAY be normal if the endpoint doesn't support /info.`);
      });
      
      testRequest.end();
    } catch (error) {
      outputChannel.appendLine(`Error testing endpoint: ${error}`);
    }
    
    outputChannel.appendLine(`Original push endpoint: ${pushEndpoint}`);
    outputChannel.appendLine(`Centrifugo websocket endpoint: ${wsEndpoint}`);
    outputChannel.appendLine(`Token length: ${token.length}`);
    outputChannel.appendLine(`Token preview: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`);
    
    // Decode and log the JWT token for debugging
    const decoded = decodeJwt(token);
    if (decoded) {
      outputChannel.appendLine(`JWT Header: ${JSON.stringify(decoded.header)}`);
      outputChannel.appendLine(`JWT Payload (partial): ${JSON.stringify(decoded.payload, null, 2).substring(0, 300)}...`);
      
      // Check if the token has expired
      if (decoded.payload.exp) {
        const expTime = new Date(decoded.payload.exp * 1000);
        const now = new Date();
        outputChannel.appendLine(`Token expires at: ${expTime.toISOString()} (${now > expTime ? 'EXPIRED' : 'valid'})`);
      }
    } else {
      outputChannel.appendLine(`WARNING: Could not decode JWT token. It may not be properly formatted.`);
    }
    
    // Create a new Centrifugo client with more robust configuration
    try {
      // Configure Centrifuge with basic options 
      // Only using options confirmed to be supported in this version
      centrifuge = new Centrifuge(wsEndpoint, {
        token: token,
        debug: true,             // Enable debug mode for more logs
        minReconnectDelay: 1000, // Start with 1s delay (minimum)
        maxReconnectDelay: 30000, // Maximum 30s between reconnection attempts
        timeout: 10000,          // Connection timeout after 10s
        websocket: WebSocket     // Provide the WebSocket implementation
        // Using our custom reconnection logic instead of built-in options
      });
      
      outputChannel.appendLine(`Created Centrifuge client with debug enabled`);
    } catch (error) {
      outputChannel.appendLine(`Error creating Centrifuge client: ${error}`);
      connectionStatus = ConnectionStatus.DISCONNECTED;
      updateConnectionStatus();
      return; // Exit the function if we can't create the client
    }
    
    // Safety check - exit if client wasn't created
    if (!centrifuge) {
      outputChannel.appendLine(`Failed to create Centrifuge client for unknown reason`);
      connectionStatus = ConnectionStatus.DISCONNECTED;
      updateConnectionStatus();
      return;
    }
    
    // Set up event handlers with proper typing
    centrifuge.on('connecting', function(ctx: any) {
      outputChannel.appendLine(`Centrifugo connecting: ${JSON.stringify(ctx)}`);
      connectionStatus = ConnectionStatus.CONNECTING;
      updateConnectionStatus();
    });
    
    centrifuge.on('connected', function(ctx: any) {
      outputChannel.appendLine(`Centrifugo connected: ${JSON.stringify(ctx)}`);
      connectionStatus = ConnectionStatus.CONNECTED;
      updateConnectionStatus();
      
      // Reset reconnection attempt counter when successfully connected
      reconnectAttempt = 0;
      
      // Clear any pending reconnection timers
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      // Subscribe to workspace messages
      try {
        // Get current workspace mappings with proper typing
        const mappings: WorkspaceMapping[] = context.globalState.get(WORKSPACE_MAPPINGS_KEY, []);
        
        if (mappings && mappings.length > 0) {
          const workspaceId = mappings[0].workspaceId;
          
          // Create channel name for this workspace with userId
          // Use workspaceId#userId format as the channel name
          let userId = '';
          try {
            // Try to get the userId from the JWT token
            if (pushToken) {
              const tokenData = decodeJwt(pushToken);
              if (tokenData && tokenData.payload && tokenData.payload.sub) {
                userId = tokenData.payload.sub;
                outputChannel.appendLine(`Found user ID in token: ${userId}`);
              } else if (tokenData && tokenData.payload && tokenData.payload.userId) {
                userId = tokenData.payload.userId;
                outputChannel.appendLine(`Found user ID in token: ${userId}`);
              }
            }
          } catch (e) {
            outputChannel.appendLine(`Error extracting userId from token: ${e}`);
          }
          
          // Fall back to a random ID if we couldn't get a real one
          if (!userId) {
            userId = `anon-${Math.random().toString(36).substring(2, 9)}`;
            outputChannel.appendLine(`Using generated user ID: ${userId}`);
          }
          
          // Format: workspaceId#userId
          const channelName = `${workspaceId}#${userId}`;
          outputChannel.appendLine(`Subscribing to Centrifugo channel: ${channelName}`);
          
          // Make sure centrifuge exists
          if (centrifuge) {
            // Basic subscription without events
            outputChannel.appendLine(`Setting up subscription for channel ${channelName}`);
            
            try {
              // Create a subscription object first
              const sub = centrifuge.newSubscription(channelName);
              
              // Set up message handler on the subscription
              sub.on('publication', function(ctx: any) {
                // Log every received message
                outputChannel.appendLine('========== CENTRIFUGO MESSAGE RECEIVED ==========');
                outputChannel.appendLine(`Channel: ${channelName}`);
                outputChannel.appendLine(`Message: ${JSON.stringify(ctx, null, 2)}`);
                if (ctx.data) {
                  outputChannel.appendLine(`Message data: ${JSON.stringify(ctx.data, null, 2)}`);
                }
                outputChannel.appendLine('================================================');
                
                // Process the message if it has data
                if (ctx.data) {
                  // Verify workspaceId if present
                  const msgWorkspaceId = ctx.data.workspaceId;
                  
                  // Check if workspaceId matches our current one, or skip if not present
                  if (msgWorkspaceId) {
                    // Get current workspace mappings
                    const mappings: WorkspaceMapping[] = context.globalState.get(WORKSPACE_MAPPINGS_KEY, []);
                    
                    // Check if this workspace is one we're tracking
                    const matchingMapping = mappings.find(mapping => mapping.workspaceId === msgWorkspaceId);
                    
                    if (!matchingMapping) {
                      outputChannel.appendLine(`Ignoring message for unknown workspace: ${msgWorkspaceId}`);
                      return;
                    }
                    
                    outputChannel.appendLine(`Processing message for workspace: ${msgWorkspaceId}`);
                  }
                  
                  // Check for eventType
                  if (ctx.data.eventType) {
                    outputChannel.appendLine(`Event type: ${ctx.data.eventType}`);
                    
                    // Handle different event types
                    switch (ctx.data.eventType) {
                      case 'chatmessage-updated': {
                        if (ctx.data.chatMessage && webviewGlobal) {
                          // Handle the nested structure from Centrifugo
                          const chatMessage = ctx.data.chatMessage;
                          
                          // Clean up the message object by removing the numbered properties (e.g., "0")
                          // while preserving the main message fields
                          const cleanedMessage = {
                            id: chatMessage.id,
                            prompt: chatMessage.prompt,
                            response: chatMessage.response,
                            createdAt: chatMessage.createdAt,
                            isIntentComplete: chatMessage.isIntentComplete,
                            isCanceled: chatMessage.isCanceled || false,
                            followupActions: chatMessage.followupActions,
                            responseRenderId: chatMessage.responseRenderId,
                            responsePlanId: chatMessage.responsePlanId,
                            responseConversionId: chatMessage.responseConversionId,
                            responseRollbackToRevisionNumber: chatMessage.responseRollbackToRevisionNumber,
                            revisionNumber: chatMessage.revisionNumber,
                            isComplete: chatMessage.isComplete || false
                          };
                          
                          outputChannel.appendLine(`Chat message updated: ${cleanedMessage.id}`);
                          outputChannel.appendLine(`Prompt: ${cleanedMessage.prompt}`);
                          outputChannel.appendLine(`Response: ${cleanedMessage.response}`);
                          
                          // Forward to webview
                          webviewGlobal.postMessage({
                            type: 'chatMessageUpdated',
                            message: cleanedMessage
                          });
                          outputChannel.appendLine('Forwarded chat message update to webview');
                        }
                        break;
                      }
                      default: {
                        outputChannel.appendLine(`Unhandled event type: ${ctx.data.eventType}`);
                      }
                    }
                  }
                  
                  // Backward compatibility for old response format
                  else if (ctx.data.response) {
                    if (webviewGlobal) {
                      webviewGlobal.postMessage({
                        type: 'chatResponse',
                        text: ctx.data.response
                      });
                      outputChannel.appendLine('Forwarded response to webview (legacy format)');
                    }
                  }
                }
              });
              
              // Set up error handler
              sub.on('error', function(ctx: any) {
                outputChannel.appendLine(`Subscription error for channel ${channelName}: ${JSON.stringify(ctx)}`);
              });
              
              // Set up subscription success handler
              sub.on('subscribed', function(ctx: any) {
                outputChannel.appendLine(`Successfully subscribed to channel ${channelName}`);
                outputChannel.appendLine(`Subscription details: ${JSON.stringify(ctx)}`);
              });
              
              // Set up unsubscribe handler
              sub.on('unsubscribed', function(ctx: any) {
                outputChannel.appendLine(`Unsubscribed from channel ${channelName}: ${JSON.stringify(ctx)}`);
              });
              
              // Subscribe
              sub.subscribe();
              
              outputChannel.appendLine(`Subscription created for channel ${channelName} using newSubscription method`);
            } catch (subError) {
              outputChannel.appendLine(`Error creating subscription: ${subError}`);
            }
          } else {
            outputChannel.appendLine(`Cannot subscribe: Centrifuge client is null`);
          }
        } else {
          outputChannel.appendLine('No workspace mappings found, cannot subscribe to channels');
        }
      } catch (error) {
        outputChannel.appendLine(`Error setting up channel subscriptions: ${error}`);
      }
    });
    
    centrifuge.on('disconnected', function(ctx: any) {
      outputChannel.appendLine(`Centrifugo disconnected: ${JSON.stringify(ctx)}`);
      connectionStatus = ConnectionStatus.DISCONNECTED;
      updateConnectionStatus();
      
      // Handle reconnection with exponential backoff
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      // Increment attempt counter
      reconnectAttempt++;
      
      // Calculate delay with exponential backoff
      // baseDelay * factor^attempt, maxed at maxDelay
      const baseDelay = 1000; // 1 second
      const maxDelay = 60000; // 1 minute
      const factor = 1.5;
      
      const delay = Math.min(baseDelay * Math.pow(factor, reconnectAttempt), maxDelay);
      
      outputChannel.appendLine(`Scheduling reconnection attempt ${reconnectAttempt} in ${delay/1000} seconds...`);
      
      // Only attempt reconnect if we haven't exceeded maximum attempts
      if (reconnectAttempt <= 5) {
        connectionStatus = ConnectionStatus.RECONNECTING;
        updateConnectionStatus();
        
        reconnectTimer = setTimeout(() => {
          // Only try to reconnect if we're still in RECONNECTING state
          if (connectionStatus === ConnectionStatus.RECONNECTING) {
            outputChannel.appendLine(`Attempting reconnection #${reconnectAttempt}...`);
            try {
              // Check if centrifuge client still exists
              if (centrifuge) {
                connectionStatus = ConnectionStatus.CONNECTING;
                updateConnectionStatus();
                centrifuge.connect();
              } else {
                outputChannel.appendLine(`Cannot reconnect: Centrifuge client no longer exists`);
                connectionStatus = ConnectionStatus.DISCONNECTED;
                updateConnectionStatus();
              }
            } catch (e) {
              outputChannel.appendLine(`Error during reconnection attempt: ${e}`);
              connectionStatus = ConnectionStatus.DISCONNECTED;
              updateConnectionStatus();
            }
          }
        }, delay);
      } else {
        outputChannel.appendLine(`Maximum reconnection attempts reached (${reconnectAttempt}). Giving up.`);
        connectionStatus = ConnectionStatus.DISCONNECTED;
        updateConnectionStatus();
      }
    });
    
    centrifuge.on('error', function(ctx: any) {
      outputChannel.appendLine(`Centrifugo error: ${JSON.stringify(ctx)}`);
      connectionStatus = ConnectionStatus.DISCONNECTED;
      updateConnectionStatus();
    });
    
    // Instead of using transport events directly, use the built-in events
    // and add more extensive logging
    
    // Removed global publication handler - we now handle messages at the subscription level
    // since publications are tied to specific subscriptions in Centrifuge v5
    
    // Handle connection errors with more detail
    centrifuge.on('error', function(ctx: any) {
      outputChannel.appendLine(`Centrifugo error with more details: ${JSON.stringify(ctx)}`);
      if (ctx && ctx.transport) {
        outputChannel.appendLine(`Transport details: ${JSON.stringify(ctx.transport)}`);
      }
    });
    
    // Log connection attempts with more detail
    centrifuge.on('connecting', function(ctx: any) {
      outputChannel.appendLine(`Centrifugo connecting with more details: ${JSON.stringify(ctx)}`);
      // Note: The Centrifuge client doesn't have a getTransport method in this version
      outputChannel.appendLine(`Connection attempt in progress...`);
    });
    
    // Log successful connections with more detail
    centrifuge.on('connected', function(ctx: any) {
      outputChannel.appendLine(`WebSocket connection established successfully`);
      // Access the client ID from the context if available
      if (ctx && ctx.client) {
        outputChannel.appendLine(`Client info: ${JSON.stringify(ctx.client)}`);
      }
    });
    
    // Connect to the server
    centrifuge.connect();
    
    outputChannel.appendLine('Centrifugo client initialized and connecting');
  } catch (error) {
    outputChannel.appendLine(`Error connecting to Centrifugo: ${error}`);
    connectionStatus = ConnectionStatus.DISCONNECTED;
    updateConnectionStatus();
  }
}

/**
 * Disconnect from the Centrifugo server
 */
async function disconnectFromCentrifugo(): Promise<void> {
  // Clear any reconnection timers
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Reset reconnection counter
  reconnectAttempt = 0;
  
  if (centrifuge) {
    outputChannel.appendLine('Disconnecting from Centrifugo server...');
    try {
      centrifuge.disconnect();
    } catch (e) {
      outputChannel.appendLine(`Error during disconnect: ${e}`);
    }
    centrifuge = null;
    connectionStatus = ConnectionStatus.DISCONNECTED;
    updateConnectionStatus();
  }
}

/**
 * Decode a JWT token to see its contents (for debugging)
 * @param token The JWT token to decode 
 */
function decodeJwt(token: string): { header: any, payload: any } | null {
  try {
    // Split the token into its parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      outputChannel.appendLine(`JWT token does not have three parts: ${parts.length}`);
      return null;
    }
    
    // Base64 URL decoding function for Node.js environment
    const base64UrlDecode = (str: string): string => {
      try {
        // Convert Base64URL to Base64
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        while (base64.length % 4) {
          base64 += '=';
        }
        
        // Use Buffer for Node.js environment
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        return decoded;
      } catch (error) {
        outputChannel.appendLine(`Base64 decode error: ${error}`);
        return '';
      }
    };
    
    // Safely parse JSON with a fallback for formatting errors
    const safeJsonParse = (jsonStr: string): any => {
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        outputChannel.appendLine(`Error parsing JSON: ${e}`);
        return { error: "Invalid JSON" };
      }
    };
    
    // Decode and parse header and payload
    try {
      const header = safeJsonParse(base64UrlDecode(parts[0]));
      const payload = safeJsonParse(base64UrlDecode(parts[1]));
      return { header, payload };
    } catch (decodeError) {
      outputChannel.appendLine(`Error during base64 decoding: ${decodeError}`);
      return null;
    }
  } catch (error) {
    outputChannel.appendLine(`Error decoding JWT: ${error}`);
    return null;
  }
}

/**
 * Force connection status for testing purposes
 * @param status The status to force
 */
function forceConnectionStatus(status: ConnectionStatus): void {
  connectionStatus = status;
  updateConnectionStatus();
  outputChannel.appendLine(`FORCED connection status to: ${status}`);
}

/**
 * Update the connection status indicator in the UI
 */
function updateConnectionStatus(): void {
  if (webviewGlobal) {
    webviewGlobal.postMessage({
      type: 'connectionStatus',
      status: connectionStatus
    });
    outputChannel.appendLine(`Updated connection status: ${connectionStatus}`);
  }
}

/**
 * Fetches a push token from the API's /push endpoint
 * This token is only valid for the current session
 */
async function fetchPushToken(): Promise<string | null> {
  outputChannel.appendLine('Fetching push token from API...');
  
  if (!isLoggedIn || !authData) {
    outputChannel.appendLine('Cannot fetch push token: not logged in');
    return null;
  }
  
  try {
    // Get auth token 
    const token = await getAuthToken();
    const apiEndpoint = await getApiEndpoint(); // Use API endpoint, not push endpoint
    
    if (!token || !apiEndpoint) {
      outputChannel.appendLine('Missing token or API endpoint');
      return null;
    }
    
    // Construct the push URL - this should be at the apiEndpoint, not pushEndpoint
    const pushUrl = `${apiEndpoint}/push`;
    outputChannel.appendLine(`Fetching push token from: ${pushUrl}`);
    
    // Make the HTTP request
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(pushUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      
      const options = {
        method: 'GET',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        headers: {
          'Authorization': `Token ${token}`,
          'User-Agent': 'ChartSmith-VSCode-Extension'
        }
      };
      
      const req = (isHttps ? https : http).request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk.toString();
        });
        
        res.on('end', () => {
          outputChannel.appendLine(`Push token response status: ${res.statusCode}`);
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(responseData);
              if (response.pushToken) {
                outputChannel.appendLine('Successfully fetched push token');
                resolve(response.pushToken);
              } else {
                outputChannel.appendLine('Response did not contain push token');
                resolve(null);
              }
            } catch (error) {
              outputChannel.appendLine(`Error parsing push token response: ${error}`);
              resolve(null);
            }
          } else {
            outputChannel.appendLine(`Failed to fetch push token: ${responseData}`);
            resolve(null);
          }
        });
      });
      
      req.on('error', (error) => {
        outputChannel.appendLine(`Error fetching push token: ${error}`);
        resolve(null);
      });
      
      req.end();
    });
  } catch (error) {
    outputChannel.appendLine(`Exception fetching push token: ${error}`);
    return null;
  }
}

export function deactivate() {
  outputChannel.appendLine('Extension deactivating');
  
  // Close the auth server if it's running
  if (authServer) {
    outputChannel.appendLine('Closing auth server');
    authServer.close();
    authServer = null;
  }
  
  // Disconnect from Centrifugo if connected
  if (centrifuge) {
    outputChannel.appendLine('Disconnecting from Centrifugo');
    disconnectFromCentrifugo();
  }
  
  // Clear session data
  pushToken = null;
}