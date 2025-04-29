import { Centrifuge } from 'centrifuge';
import WebSocket = require('ws');
import { GlobalState, ConnectionStatus } from '../../types';
import * as vscode from 'vscode';
import { store, actions } from '../../state/store';
import { workspaceIdAtom, Plan } from '../../state/atoms';
import * as path from 'path';
import { derivePushEndpoint } from '../endpoints';
import { AuthData } from '../../types';

// Extend global type definition to include our maps
declare global {
  var pendingContentMap: Map<string, string> | undefined;
  var chartsmithContentMap: Map<string, string> | undefined;
}

// Global content map for chartsmith diff views
// This will be accessible as global.chartsmithContentMap
if (!global.chartsmithContentMap) {
  global.chartsmithContentMap = new Map<string, string>();
}
export const chartsmithContentMap = global.chartsmithContentMap;

let globalState: GlobalState;
let onMessageCallback: ((message: any) => void) | null = null;
let reconnectMaxAttempts = 10;
let outputChannel: vscode.OutputChannel;

export function initWebSocket(state: GlobalState): void {
  globalState = state;
  // Initialize the output channel if it doesn't exist
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('ChartSmith WebSocket');
  }
  
  console.log('WebSocket module initialized');
  outputChannel.appendLine('WebSocket module initialized');
  
  // Log initial state
  if (globalState.authData) {
    outputChannel.appendLine(`Initial auth data available - API endpoint: ${globalState.authData.apiEndpoint}`);
    
    if (globalState.authData.pushEndpoint) {
      outputChannel.appendLine(`Push endpoint from authData: ${globalState.authData.pushEndpoint}`);
    } else {
      outputChannel.appendLine('No push endpoint in authData, will be derived from API endpoint when needed');
    }
    
    // Derive and log push endpoint
    if (globalState.authData.apiEndpoint) {
      const derivedPushEndpoint = derivePushEndpoint(globalState.authData.apiEndpoint);
      outputChannel.appendLine(`Derived push endpoint: ${derivedPushEndpoint}`);
    }
  } else {
    outputChannel.appendLine('No auth data available yet');
  }
}

export function setOnMessageCallback(callback: (message: any) => void): void {
  onMessageCallback = callback;
}

/**
 * Process WebSocket messages based on event type
 * @param data The message payload from Centrifugo
 * @returns true if the message was handled, false if it was ignored
 */
function handleWebSocketMessage(data: any): boolean {
  // Skip if no eventType
  if (!data || !data.eventType) {
    return false;
  }

  // Get the current workspace ID
  const currentWorkspaceId = store.get(workspaceIdAtom);

  // Skip if message workspaceId doesn't match current workspace
  if (data.workspaceId !== currentWorkspaceId) {
    return false;
  }

  // Handle different event types
  switch (data.eventType) {
    case 'chatmessage-updated':
      handleChatMessageUpdated(data);
      return true;

    case 'plan-created':
    case 'plan-updated':
      handlePlanEvent(data);
      return true;

    case 'artifact-updated':
      handleArtifactUpdated(data);
      return true;

    default:
      outputChannel.appendLine(`Unknown event type: ${data.eventType}`);
      return false;
  }
}

/**
 * Handle a chatmessage-updated event
 * @param data The message payload
 */
function handleChatMessageUpdated(data: any): void {
  outputChannel.appendLine('========= PROCESSING CHAT MESSAGE UPDATE ==========');

  if (!data.chatMessage) {
    outputChannel.appendLine('ERROR: chatmessage-updated event missing chatMessage object');
    return;
  }

  const message = data.chatMessage;
  outputChannel.appendLine(`Processing chatmessage-updated for message ID: ${message.id}`);
  outputChannel.appendLine(`Message details: ${JSON.stringify(message, null, 2)}`);

  // Check if the message has the expected structure
  if (!message.id) {
    outputChannel.appendLine('ERROR: Message is missing ID field');
    return;
  }

  // Update the message in the store
  actions.updateMessage(message);

  // Force re-render by notifying webview
  if (globalState.webviewGlobal) {
    globalState.webviewGlobal.postMessage({
      command: 'messageUpdated',
      message: message
    });
  }
}

/**
 * Handle a plan event (created or updated)
 * @param data The message payload
 */
function handlePlanEvent(data: { eventType: string, workspaceId: string, plan: Plan }): void {
  if (!data.plan) {
    return;
  }

  const plan = data.plan;

  // Check if the plan has the expected structure
  if (!plan.id) {
    return;
  }

  // Use a simpler approach that doesn't rely on dynamic imports for the atoms
  try {
    // Import plans module and use the action functions instead of direct store manipulation
    import('../plans').then(plansModule => {
      // Handle the plan message via the plans module
      plansModule.handlePlanMessage({
        type: 'plan',
        ...plan,
        workspaceId: data.workspaceId // Ensure workspaceId is from the outer data object
      });
    }).catch(error => {
      outputChannel.appendLine(`Error importing plans module: ${error}`);
    });

    // Force re-render by notifying webview
    if (globalState.webviewGlobal) {
      // First send the updated plan
      globalState.webviewGlobal.postMessage({
        command: 'newPlan',
        plan: plan
      });

      // Wait a short time to ensure plan is processed, then trigger message re-render
      setTimeout(() => {
        if (globalState.webviewGlobal) {
          globalState.webviewGlobal.postMessage({
            command: 'renderMessages'
          });
        }
      }, 100);
    }
  } catch (error) {
    outputChannel.appendLine(`Error processing plan: ${error}`);
  }
}

export async function connectWithCentrifugoJwt(): Promise<void> {
  if (!globalState.centrifugoJwt) {
    console.log('Cannot connect to Centrifugo: Missing JWT');
    return;
  }
  
  // If pushEndpoint is not available, derive it from apiEndpoint
  const pushEndpoint = globalState.authData?.pushEndpoint || 
    (globalState.authData?.apiEndpoint ? derivePushEndpoint(globalState.authData.apiEndpoint) : '');
  
  if (!pushEndpoint) {
    console.log('Cannot connect to Centrifugo: Unable to determine push endpoint');
    return;
  }

  console.log(`Connecting to Centrifugo WebSocket: ${pushEndpoint}`);
  outputChannel.appendLine(`Connecting to Centrifugo WebSocket: ${pushEndpoint}`);

  // Check current workspace ID
  const currentWorkspaceId = store.get(workspaceIdAtom);
  outputChannel.appendLine(`Current workspace ID when connecting: ${currentWorkspaceId}`);

  if (!currentWorkspaceId) {
    outputChannel.appendLine('WARNING: No workspace ID set in store when connecting to WebSocket');

    // Try to fetch it from workspace module
    try {
      const workspace = await import('../workspace');
      const activeWorkspaceId = await workspace.getActiveWorkspaceId();
      outputChannel.appendLine(`Retrieved workspace ID from storage: ${activeWorkspaceId}`);
    } catch (error) {
      outputChannel.appendLine(`Error fetching workspace ID: ${error}`);
    }
  }

  // Check if we're already connected
  if (globalState.centrifuge &&
      globalState.connectionStatus === ConnectionStatus.CONNECTED) {
    console.log('Already connected to Centrifugo');
    return;
  }

  console.log('Connecting to Centrifugo with JWT...');
  // We already checked centrifugoJwt is not null above
  if (globalState.centrifugoJwt) {
    await connectToCentrifugo(
      pushEndpoint,
      globalState.centrifugoJwt
    );
  }
}

export async function connectToCentrifugo(endpoint: string, token: string): Promise<void> {
  console.log('connectToCentrifugo called with endpoint:', endpoint);
  outputChannel.appendLine(`Connecting to Centrifugo with endpoint: ${endpoint}`);
  outputChannel.appendLine(`Using WebSocket URL: ${endpoint} (${endpoint.startsWith('wss:') ? 'secure' : 'standard'} WebSocket connection)`);
  outputChannel.appendLine(`JWT token length: ${token.length} characters, first 10 chars: ${token.substring(0, 10)}...`);

  if (globalState.centrifuge) {
    outputChannel.appendLine('Disconnecting from existing Centrifugo connection before creating a new one');
    disconnectFromCentrifugo();
  }

  updateConnectionStatus(ConnectionStatus.CONNECTING);

  try {
    outputChannel.appendLine('Creating new Centrifuge instance...');
    const centrifuge = new Centrifuge(endpoint, {
      websocket: WebSocket,
      token: token
    });

    centrifuge.on('connecting', () => {
      console.log('Connecting to Centrifugo...');
      outputChannel.appendLine('Connecting to Centrifugo...');
      updateConnectionStatus(ConnectionStatus.CONNECTING);
    });

    centrifuge.on('connected', (ctx) => {
      console.log('Connected to Centrifugo', ctx);
      outputChannel.appendLine('Connected to Centrifugo: ' + JSON.stringify(ctx, null, 2));
      updateConnectionStatus(ConnectionStatus.CONNECTED);
      globalState.reconnectAttempt = 0;
      clearReconnectTimer();
    });

    centrifuge.on('disconnected', () => {
      console.log('Disconnected from Centrifugo');
      outputChannel.appendLine('Disconnected from Centrifugo');
      updateConnectionStatus(ConnectionStatus.DISCONNECTED);
      scheduleReconnect();
    });

    centrifuge.on('error', (ctx) => {
      console.error('Centrifugo connection error:', ctx);
      outputChannel.appendLine('Centrifugo connection error: ' + JSON.stringify(ctx, null, 2));
    });

    // Subscribe to workspace-specific channel
    // We need both userId and workspaceId to construct the channel name
    if (globalState.authData?.userId) {
      // Get the active workspace ID from the global state
      const workspace = async () => {
        try {
          const workspaceModule = await import('../workspace');
          return await workspaceModule.getActiveWorkspaceId();
        } catch (error) {
          outputChannel.appendLine(`Error getting active workspace ID: ${error}`);
          return null;
        }
      };

      workspace().then(async (workspaceId) => {
        if (!workspaceId) {
          outputChannel.appendLine('No active workspace ID found, cannot subscribe to channel');
          return;
        }

        // Import the workspace module to use the helper function
        const workspaceModule = await import('../workspace');

        // Create the workspace/user specific channel
        const channel = workspaceModule.constructChannelName(
          workspaceId,
          globalState.authData?.userId || ''
        );
        outputChannel.appendLine(`Subscribing to channel: ${channel}`);
        const sub = centrifuge.newSubscription(channel);

        sub.on('publication', (ctx) => {
          // Process the message
          outputChannel.appendLine(`Received publication on channel ${channel}`);
          const handled = handleWebSocketMessage(ctx.data);

          // Also call the legacy callback if it exists
          if (onMessageCallback) {
            onMessageCallback(ctx.data);
          }
        });

        sub.on('error', (ctx) => {
          console.error('Subscription error:', ctx);
          outputChannel.appendLine(`Subscription error on channel ${channel}: ${JSON.stringify(ctx, null, 2)}`);
        });

        // Add subscription handler
        sub.on('subscribed', (ctx) => {
          outputChannel.appendLine(`Successfully subscribed to channel: ${channel}`);
        });

        sub.subscribe();

      }).catch(error => {
        outputChannel.appendLine(`Error subscribing to channel: ${error}`);
      });
    }

    outputChannel.appendLine('Calling connect() on Centrifuge instance...');
    centrifuge.connect();
    globalState.centrifuge = centrifuge;
  } catch (error) {
    outputChannel.appendLine(`Error during Centrifugo connection setup: ${error}`);
    console.error('Error during Centrifugo connection setup:', error);
    updateConnectionStatus(ConnectionStatus.DISCONNECTED);
  }
}

export function disconnectFromCentrifugo(): void {
  if (globalState.centrifuge) {
    globalState.centrifuge.disconnect();
    globalState.centrifuge = null;
    updateConnectionStatus(ConnectionStatus.DISCONNECTED);
  }
}

export function updateConnectionStatus(status: ConnectionStatus): void {
  globalState.connectionStatus = status;
  updateWebViewConnectionStatus();
}

function updateWebViewConnectionStatus(): void {
  if (globalState.webviewGlobal) {
    globalState.webviewGlobal.postMessage({
      command: 'connectionStatus',
      status: globalState.connectionStatus
    });
  }
}

function scheduleReconnect(): void {
  if (globalState.reconnectTimer) {
    clearTimeout(globalState.reconnectTimer);
  }

  if (globalState.reconnectAttempt >= reconnectMaxAttempts) {
    console.log('Max reconnect attempts reached');
    return;
  }

  const delay = Math.min(1000 * Math.pow(2, globalState.reconnectAttempt), 30000);
  globalState.reconnectAttempt++;
  updateConnectionStatus(ConnectionStatus.RECONNECTING);

  console.log(`Scheduling reconnect in ${delay}ms (attempt ${globalState.reconnectAttempt}/${reconnectMaxAttempts})`);

  globalState.reconnectTimer = setTimeout(async () => {
    if (globalState.centrifugoJwt && globalState.authData) {
      // Use the JWT that we know is not null
      const jwt = globalState.centrifugoJwt;
      
      // If pushEndpoint is not available, derive it from apiEndpoint
      const pushEndpoint = globalState.authData?.pushEndpoint || 
        (globalState.authData?.apiEndpoint ? derivePushEndpoint(globalState.authData.apiEndpoint) : '');
      
      if (!pushEndpoint) {
        console.log('Cannot reconnect to Centrifugo: Unable to determine push endpoint');
        return;
      }
      
      await connectToCentrifugo(
        pushEndpoint,
        jwt
      );
    } else if (globalState.authData) {
      console.log('No Centrifugo JWT available for reconnect, attempting to get one');
      // Try to fetch a new token
      try {
        const api = await import('../api');
        const pushResponse = await api.fetchApi(
          globalState.authData,
          '/push',
          'GET'
        );

        if (pushResponse && pushResponse.pushToken) {
          globalState.centrifugoJwt = pushResponse.pushToken;
          console.log('Got new JWT for reconnect');
          
          // If pushEndpoint is not available, derive it from apiEndpoint
          const pushEndpoint = globalState.authData?.pushEndpoint || 
            (globalState.authData?.apiEndpoint ? derivePushEndpoint(globalState.authData.apiEndpoint) : '');
          
          if (!pushEndpoint) {
            console.log('Cannot reconnect to Centrifugo: Unable to determine push endpoint');
            return;
          }
          
          // Since we just set it to pushToken which is a string, we can safely assert it's a string
          await connectToCentrifugo(
            pushEndpoint,
            pushResponse.pushToken // Use the pushToken directly
          );
        }
      } catch (error) {
        console.error('Failed to get new JWT for reconnect:', error);
      }
    }
  }, delay);
}

function clearReconnectTimer(): void {
  if (globalState.reconnectTimer) {
    clearTimeout(globalState.reconnectTimer);
    globalState.reconnectTimer = null;
  }
}

/**
 * Handle an artifact-updated event
 * @param data The message payload containing the file object
 */
async function handleArtifactUpdated(data: any): Promise<void> {
  try {
    outputChannel.appendLine('========= HANDLING ARTIFACT UPDATE ==========');
    outputChannel.appendLine(JSON.stringify(data, null, 2));
    
    if (!data.file) {
      outputChannel.appendLine('No file data in artifact update');
      return;
    }
    
    const file = data.file;
    
    // Get the active workspace
    const workspace = await import('../workspace');
    const workspaceId = await workspace.getActiveWorkspaceId();
    
    if (!workspaceId) {
      outputChannel.appendLine('No active workspace ID');
      return;
    }
    
    outputChannel.appendLine(`Active workspace ID: ${workspaceId}`);
    
    // Get the mapping for this workspace
    const mapping = await workspace.getWorkspaceMapping(workspaceId);
    
    if (!mapping || !mapping.localPath) {
      outputChannel.appendLine('No workspace mapping found');
      return;
    }

    // The localPath is the full path to the chart directory
    const chartBasePath = mapping.localPath;

    // Create a normalized version of file path
    let filePath = file.filePath;
    const normalizedFilePath = filePath.replace(/^\/+/, ''); // Remove leading slashes
    
    // Get the chart name from the last part of chartBasePath
    const chartName = chartBasePath.split('/').pop() || '';
    
    // Handle potential chart name duplication in a more robust way
    let processedFilePath = normalizedFilePath;
    
    // If filePath starts with chartName/ and chart name isn't empty, remove it to avoid duplication
    if (chartName && normalizedFilePath.startsWith(`${chartName}/`)) {
      processedFilePath = normalizedFilePath.substring(chartName.length + 1);
      outputChannel.appendLine(`Removed chart name prefix: ${chartName}/ from file path`);
    }
    
    // Create the full file path by properly joining paths
    const path = require('path');
    const fullFilePath = path.join(chartBasePath, processedFilePath);
    
    outputChannel.appendLine(`File path analysis:
      Original: ${file.filePath}
      Normalized: ${normalizedFilePath}
      Chart name: ${chartName}
      Processed: ${processedFilePath}
      Final path: ${fullFilePath}
    `);

    // Always store the pending content when we get it, regardless of whether we show it
    if (file.content_pending) {
      outputChannel.appendLine('File has pending content, storing it');

      // Store the content in both our global maps for future access
      // This ensures it's available whenever it's needed later
      if (!global.pendingContentMap) {
        global.pendingContentMap = new Map<string, string>();
      }
      
      // Store the content with the file path as the key (use original file path from artifact)
      global.pendingContentMap.set(file.filePath, file.content_pending);
      
      // Also store in the traditional chartsmith content map
      chartsmithContentMap.set(file.filePath, file.content_pending);
      
      outputChannel.appendLine(`Stored pending content in global maps for ${file.filePath}`);
      
      // Log the number of stored file contents for debugging
      outputChannel.appendLine(`Currently tracking pending content for ${global.pendingContentMap.size} files`);
      
      // Store the content in the file object's contentPending property for consistency
      if (!('contentPending' in file)) {
        (file as any).contentPending = file.content_pending;
      }
      
      // Show the diff view if there's pending content
      outputChannel.appendLine('Showing diff view for file with pending content');
      
      // Import the render module to use the showFileDiff function
      const renderModule = await import('../render');

      try {
        // Show the diff between the current file content and the pending content
        const result = await renderModule.showFileDiff(
          fullFilePath,
          file.content_pending || '',
          `ChartSmith Update: ${path.basename(file.filePath)}`
        );

        outputChannel.appendLine(`Diff result - changes applied: ${result.applied}`);
      } catch (error) {
        outputChannel.appendLine(`Error showing diff view: ${error}`);

        // Fallback approach: directly apply the pending content
        try {
          outputChannel.appendLine('Falling back to direct content application');

          // Ensure directory exists
          const fs = require('fs');
          const path = require('path');

          await fs.promises.mkdir(path.dirname(fullFilePath), { recursive: true });

          // Write the pending content to the file
          await fs.promises.writeFile(fullFilePath, file.content_pending || '');
          outputChannel.appendLine(`Applied pending content directly to: ${fullFilePath}`);

          // Open the file
          await vscode.window.showTextDocument(vscode.Uri.file(fullFilePath));

          vscode.window.showInformationMessage(`Updated ${path.basename(file.filePath)} with new content`);
        } catch (fallbackError) {
          outputChannel.appendLine(`Error in fallback approach: ${fallbackError}`);
        }
      }
    } else {
      // No pending content, just open the file normally
      try {
        // Try to open the file in the editor
        await vscode.window.showTextDocument(vscode.Uri.file(fullFilePath));
        outputChannel.appendLine('File opened successfully');
      } catch (openError) {
        outputChannel.appendLine(`Could not open file, attempting to create it: ${openError}`);

        try {
          // Create directory recursively
          const fs = require('fs');
          const path = require('path');

          await fs.promises.mkdir(path.dirname(fullFilePath), { recursive: true });

          // Create an empty file
          await fs.promises.writeFile(fullFilePath, '');
          outputChannel.appendLine(`Created empty file: ${fullFilePath}`);

          // Now open the newly created file
          await vscode.window.showTextDocument(vscode.Uri.file(fullFilePath));
          outputChannel.appendLine('Created and opened empty file successfully');
        } catch (createError) {
          outputChannel.appendLine(`Failed to create file: ${createError}`);
          throw createError; // Re-throw to be caught by the outer catch
        }
      }
    }
  } catch (error) {
    outputChannel.appendLine(`ERROR handling artifact-updated event: ${error}`);
  }
}

/**
 * Helper function to diagnose WebSocket connection issues
 * @returns A detailed object with connection information
 */
export function debugConnectionInfo(): any {
  const info = {
    connectionStatus: globalState.connectionStatus,
    hasCentrifuge: !!globalState.centrifuge,
    hasCentrifugoJwt: !!globalState.centrifugoJwt,
    reconnectAttempt: globalState.reconnectAttempt,
    authData: null as any,
    derivedPushEndpoint: null as string | null
  };
  
  // Include auth data info (without token)
  if (globalState.authData) {
    info.authData = {
      hasApiEndpoint: !!globalState.authData.apiEndpoint,
      apiEndpoint: globalState.authData.apiEndpoint,
      hasPushEndpoint: !!globalState.authData.pushEndpoint,
      pushEndpoint: globalState.authData.pushEndpoint,
      hasWwwEndpoint: !!globalState.authData.wwwEndpoint,
      wwwEndpoint: globalState.authData.wwwEndpoint,
      hasUserId: !!globalState.authData.userId,
      hasToken: !!globalState.authData.token
    };
    
    // Derive push endpoint to check if it matches the current one
    if (globalState.authData.apiEndpoint) {
      info.derivedPushEndpoint = derivePushEndpoint(globalState.authData.apiEndpoint);
    }
  }
  
  outputChannel.appendLine(`---------- WebSocket Debug Info ----------`);
  outputChannel.appendLine(JSON.stringify(info, null, 2));
  outputChannel.appendLine(`----------------------------------------`);
  
  return info;
}

/**
 * Creates a WebSocket connection using authentication data
 * @param authData Authentication data containing pushEndpoint and JWT
 * @returns Promise resolving to a Centrifuge connection
 */
export async function createWebsocketConnection(authData: AuthData): Promise<Centrifuge> {
  const websocketEndpoint = authData.pushEndpoint;
  const jwt = authData.token;
  
  if (!websocketEndpoint) {
    throw new Error('WebSocket endpoint is not available');
  }
  
  if (!jwt) {
    throw new Error('JWT is not available');
  }
  
  const url = new URL(websocketEndpoint);
  const isSecure = url.protocol === 'wss:';
  
  console.log(`Connecting to WebSocket at: ${websocketEndpoint}`);
  console.log(`Connection type: ${isSecure ? 'Secure (WSS)' : 'Standard (WS)'}`);
  console.log(`JWT token length: ${jwt.length} characters`);
  outputChannel.appendLine(`Creating WebSocket connection to: ${websocketEndpoint}`);
  outputChannel.appendLine(`Using ${isSecure ? 'secure' : 'standard'} WebSocket protocol`);
  outputChannel.appendLine(`Path: ${url.pathname}`);
  
  const connection = new Centrifuge(websocketEndpoint, {
    websocket: WebSocket,
    token: jwt
  });
  
  return connection;
}
