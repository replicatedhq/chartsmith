import { Centrifuge } from 'centrifuge';
import WebSocket = require('ws');
import { GlobalState, ConnectionStatus } from '../../types';
import * as vscode from 'vscode';

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

export async function connectWithCentrifugoJwt(): Promise<void> {
  if (!globalState.centrifugoJwt || !globalState.authData?.pushEndpoint) {
    console.log('Cannot connect to Centrifugo: Missing JWT or endpoint');
    return;
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
    outputChannel.show();
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
    outputChannel.show();
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
        outputChannel.show();
        
        if (onMessageCallback) {
          onMessageCallback(ctx.data);
        }
      });

      sub.on('error', (ctx) => {
        console.error('Subscription error:', ctx);
        outputChannel.appendLine(`Subscription error on channel ${channel}: ${JSON.stringify(ctx, null, 2)}`);
        outputChannel.show();
      });

      // Add subscription handler
      sub.on('subscribed', (ctx) => {
        outputChannel.appendLine(`Successfully subscribed to channel: ${channel}`);
        outputChannel.appendLine(`Subscription context: ${JSON.stringify(ctx, null, 2)}`);
        outputChannel.show();
      });

      sub.subscribe();
      
      outputChannel.appendLine(`Subscription request sent for channel: ${channel}`);
      outputChannel.show();
    }).catch(error => {
      outputChannel.appendLine(`Error subscribing to channel: ${error}`);
      outputChannel.show();
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