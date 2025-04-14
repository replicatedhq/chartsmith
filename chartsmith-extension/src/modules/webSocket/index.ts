import { Centrifuge } from 'centrifuge';
import WebSocket = require('ws');
import { GlobalState, ConnectionStatus } from '../../types';
import * as vscode from 'vscode';
import { store, actions } from '../../state/store';
import { workspaceIdAtom, Plan } from '../../state/atoms';

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
  outputChannel.appendLine('========= PROCESSING WEBSOCKET MESSAGE ==========');
  outputChannel.appendLine(`Message data: ${JSON.stringify(data, null, 2)}`);
  
  // Skip if no eventType
  if (!data || !data.eventType) {
    outputChannel.appendLine('Received message with no eventType, ignoring');
    return false;
  }
  
  // Get the current workspace ID
  const currentWorkspaceId = store.get(workspaceIdAtom);
  outputChannel.appendLine(`Current workspace ID: ${currentWorkspaceId}`);
  outputChannel.appendLine(`Message workspace ID: ${data.workspaceId}`);
  
  // Skip if message workspaceId doesn't match current workspace
  if (data.workspaceId !== currentWorkspaceId) {
    outputChannel.appendLine(`Message workspaceId ${data.workspaceId} doesn't match current workspace ${currentWorkspaceId}, ignoring`);
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
  outputChannel.appendLine('========= PROCESSING PLAN EVENT ==========');
  
  if (!data.plan) {
    outputChannel.appendLine('ERROR: plan event missing plan object');
    return;
  }
  
  const plan = data.plan;
  outputChannel.appendLine(`Processing plan event for plan ID: ${plan.id}`);
  outputChannel.appendLine(`Plan details: ${JSON.stringify(plan, null, 2)}`);
  
  // Check if the plan has the expected structure
  if (!plan.id) {
    outputChannel.appendLine('ERROR: Plan is missing ID field');
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
  if (!globalState.centrifugoJwt || !globalState.authData?.pushEndpoint) {
    console.log('Cannot connect to Centrifugo: Missing JWT or endpoint');
    return;
  }
  
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
      globalState.authData.pushEndpoint,
      globalState.centrifugoJwt
    );
  }
}

export async function connectToCentrifugo(endpoint: string, token: string): Promise<void> {
  console.log('connectToCentrifugo called with endpoint:', endpoint);
  
  if (globalState.centrifuge) {
    disconnectFromCentrifugo();
  }

  updateConnectionStatus(ConnectionStatus.CONNECTING);

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
        console.log('Received message from server:', ctx.data);
        outputChannel.appendLine('==========================================');
        outputChannel.appendLine(`CENTRIFUGO MESSAGE RECEIVED ON CHANNEL: ${channel}`);
        outputChannel.appendLine('==========================================');
        outputChannel.appendLine(JSON.stringify(ctx.data, null, 2));
        outputChannel.appendLine('==========================================');
        
        // Process the message
        const handled = handleWebSocketMessage(ctx.data);
        outputChannel.appendLine(`Message handled: ${handled}`);
        
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
        outputChannel.appendLine(`Subscription context: ${JSON.stringify(ctx, null, 2)}`);
      });

      sub.subscribe();
      
      outputChannel.appendLine(`Subscription request sent for channel: ${channel}`);
    }).catch(error => {
      outputChannel.appendLine(`Error subscribing to channel: ${error}`);
    });
  }

  centrifuge.connect();
  globalState.centrifuge = centrifuge;
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
      await connectToCentrifugo(
        globalState.authData.pushEndpoint,
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
          // Since we just set it to pushToken which is a string, we can safely assert it's a string
          await connectToCentrifugo(
            globalState.authData.pushEndpoint,
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
  outputChannel.appendLine('========= PROCESSING ARTIFACT UPDATED EVENT ==========');
  
  if (!data.file) {
    outputChannel.appendLine('ERROR: artifact-updated event missing file object');
    return;
  }
  
  const file = data.file;
  outputChannel.appendLine(`Processing artifact-updated for file: ${file.filePath}`);
  outputChannel.appendLine(`File details: ${JSON.stringify(file, null, 2)}`);
  
  // Check if the file has the expected structure
  if (!file.filePath) {
    outputChannel.appendLine('ERROR: File is missing filePath field');
    return;
  }
  
  try {
    // Get the workspace folder to find the file
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      outputChannel.appendLine('ERROR: No workspace folder open');
      return;
    }
    
    // Get the current workspace ID
    const currentWorkspaceId = store.get(workspaceIdAtom);
    outputChannel.appendLine(`Current workspace ID: ${currentWorkspaceId}`);
    
    if (!currentWorkspaceId) {
      outputChannel.appendLine('ERROR: No active workspace ID found');
      return;
    }
    
    // Get the chart path from workspace mapping
    const workspaceModule = await import('../workspace');
    const mapping = await workspaceModule.getWorkspaceMapping(currentWorkspaceId);
    
    if (!mapping || !mapping.localPath) {
      outputChannel.appendLine('ERROR: Could not find workspace mapping or localPath');
      return;
    }
    
    outputChannel.appendLine(`Found workspace mapping with localPath: ${mapping.localPath}`);
    
    // The localPath is the full path to the chart directory
    const chartBasePath = mapping.localPath;
    
    // Parse filePath to handle potential chart name duplication
    let filePath = file.filePath;
    
    // Remove leading chart name if present to avoid duplication
    // The pattern is likely "chartname/subpath" where chartname is the last directory in chartBasePath
    const chartName = chartBasePath.split('/').pop() || '';
    outputChannel.appendLine(`Chart name from path: ${chartName}`);
    
    // If filePath starts with chartName/, remove it
    if (filePath.startsWith(`${chartName}/`)) {
      outputChannel.appendLine(`File path starts with chart name, removing prefix: ${chartName}/`);
      filePath = filePath.substring(chartName.length + 1); // +1 for the slash
    }
    
    // Remove any leading slash if present
    if (filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }
    
    outputChannel.appendLine(`Adjusted file path: ${filePath}`);
    
    // Create a URI for the file by combining the chart base path with the relative file path
    const fileUri = vscode.Uri.file(`${chartBasePath}/${filePath}`);
    outputChannel.appendLine(`Opening file: ${fileUri.fsPath}`);
    
    // File system module for file operations
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Check if there's pending content and apply it directly
    if (file.contentPending) {
      outputChannel.appendLine('File has pending content, applying directly');
      
      try {
        // Ensure the directory exists
        await fs.promises.mkdir(path.dirname(fileUri.fsPath), { recursive: true });
        
        // Get the pending content
        const pendingContent = file.contentPending || '';
        outputChannel.appendLine(`Pending content length: ${pendingContent.length}`);
        outputChannel.appendLine('Pending content (first 100 chars): ' + pendingContent.substring(0, 100));
        
        // Write the pending content directly to the file
        await fs.promises.writeFile(fileUri.fsPath, pendingContent);
        outputChannel.appendLine(`Successfully wrote pending content to the file: ${fileUri.fsPath}`);
        
        // Open the file in the editor
        await vscode.window.showTextDocument(fileUri);
        outputChannel.appendLine('File opened with pending content');
        
        // Show a notification to the user
        vscode.window.showInformationMessage(`Updated ${path.basename(filePath)} with new content`);
      } catch (error) {
        outputChannel.appendLine(`Error applying pending content: ${error}`);
        
        // Try a fallback approach
        try {
          // Just open the file if it exists
          if (fs.existsSync(fileUri.fsPath)) {
            await vscode.window.showTextDocument(fileUri);
            outputChannel.appendLine('Fallback: opened existing file');
          } else {
            outputChannel.appendLine('File does not exist and failed to create it');
          }
        } catch (fallbackError) {
          outputChannel.appendLine(`Error in fallback approach: ${fallbackError}`);
        }
      }
    } else {
      // No pending content, just open the file normally
      try {
        // Try to open the file in the editor
        await vscode.window.showTextDocument(fileUri);
        outputChannel.appendLine('File opened successfully');
      } catch (openError) {
        outputChannel.appendLine(`Could not open file, attempting to create it: ${openError}`);
        
        try {
          // Create directory recursively
          await fs.promises.mkdir(path.dirname(fileUri.fsPath), { recursive: true });
          
          // Create an empty file
          await fs.promises.writeFile(fileUri.fsPath, '');
          outputChannel.appendLine(`Created empty file: ${fileUri.fsPath}`);
          
          // Now open the newly created file
          await vscode.window.showTextDocument(fileUri);
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