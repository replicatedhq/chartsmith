import * as vscode from 'vscode';
import { GlobalState, ConnectionStatus } from '../../types';
import { initAuth, loadAuthData } from '../auth';
import { initWebSocket, connectToCentrifugo } from '../webSocket';
import { initWorkspace } from '../workspace';
import { initChat } from '../chat';
import { initRenders } from '../renders';
import { getHtmlForWebview } from '../ui';

let outputChannel: vscode.OutputChannel;
let context: vscode.ExtensionContext;
let globalState: GlobalState = {
  webviewGlobal: null,
  centrifuge: null,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  reconnectAttempt: 0,
  reconnectTimer: null,
  authData: null,
  isLoggedIn: false,
  authServer: null,
  pushToken: null
};

// Make global state accessible to other modules
(global as any).chartsmithGlobalState = globalState;

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
  context = extensionContext;

  // Initialize output channel
  outputChannel = vscode.window.createOutputChannel('ChartSmith');

  // Initialize modules
  initAuth(context, globalState);
  initWebSocket(globalState);
  initWorkspace(context);
  initChat(globalState);
  initRenders(globalState);

  // Try to load auth data
  const authData = await loadAuthData();

  // Register commands and views
  registerCommands(context);
  registerViews(context);

  // We'll only connect to WebSocket when a workspace is opened, not on initial login
  // Connecting will happen in the uploadChart command
}

export function deactivate(): void {
  // Cleanup on extension deactivation
  if (globalState.centrifuge) {
    globalState.centrifuge.disconnect();
  }

  if (globalState.authServer) {
    globalState.authServer.close();
  }

  if (globalState.reconnectTimer) {
    clearTimeout(globalState.reconnectTimer);
  }
}

function registerCommands(context: vscode.ExtensionContext): void {
  // Register upload chart command
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.uploadChart', async () => {
      if (!globalState.authData) {
        vscode.window.showErrorMessage('Please log in to ChartSmith first.');
        return;
      }
      
      // Get all folders in the workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Please open a folder containing Helm charts.');
        return;
      }
      
      try {
        // Import chart module dynamically
        const chartModule = await import('../chart');
        
        // Find Helm chart directories
        const chartDirectories = await chartModule.findHelmChartDirectories(workspaceFolders[0].uri.fsPath);
        
        if (chartDirectories.length === 0) {
          vscode.window.showErrorMessage('No Helm charts found in the workspace. Charts must contain a Chart.yaml file.');
          return;
        }
        
        // Create quick pick items
        const quickPickItems = chartDirectories.map(dir => {
          const relativePath = dir.startsWith(workspaceFolders[0].uri.fsPath) 
            ? dir.replace(workspaceFolders[0].uri.fsPath, workspaceFolders[0].name)
            : dir;
            
          return {
            label: relativePath,
            detail: dir
          };
        });
        
        // Show quick pick to select a chart directory
        const selection = await vscode.window.showQuickPick(quickPickItems, {
          placeHolder: 'Select a Helm chart to upload to ChartSmith',
          ignoreFocusOut: true
        });
        
        if (!selection) {
          return; // User cancelled
        }
        
        const chartDir = selection.detail;
        
        // Create temporary tarball
        const chartTarball = await chartModule.createChartTarball(chartDir);
        
        // Upload the chart - the server will respond with the workspace ID
        const uploadResponse = await chartModule.uploadChartToServer(globalState.authData, chartTarball);
        
        // Show success message
        vscode.window.showInformationMessage('Chart uploaded successfully!');
        
        // Log details if available
        if (uploadResponse.id) {
          console.log(`Chart ID: ${uploadResponse.id}`);
        }
        
        if (uploadResponse.workspaceId) {
          console.log(`Workspace ID: ${uploadResponse.workspaceId}`);
        }
        
        // After uploading, connect to WebSocket and show messages if we have a workspace ID
        if (uploadResponse.workspaceId && globalState.authData && globalState.authData.pushEndpoint) {
          const webSocket = await import('../webSocket');
          webSocket.connectToCentrifugo(
            globalState.authData.pushEndpoint,
            globalState.authData.token
          );
          
          // Directly fetch renders for this workspace
          try {
            // Use the command to ensure consistent handling
            vscode.commands.executeCommand('chartsmith.fetchRenders', uploadResponse.workspaceId);
          } catch (error) {
            console.error('Error executing fetchRenders command:', error);
          }
          
          // Notify the webview of the workspace change
          if (globalState.webviewGlobal) {
            globalState.webviewGlobal.postMessage({
              command: 'workspaceChanged',
              workspaceId: uploadResponse.workspaceId
            });
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to upload chart: ${error}`);
      }
    })
  );
  
  // Register fetch messages command
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.fetchMessages', async (workspaceId: string) => {
      if (!globalState.authData) {
        vscode.window.showErrorMessage('Please log in to ChartSmith first.');
        return;
      }

      try {
        // Import chat module dynamically
        const chat = await import('../chat');
        console.log(`Fetching messages for workspace: ${workspaceId}`);
        const messages = await chat.fetchWorkspaceMessages(
          globalState.authData,
          workspaceId
        );

        console.log(`Got ${messages ? messages.length : 0} messages from fetchWorkspaceMessages`);
        console.log('Messages from API:', messages);

        if (globalState.webviewGlobal) {
          console.log('Sending messages to webview');
          // Send API response to webview console for debugging
          globalState.webviewGlobal.postMessage({
            command: 'debug',
            message: `API Response Data: ${JSON.stringify(messages)}`
          });
          globalState.webviewGlobal.postMessage({
            command: 'messages',
            messages: messages,
            workspaceId: workspaceId
          });
        }
        
        // Also fetch renders for this workspace
        try {
          // We'll fetch renders automatically when fetching messages to ensure both are loaded
          vscode.commands.executeCommand('chartsmith.fetchRenders', workspaceId);
        } catch (error) {
          console.error('Error executing fetchRenders command:', error);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch messages: ${error}`);
      }
    })
  );
  
  // Register fetch renders command
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.fetchRenders', async (workspaceId: string) => {
      if (!globalState.authData) {
        vscode.window.showErrorMessage('Please log in to ChartSmith first.');
        return;
      }

      try {
        // Import renders module dynamically
        const renders = await import('../renders');
        console.log(`Fetching renders for workspace: ${workspaceId}`);
        const workspaceRenders = await renders.fetchWorkspaceRenders(
          globalState.authData,
          workspaceId
        );

        console.log(`Got ${workspaceRenders ? workspaceRenders.length : 0} renders from fetchWorkspaceRenders`);
        console.log('Renders from API:', workspaceRenders);

        if (globalState.webviewGlobal) {
          console.log('Sending renders to webview');
          // Send API response to webview console for debugging
          globalState.webviewGlobal.postMessage({
            command: 'debug',
            message: `API Renders Response: ${JSON.stringify(workspaceRenders)}`
          });
          globalState.webviewGlobal.postMessage({
            command: 'renders',
            renders: workspaceRenders,
            workspaceId: workspaceId
          });
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch renders: ${error}`);
      }
    })
  );

  // Register login command
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.login', async () => {
      // Start auth server on a random port
      const port = 3000 + Math.floor(Math.random() * 1000);

      try {
        // Import the auth module dynamically to avoid circular dependencies
        const auth = await import('../auth');
        
        // Start the auth server first
        auth.startAuthServer(port).then(token => {
          if (token) {
            vscode.window.showInformationMessage('Successfully logged in to ChartSmith.');
            // We don't connect to WebSocket here - only when a workspace is opened
          }
        });
        
        // Open the authentication URL in the browser
        const authUrl = `https://chartsmith.ai/auth/extension?next=http://localhost:${port}`;
        vscode.window.showInformationMessage('Please complete login in the browser window.');
        vscode.env.openExternal(vscode.Uri.parse(authUrl));
        
        // Return early since we're handling everything in the promise
        return;
      } catch (error) {
        vscode.window.showErrorMessage(`Login failed: ${error}`);
      }
    })
  );


  // Register logout command
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.logout', async () => {
      try {
        // Clear active workspace ID to disconnect WebSocket
        const workspace = await import('../workspace');
        await workspace.setActiveWorkspaceId(null);
        
        // Clear auth data
        const auth = await import('../auth');
        await auth.clearAuthData();
        
        vscode.window.showInformationMessage('Logged out from ChartSmith.');
      } catch (error) {
        vscode.window.showErrorMessage(`Logout failed: ${error}`);
      }
    })
  );
}

function registerViews(context: vscode.ExtensionContext): void {
  const provider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('chartsmith.view', provider)
  );
}

class SidebarProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    globalState.webviewGlobal = webviewView.webview;

    // Get the active workspace ID
    const workspaceModule = await import('../workspace');
    const activeWorkspaceId = await workspaceModule.getActiveWorkspaceId();

    webviewView.webview.html = getHtmlForWebview(
      webviewView.webview,
      this._extensionUri,
      {
        apiEndpoint: globalState.authData?.apiEndpoint,
        pushEndpoint: globalState.authData?.pushEndpoint,
        wwwEndpoint: globalState.authData?.wwwEndpoint,
        userId: globalState.authData?.userId,
        token: globalState.authData?.token,
        connectionStatus: globalState.connectionStatus,
        workspaceId: activeWorkspaceId || ''
      }
    );

    webviewView.webview.onDidReceiveMessage(
      handleWebviewMessage
    );
  }
}

async function handleWebviewMessage(message: any) {
  console.log('Received message from webview:', message);

  switch (message.command) {
    case 'login':
      vscode.commands.executeCommand('chartsmith.login');
      break;
    case 'logout':
      vscode.commands.executeCommand('chartsmith.logout');
      break;
    case 'createChart':
      vscode.window.showInformationMessage('Create new Helm chart feature coming soon!');
      break;
    case 'uploadChart':
      vscode.commands.executeCommand('chartsmith.uploadChart');
      break;
    case 'downloadChart':
      vscode.window.showInformationMessage('Import chart from ChartSmith feature coming soon!');
      break;
    case 'goHome':
      // Clear the active workspace and disconnect from WebSocket
      const workspace = await import('../workspace');
      await workspace.setActiveWorkspaceId(null);
      break;
    case 'fetchMessages':
      if (message.workspaceId) {
        vscode.commands.executeCommand('chartsmith.fetchMessages', message.workspaceId);
      }
      break;
    // Add more message handlers as needed
  }
}