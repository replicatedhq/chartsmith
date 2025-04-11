import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import * as url from 'url';

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
}

let authData: AuthData | null = null;
let isLoggedIn = false;
let authServer: http.Server | null = null;
let webviewGlobal: vscode.Webview | null = null;
let outputChannel: vscode.OutputChannel;
let secretStorage: vscode.SecretStorage;
let context: vscode.ExtensionContext;
let pushToken: string | null = null; // Session-specific push token

// Storage keys
const AUTH_TOKEN_KEY = 'chartsmith.authToken';
const API_ENDPOINT_KEY = 'chartsmith.apiEndpoint';
const PUSH_ENDPOINT_KEY = 'chartsmith.pushEndpoint';
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
    
    if (storedToken && storedApiEndpoint) {
      outputChannel.appendLine('Found stored authentication data');
      authData = { 
        token: storedToken,
        apiEndpoint: storedApiEndpoint,
        pushEndpoint: storedPushEndpoint || '' // Use empty string if not found
      };
      isLoggedIn = true;
      outputChannel.appendLine(`API endpoint: ${storedApiEndpoint}`);
      if (storedPushEndpoint) {
        outputChannel.appendLine(`Push endpoint: ${storedPushEndpoint}`);
      } else {
        outputChannel.appendLine('No push endpoint found (older login)');
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
          
          if (tokenValue && apiEndpointValue) {
            outputChannel.appendLine('Valid auth data found in response');
            outputChannel.appendLine(`API endpoint: ${apiEndpointValue}`);
            
            // Store the auth data in memory
            authData = { 
              token: tokenValue,
              apiEndpoint: apiEndpointValue,
              pushEndpoint: pushEndpointValue || '' // Use empty string if not provided
            };
            isLoggedIn = true;
            
            // Store auth data in secure storage
            try {
              await secretStorage.store(AUTH_TOKEN_KEY, tokenValue);
              await secretStorage.store(API_ENDPOINT_KEY, apiEndpointValue);
              if (pushEndpointValue) {
                await secretStorage.store(PUSH_ENDPOINT_KEY, pushEndpointValue);
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
                        
                        // Log detailed response information
                        outputChannel.appendLine(`\n==== CHART UPLOAD RESPONSE ====`);
                        outputChannel.appendLine(`Status: Success`);
                        
                        if (typeof uploadResponse === 'object') {
                          // Pretty print the response with indentation for better readability
                          const prettyJson = JSON.stringify(uploadResponse, null, 2);
                          outputChannel.appendLine(`Response data:\n${prettyJson}`);
                          
                          // Log specific fields if they exist
                          if (uploadResponse.id) {
                            outputChannel.appendLine(`Chart ID: ${uploadResponse.id}`);
                          }
                          if (uploadResponse.name) {
                            outputChannel.appendLine(`Chart Name: ${uploadResponse.name}`);
                          }
                          if (uploadResponse.version) {
                            outputChannel.appendLine(`Chart Version: ${uploadResponse.version}`);
                          }
                          if (uploadResponse.url) {
                            outputChannel.appendLine(`Chart URL: ${uploadResponse.url}`);
                          }
                          
                          // Extract the workspaceId from the response and save the mapping
                          if (uploadResponse.workspaceId) {
                            outputChannel.appendLine(`Workspace ID: ${uploadResponse.workspaceId}`);
                            
                            // Save the mapping between local directory and ChartSmith workspace
                            this.saveWorkspaceMapping(chartDir, uploadResponse.workspaceId);
                            
                            // Log all mappings for debugging
                            const allMappings = this.getAllWorkspaceMappings();
                            outputChannel.appendLine(`Total workspace mappings: ${allMappings.length}`);
                            allMappings.forEach((mapping, index) => {
                              outputChannel.appendLine(`  ${index + 1}. ${mapping.localPath} -> ${mapping.workspaceId} (${mapping.lastUpdated})`);
                            });
                          } else {
                            outputChannel.appendLine(`Warning: No workspaceId received from server`);
                          }
                        } else {
                          outputChannel.appendLine(`Response data: ${uploadResponse}`);
                        }
                        outputChannel.appendLine(`==== END RESPONSE ====\n`);
                        
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
                
                // Log detailed message structure to help debug rendering issues
                outputChannel.appendLine(`Message structure details:`);
                if (Array.isArray(messages)) {
                  outputChannel.appendLine(`MESSAGES ARRAY RECEIVED: ${JSON.stringify(messages)}`);
                  messages.forEach((msg, idx) => {
                    outputChannel.appendLine(`Message ${idx + 1}:`);
                    outputChannel.appendLine(`  Full message: ${JSON.stringify(msg)}`);
                    
                    // Log specific properties we're interested in
                    if (msg.role) outputChannel.appendLine(`  Role: ${msg.role}`);
                    if (msg.content) {
                      outputChannel.appendLine(`  Content: ${msg.content}`);
                      outputChannel.appendLine(`  Content type: ${typeof msg.content}`);
                      
                      // Check if content is an object
                      if (typeof msg.content === 'object') {
                        outputChannel.appendLine(`  Content is an object, keys: ${Object.keys(msg.content).join(', ')}`);
                        
                        // Check if content contains a text property
                        if (msg.content.text) {
                          outputChannel.appendLine(`  Content.text: ${msg.content.text}`);
                        }
                        
                        // Check if content contains a parts property (common in some APIs)
                        if (Array.isArray(msg.content.parts)) {
                          outputChannel.appendLine(`  Content.parts is an array with ${msg.content.parts.length} elements`);
                          msg.content.parts.forEach((part: any, partIdx: number) => {
                            outputChannel.appendLine(`    Part ${partIdx + 1}: ${JSON.stringify(part)}`);
                          });
                        }
                      } else {
                        outputChannel.appendLine(`  Content length: ${msg.content.length}`);
                      }
                    } else {
                      outputChannel.appendLine(`  Content is null or undefined`);
                      
                      // Check for alternative content fields
                      if (msg.text) outputChannel.appendLine(`  Text field found: ${msg.text}`);
                      if (msg.message) outputChannel.appendLine(`  Message field found: ${msg.message}`);
                    }
                    
                    // Log all properties on the message object
                    outputChannel.appendLine(`  All properties:`);
                    Object.keys(msg).forEach(key => {
                      const value = msg[key];
                      const valuePreview = typeof value === 'object' ? 
                        `[${typeof value}] with keys: ${Object.keys(value || {}).join(', ')}` : 
                        JSON.stringify(value);
                      outputChannel.appendLine(`    ${key}: ${valuePreview}`);
                    });
                  });
                } else {
                  outputChannel.appendLine(`Messages is not an array: ${typeof messages}`);
                  outputChannel.appendLine(`Messages content: ${JSON.stringify(messages)}`);
                  
                  // Check if messages is an object with a 'messages' property (nested structure)
                  if (messages && typeof messages === 'object' && messages.messages) {
                    outputChannel.appendLine(`Found nested 'messages' property: ${JSON.stringify(messages.messages)}`);
                    if (Array.isArray(messages.messages)) {
                      outputChannel.appendLine(`Nested messages is an array with ${messages.messages.length} elements`);
                    }
                  }
                }
                
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
      const sendUrl = this.constructApiUrl(apiEndpoint, `workspace/${workspaceId}/messages`);
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
            outputChannel.appendLine(`Response status: ${res.statusCode}`);
            outputChannel.appendLine(`Response data: ${responseData}`);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                // Parse response data
                const responseJson = JSON.parse(responseData);
                
                // Log the full response for debugging
                outputChannel.appendLine(`\n==== FULL CHAT RESPONSE ====`);
                outputChannel.appendLine(`Full response JSON: ${JSON.stringify(responseJson)}`);
                outputChannel.appendLine(`Response type: ${typeof responseJson}`);
                
                // Try to find the response content
                let responseText = '';
                
                // Check various possible response formats with detailed logging
                outputChannel.appendLine(`Response top-level keys: ${Object.keys(responseJson).join(', ')}`);
                
                // Case 1: Direct response field
                if (responseJson.response !== undefined) {
                  const responseType = typeof responseJson.response;
                  outputChannel.appendLine(`Found 'response' field (type: ${responseType})`);
                  
                  if (responseType === 'string') {
                    responseText = responseJson.response;
                    outputChannel.appendLine(`Using string from 'response' field: ${responseText}`);
                  } else if (responseType === 'object') {
                    // It could be a nested object, try to find text in it
                    outputChannel.appendLine(`'response' is an object with keys: ${Object.keys(responseJson.response || {}).join(', ')}`);
                    
                    const respObj = responseJson.response;
                    if (respObj && respObj.text) {
                      responseText = respObj.text;
                      outputChannel.appendLine(`Using text from response.text: ${responseText}`);
                    } else if (respObj && respObj.content) {
                      responseText = typeof respObj.content === 'string' ? respObj.content : JSON.stringify(respObj.content);
                      outputChannel.appendLine(`Using content from response.content: ${responseText}`);
                    } else {
                      // Just stringify the object
                      responseText = JSON.stringify(responseJson.response);
                      outputChannel.appendLine(`Using stringified response object: ${responseText}`);
                    }
                  } else {
                    // Convert to string
                    responseText = String(responseJson.response);
                    outputChannel.appendLine(`Converting non-string response to string: ${responseText}`);
                  }
                }
                // Case 2: Message field
                else if (responseJson.message !== undefined) {
                  const messageType = typeof responseJson.message;
                  outputChannel.appendLine(`Found 'message' field (type: ${messageType})`);
                  
                  if (messageType === 'string') {
                    responseText = responseJson.message;
                    outputChannel.appendLine(`Using string from 'message' field: ${responseText}`);
                  } else if (messageType === 'object') {
                    // Could be a message object
                    outputChannel.appendLine(`'message' is an object with keys: ${Object.keys(responseJson.message || {}).join(', ')}`);
                    
                    const msgObj = responseJson.message;
                    if (msgObj && msgObj.content) {
                      const contentType = typeof msgObj.content;
                      outputChannel.appendLine(`Found message.content (type: ${contentType})`);
                      
                      if (contentType === 'string') {
                        responseText = msgObj.content;
                      } else if (contentType === 'object' && msgObj.content.text) {
                        responseText = msgObj.content.text;
                        outputChannel.appendLine(`Using text from message.content.text: ${responseText}`);
                      } else {
                        responseText = JSON.stringify(msgObj.content);
                        outputChannel.appendLine(`Using stringified message.content: ${responseText}`);
                      }
                    } else if (msgObj && msgObj.text) {
                      responseText = msgObj.text;
                      outputChannel.appendLine(`Using text from message.text: ${responseText}`);
                    } else {
                      responseText = JSON.stringify(responseJson.message);
                      outputChannel.appendLine(`Using stringified message object: ${responseText}`);
                    }
                  } else {
                    responseText = String(responseJson.message);
                    outputChannel.appendLine(`Converting non-string message to string: ${responseText}`);
                  }
                }
                // Case 3: Content field
                else if (responseJson.content !== undefined) {
                  const contentType = typeof responseJson.content;
                  outputChannel.appendLine(`Found 'content' field (type: ${contentType})`);
                  
                  if (contentType === 'string') {
                    responseText = responseJson.content;
                    outputChannel.appendLine(`Using string from 'content' field: ${responseText}`);
                  } else if (contentType === 'object') {
                    outputChannel.appendLine(`'content' is an object with keys: ${Object.keys(responseJson.content || {}).join(', ')}`);
                    
                    const contentObj = responseJson.content;
                    if (contentObj && contentObj.text) {
                      responseText = contentObj.text;
                      outputChannel.appendLine(`Using text from content.text: ${responseText}`);
                    } else if (contentObj && Array.isArray(contentObj.parts) && contentObj.parts.length > 0) {
                      // Handle parts array (common in some APIs)
                      responseText = contentObj.parts.map((part: any) => 
                        typeof part === 'string' ? part : JSON.stringify(part)
                      ).join(' ');
                      outputChannel.appendLine(`Using joined parts from content.parts: ${responseText}`);
                    } else {
                      responseText = JSON.stringify(responseJson.content);
                      outputChannel.appendLine(`Using stringified content object: ${responseText}`);
                    }
                  } else {
                    responseText = String(responseJson.content);
                    outputChannel.appendLine(`Converting non-string content to string: ${responseText}`);
                  }
                }
                // Case 4: Text field
                else if (responseJson.text !== undefined) {
                  responseText = typeof responseJson.text === 'string' ? 
                    responseJson.text : JSON.stringify(responseJson.text);
                  outputChannel.appendLine(`Using value from 'text' field: ${responseText}`);
                }
                // Case 5: Result field
                else if (responseJson.result !== undefined) {
                  responseText = typeof responseJson.result === 'string' ? 
                    responseJson.result : JSON.stringify(responseJson.result);
                  outputChannel.appendLine(`Using value from 'result' field: ${responseText}`);
                }
                // Case 6: Data field
                else if (responseJson.data !== undefined) {
                  // Check if data contains a message or response
                  const dataObj = responseJson.data;
                  outputChannel.appendLine(`Found 'data' field, type: ${typeof dataObj}`);
                  
                  if (typeof dataObj === 'object') {
                    outputChannel.appendLine(`'data' object keys: ${Object.keys(dataObj || {}).join(', ')}`);
                    
                    if (dataObj.text) {
                      responseText = dataObj.text;
                      outputChannel.appendLine(`Using text from data.text: ${responseText}`);
                    } else if (dataObj.message) {
                      responseText = typeof dataObj.message === 'string' ? 
                        dataObj.message : JSON.stringify(dataObj.message);
                      outputChannel.appendLine(`Using message from data.message: ${responseText}`);
                    } else if (dataObj.content) {
                      responseText = typeof dataObj.content === 'string' ? 
                        dataObj.content : JSON.stringify(dataObj.content);
                      outputChannel.appendLine(`Using content from data.content: ${responseText}`);
                    } else if (dataObj.response) {
                      responseText = typeof dataObj.response === 'string' ? 
                        dataObj.response : JSON.stringify(dataObj.response);
                      outputChannel.appendLine(`Using response from data.response: ${responseText}`);
                    } else {
                      // Use the full data object as last resort
                      responseText = JSON.stringify(dataObj);
                      outputChannel.appendLine(`Using stringified data object: ${responseText}`);
                    }
                  } else {
                    responseText = String(dataObj);
                    outputChannel.appendLine(`Using data field converted to string: ${responseText}`);
                  }
                }
                // Case 7: No direct match, look in all properties
                else {
                  // Log all top-level properties to help identify where the response might be
                  outputChannel.appendLine(`No standard fields found. All response properties:`);
                  Object.keys(responseJson).forEach(key => {
                    const value = responseJson[key];
                    const valuePreview = typeof value === 'object' ? 
                      `[${typeof value}] with keys: ${Object.keys(value || {}).join(', ')}` : 
                      JSON.stringify(value);
                    outputChannel.appendLine(`  Property '${key}': ${valuePreview}`);
                    
                    // Check if this property contains a message-like structure
                    if (value && typeof value === 'object') {
                      const obj = value;
                      if (obj.content || obj.message || obj.text || obj.response) {
                        outputChannel.appendLine(`  Property '${key}' contains a potential message object`);
                        
                        // Try to extract usable text
                        if (!responseText) {
                          if (obj.text) {
                            responseText = typeof obj.text === 'string' ? obj.text : JSON.stringify(obj.text);
                            outputChannel.appendLine(`  Using text from ${key}.text: ${responseText}`);
                          } else if (obj.content) {
                            responseText = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content);
                            outputChannel.appendLine(`  Using content from ${key}.content: ${responseText}`);
                          } else if (obj.message) {
                            responseText = typeof obj.message === 'string' ? obj.message : JSON.stringify(obj.message);
                            outputChannel.appendLine(`  Using message from ${key}.message: ${responseText}`);
                          } else if (obj.response) {
                            responseText = typeof obj.response === 'string' ? obj.response : JSON.stringify(obj.response);
                            outputChannel.appendLine(`  Using response from ${key}.response: ${responseText}`);
                          }
                        }
                      }
                    }
                  });
                  
                  // If still no response found, use the entire response as a last resort
                  if (!responseText) {
                    // First, look for any properties that are strings of reasonable length
                    const stringProps = Object.entries(responseJson)
                      .filter(([, v]) => typeof v === 'string' && v.length > 0 && v.length < 1000);
                    
                    if (stringProps.length > 0) {
                      // Use the longest string property as it's most likely to be content
                      const stringPropsWithDefinedType: Array<[string, string]> = stringProps as Array<[string, string]>;
                      const longestEntry = stringPropsWithDefinedType.reduce((longest, current) => 
                        (current[1].length > longest[1].length) ? current : longest,
                        ['', ''] as [string, string]
                      );
                      const key = longestEntry[0];
                      const value = longestEntry[1];
                      responseText = value;
                      outputChannel.appendLine(`Using longest string property '${key}': ${responseText}`);
                    } else {
                      // No suitable string properties, use a generic message
                      responseText = "Message sent, but could not find response content in server reply.";
                      outputChannel.appendLine(`No suitable content found, using generic message`);
                    }
                  }
                }
                
                outputChannel.appendLine(`==== END CHAT RESPONSE ANALYSIS ====\n`);
                
                // If responseText is empty or only whitespace, use a fallback message
                if (!responseText || responseText.trim() === '') {
                  responseText = "Received empty response from server.";
                  outputChannel.appendLine(`Response text was empty, using fallback message`);
                }
                
                // Send the found response to the webview
                webview.postMessage({ 
                  type: 'chatResponse', 
                  text: responseText 
                });
                
                outputChannel.appendLine(`Sent chat response to webview: ${responseText}`);
                
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
        
        // Write message data
        const messageData = JSON.stringify({
          message: message
        });
        
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
          .user-message {
            background-color: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #fff);
            align-self: flex-end;
            margin-left: auto;
            border-bottom-right-radius: 2px;
          }
          .assistant-message {
            background-color: var(--vscode-editor-lineHighlightBackground, rgba(255,255,255,0.08));
            color: var(--vscode-editor-foreground);
            align-self: flex-start;
            margin-right: auto;
            border-bottom-left-radius: 2px;
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
          }
          .chart-path-container {
            display: flex;
            align-items: center;
            font-size: 12px;
            position: relative;
            padding-left: 20px;
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
          
          // Initialize by checking auth status
          vscode.postMessage({
            command: 'checkAuthStatus'
          });
          
          // Check for workspace mappings to determine if chat should be shown
          vscode.postMessage({
            command: 'checkWorkspaceMappings'
          });
          
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
          function addMessage(text, isUser) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
            messageElement.textContent = text;
            chatMessages.appendChild(messageElement);
            
            // Scroll to the bottom of the chat
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
          
          // Function to send a message
          function sendMessage() {
            const messageText = chatInput.value.trim();
            if (!messageText) return;
            
            // Add user message to chat
            addMessage(messageText, true);
            
            // Send message to extension
            vscode.postMessage({
              command: 'sendChatMessage',
              text: messageText
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
          
          // Message handler
          window.addEventListener('message', function(event) {
            var message = event.data;
            console.log('Received message:', message);
            
            if (message.type === 'auth-success') {
              console.log('Auth success! Updating UI');
              if (loginContainer) loginContainer.style.display = 'none';
              if (loggedInContainer) loggedInContainer.style.display = 'block';
            } else if (message.type === 'auth-logout') {
              console.log('Logged out! Updating UI');
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
            } else if (message.type === 'chatResponse') {
              // Add assistant message to chat
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
                    
                    // First add the user message (prompt)
                    var promptContent = msg.prompt;
                    console.log('Adding user message from prompt:', promptContent);
                    addMessage(promptContent, true);
                    
                    // Then add the system response
                    var responseContent = msg.response;
                    console.log('Adding assistant message from response:', responseContent);
                    addMessage(responseContent, false);
                    
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
                  
                  // Add the message to the UI
                  console.log('Adding message:', content);
                  addMessage(content, isUser);
                });
                
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

export function deactivate() {
  outputChannel.appendLine('Extension deactivating');
  if (authServer) {
    outputChannel.appendLine('Closing auth server');
    authServer.close();
    authServer = null;
  }
}