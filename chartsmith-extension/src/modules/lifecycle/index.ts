import * as vscode from 'vscode';
import { GlobalState, ConnectionStatus } from '../../types';
import { Plan } from '../../state/atoms';
import { initAuth, loadAuthData } from '../auth';
import { initWebSocket, connectToCentrifugo } from '../webSocket';
import { initWorkspace } from '../workspace';
import { initChat } from '../chat';
import { initRenders } from '../renders';
import { getHtmlForWebview } from '../ui';

let outputChannel: vscode.OutputChannel;
let context: vscode.ExtensionContext;
// Extend global type definition to include our pendingContentMap
declare global {
  var pendingContentMap: Map<string, string> | undefined;
  var chartsmithContentMap: Map<string, string> | undefined;
}

let globalState: GlobalState = {
  webviewGlobal: null,
  centrifuge: null,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  reconnectAttempt: 0,
  reconnectTimer: null,
  authData: null,
  isLoggedIn: false,
  authServer: null,
  centrifugoJwt: null
};

// Initialize global pending content map for sharing content between functions
if (!global.pendingContentMap) {
  global.pendingContentMap = new Map<string, string>();
}

// Make global state accessible to other modules
(global as any).chartsmithGlobalState = globalState;

const chartsmithContentMap = new Map<string, string>();

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
  console.log('CHARTSMITH EXTENSION ACTIVATING');

  context = extensionContext;

  // register the content provider
  const provider = new class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
      return chartsmithContentMap.get(uri.toString()) || '';
    }
  };

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('chartsmith-diff', provider)
  );

  // Initialize output channel
  outputChannel = vscode.window.createOutputChannel('ChartSmith');

  // Initialize modules
  initAuth(context, globalState);
  initWebSocket(globalState);
  initWorkspace(context);
  initChat(globalState);
  initRenders(globalState);

  // Initialize plans module
  const initPlansModule = async () => {
    const plans = await import('../plans');
    plans.initPlans(globalState);
  };
  initPlansModule();

  // Try to load auth data
  const authData = await loadAuthData();
  if (authData) {
    // Store auth data in global state
    globalState.authData = authData;
    console.log('Auth data loaded successfully');
  }

  // Load active workspace ID to ensure state is consistent
  try {
    const workspace = await import('../workspace');
    const activeWorkspaceId = await workspace.getActiveWorkspaceId();
    console.log(`Active workspace ID at startup: ${activeWorkspaceId}`);
  } catch (error) {
    console.error('Error loading active workspace ID:', error);
  }

  // Register commands and views
  registerCommands(context);
  registerViews(context);
}


/**
 * Sends a message to the API for the given workspace
 */
async function sendMessageToApi(workspaceId: string, messageText: string): Promise<void> {
  if (!globalState.authData) {
    vscode.window.showErrorMessage('Please log in to ChartSmith first.');
    return;
  }

  outputChannel.appendLine(`Sending message to workspace ${workspaceId}: ${messageText}`);

  try {
    // Import API module
    const api = await import('../api');

    // Make the POST request to the message endpoint
    const response = await api.fetchApi(
      globalState.authData,
      `/workspace/${workspaceId}/message`,
      'POST',
      { prompt: messageText }
    );

    outputChannel.appendLine(`Message sent successfully. Response: ${JSON.stringify(response, null, 2)}`);

    // Fetch updated messages after sending
    vscode.commands.executeCommand('chartsmith.fetchMessages', workspaceId);
  } catch (error) {
    outputChannel.appendLine(`Error sending message: ${error}`);
    vscode.window.showErrorMessage(`Failed to send message: ${error}`);
  }
}

/**
 * Proceeds with a plan by sending a POST request to the revision endpoint
 */
async function proceedWithPlan(workspaceId: string, planId: string): Promise<void> {
  if (!globalState.authData) {
    vscode.window.showErrorMessage('Please log in to ChartSmith first.');
    return;
  }

  outputChannel.appendLine(`Proceeding with plan ${planId} for workspace ${workspaceId}`);

  try {
    // Import API module
    const api = await import('../api');

    // Make the POST request to the revision endpoint
    const response = await api.fetchApi(
      globalState.authData,
      `/workspace/${workspaceId}/revision`,
      'POST',
      { planId: planId }
    );

    outputChannel.appendLine(`Plan proceed request successful. Response: ${JSON.stringify(response, null, 2)}`);

    // Update the workspace with the response
    if (response) {
      // Import workspace module
      const workspace = await import('../workspace');

      // Update the workspace state if needed
      if (workspace.updateWorkspaceData && typeof workspace.updateWorkspaceData === 'function') {
        workspace.updateWorkspaceData(response);

        // Notify webview that workspace was updated
        if (globalState.webviewGlobal) {
          globalState.webviewGlobal.postMessage({
            command: 'workspaceUpdated',
            workspace: response
          });
        }
      }

      // Refresh messages, renders, and plans to reflect changes
      vscode.commands.executeCommand('chartsmith.fetchMessages', workspaceId);
      vscode.commands.executeCommand('chartsmith.fetchRenders', workspaceId);
      vscode.commands.executeCommand('chartsmith.fetchPlans', workspaceId);
    }
  } catch (error) {
    outputChannel.appendLine(`Error proceeding with plan: ${error}`);
    vscode.window.showErrorMessage(`Failed to proceed with plan: ${error}`);

    // Notify webview of error so it can reset button state
    if (globalState.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'planProceedError',
        planId: planId,
        error: `${error}`
      });
    }
  }
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

        // Log details if available
        if (uploadResponse.id) {
          console.log(`Chart ID: ${uploadResponse.id}`);
        }

        if (uploadResponse.workspaceId) {
          console.log(`Workspace ID: ${uploadResponse.workspaceId}`);

          // Store the workspace mapping with the chart path
          try {
            const workspace = await import('../workspace');
            await workspace.saveWorkspaceMapping({
              workspaceId: uploadResponse.workspaceId,
              localPath: chartDir,
              lastUpdated: new Date().toISOString()
            });
            console.log(`Saved workspace mapping: ${uploadResponse.workspaceId} -> ${chartDir}`);
          } catch (error) {
            console.error('Error saving workspace mapping:', error);
          }
        }

        // After uploading, fetch renders for this workspace
        if (uploadResponse.workspaceId && globalState.authData) {
          console.log(`Workspace ID: ${uploadResponse.workspaceId}`);

          // Directly fetch renders for this workspace
          try {
            // Use the command to ensure consistent handling
            vscode.commands.executeCommand('chartsmith.fetchRenders', uploadResponse.workspaceId);
          } catch (error) {
            console.error('Error executing fetchRenders command:', error);
          }

          // Also fetch plans for this workspace
          try {
            // Use the command to ensure consistent handling
            vscode.commands.executeCommand('chartsmith.fetchPlans', uploadResponse.workspaceId);
          } catch (error) {
            console.error('Error executing fetchPlans command:', error);
          }

          // Get the chart path for this workspace
          let chartPath = '';
          try {
            const workspace = await import('../workspace');
            const mapping = await workspace.getWorkspaceMapping(uploadResponse.workspaceId);
            if (mapping) {
              // Get the current VS Code workspace folders
              const workspaceFolders = vscode.workspace.workspaceFolders;

              if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;

                // Make path relative to workspace if possible
                if (mapping.localPath.startsWith(workspaceRoot)) {
                  chartPath = mapping.localPath.substring(workspaceRoot.length);
                  // Ensure path starts with /
                  if (!chartPath.startsWith('/')) {
                    chartPath = '/' + chartPath;
                  }
                } else {
                  // Fall back to absolute path if not in workspace
                  chartPath = mapping.localPath;
                }
              } else {
                // No workspace folder, use absolute path
                chartPath = mapping.localPath;
              }
            }
          } catch (error) {
            console.error('Error getting workspace mapping:', error);
          }

          // Notify the webview of the workspace change
          if (globalState.webviewGlobal) {
            globalState.webviewGlobal.postMessage({
              command: 'workspaceChanged',
              workspaceId: uploadResponse.workspaceId,
              chartPath: chartPath
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

        // Call /push API
        try {
          const api = await import('../api');
          outputChannel.appendLine(`Calling /push API endpoint`);
          const pushResponse = await api.fetchApi(
            globalState.authData,
            '/push',
            'GET'
          );
          outputChannel.appendLine('Push API Response: ' + JSON.stringify(pushResponse, null, 2));

          // Store the push token in memory
          if (pushResponse && pushResponse.pushToken) {
            globalState.centrifugoJwt = pushResponse.pushToken;
            outputChannel.appendLine('Stored Centrifugo JWT: ' + globalState.centrifugoJwt);

            // Try to connect to Centrifugo with the JWT
            try {
              const webSocket = await import('../webSocket');
              outputChannel.appendLine('Attempting to connect to Centrifugo with JWT');
              await webSocket.connectWithCentrifugoJwt();
              outputChannel.appendLine('Connection attempt completed');
            } catch (error) {
              outputChannel.appendLine('Error connecting to Centrifugo: ' + error);
            }
          } else {
            outputChannel.appendLine('No push token found in response');
          }

        } catch (error) {
          outputChannel.appendLine('Error fetching push data: ' + error);
        }

        // Also fetch renders and plans for this workspace
        try {
          // We'll fetch renders automatically when fetching messages to ensure both are loaded
          vscode.commands.executeCommand('chartsmith.fetchRenders', workspaceId);
        } catch (error) {
          console.error('Error executing fetchRenders command:', error);
        }

        // Fetch plans for this workspace
        try {
          // We'll fetch plans automatically when fetching messages to ensure everything is loaded
          vscode.commands.executeCommand('chartsmith.fetchPlans', workspaceId);
        } catch (error) {
          console.error('Error executing fetchPlans command:', error);
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

        // Call /push API
        try {
          const api = await import('../api');
          outputChannel.appendLine(`Calling /push API endpoint`);
          const pushResponse = await api.fetchApi(
            globalState.authData,
            '/push',
            'GET'
          );
          outputChannel.appendLine('Push API Response: ' + JSON.stringify(pushResponse, null, 2));

          // Store the push token in memory
          if (pushResponse && pushResponse.pushToken) {
            globalState.centrifugoJwt = pushResponse.pushToken;
            outputChannel.appendLine('Stored Centrifugo JWT: ' + globalState.centrifugoJwt);

            // Try to connect to Centrifugo with the JWT
            try {
              const webSocket = await import('../webSocket');
              outputChannel.appendLine('Attempting to connect to Centrifugo with JWT');
              await webSocket.connectWithCentrifugoJwt();
              outputChannel.appendLine('Connection attempt completed');
            } catch (error) {
              outputChannel.appendLine('Error connecting to Centrifugo: ' + error);
            }
          } else {
            outputChannel.appendLine('No push token found in response');
          }

        } catch (error) {
          outputChannel.appendLine('Error fetching push data: ' + error);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch renders: ${error}`);
      }
    })
  );

  // Register fetch plans command
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.fetchPlans', async (workspaceId: string) => {
      if (!globalState.authData) {
        vscode.window.showErrorMessage('Please log in to ChartSmith first.');
        return;
      }

      try {
        // Import plans module dynamically
        const plans = await import('../plans');
        console.log(`Fetching plans for workspace: ${workspaceId}`);
        const workspacePlans: Plan[] = await plans.fetchWorkspacePlans(
          globalState.authData,
          workspaceId
        );

        console.log(`Got ${workspacePlans ? workspacePlans.length : 0} plans from fetchWorkspacePlans`);
        console.log('Plans from API:', workspacePlans);

        if (globalState.webviewGlobal) {
          console.log('Sending plans to webview');
          // Send API response to webview console for debugging
          globalState.webviewGlobal.postMessage({
            command: 'debug',
            message: `API Plans Response: ${JSON.stringify(workspacePlans)}`
          });
          globalState.webviewGlobal.postMessage({
            command: 'plans',
            plans: workspacePlans,
            workspaceId: workspaceId
          });

          // Force re-render of messages to make sure plans are displayed
          setTimeout(() => {
            if (globalState.webviewGlobal) {
              console.log('Triggering message re-render after plans loaded');
              globalState.webviewGlobal.postMessage({
                command: 'renderMessages'
              });
            }
          }, 200);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch plans: ${error}`);
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

    // Get the workspace mapping to find the chart path
    let chartPath = '';
    if (activeWorkspaceId) {
      const mapping = await workspaceModule.getWorkspaceMapping(activeWorkspaceId);
      if (mapping) {
        // Get the current VS Code workspace folders
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
          const workspaceRoot = workspaceFolders[0].uri.fsPath;

          // Make path relative to workspace if possible
          if (mapping.localPath.startsWith(workspaceRoot)) {
            chartPath = mapping.localPath.substring(workspaceRoot.length);
            // Ensure path starts with /
            if (!chartPath.startsWith('/')) {
              chartPath = '/' + chartPath;
            }
          } else {
            // Fall back to absolute path if not in workspace
            chartPath = mapping.localPath;
          }
        } else {
          // No workspace folder, use absolute path
          chartPath = mapping.localPath;
        }
      }
    }

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
        workspaceId: activeWorkspaceId || '',
        chartPath: chartPath
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
    case 'openExternal':
      // Open URL in external browser
      if (message.url) {
        vscode.env.openExternal(vscode.Uri.parse(message.url));
      }
      break;
    case 'renderDebugDiff':
      if (message.workspaceId) {
        await renderDebugDiff(message.workspaceId);
      }
      break;
    case 'fetchMessages':
      if (message.workspaceId) {
        vscode.commands.executeCommand('chartsmith.fetchMessages', message.workspaceId);
      }
      break;
    case 'fetchPlans':
      if (message.workspaceId) {
        vscode.commands.executeCommand('chartsmith.fetchPlans', message.workspaceId);
      }
      break;
    case 'sendMessage':
      if (message.workspaceId && message.message) {
        sendMessageToApi(message.workspaceId, message.message);
      }
      break;
    case 'proceedWithPlan':
      if (message.workspaceId && message.planId) {
        proceedWithPlan(message.workspaceId, message.planId);
      }
      break;
    case 'viewFileDiff':
      if (message.filePath && message.workspaceId) {
        handleFileDiff(message.filePath, message.workspaceId, message.pendingContent);
      }
      break;
    case 'acceptFileChanges':
      if (message.filePath && message.workspaceId) {
        acceptFileChanges(message.filePath, message.workspaceId, message.pendingContent);
      }
      break;
    case 'rejectFileChanges':
      if (message.filePath && message.workspaceId) {
        rejectFileChanges(message.filePath, message.workspaceId, message.pendingContent);
      }
      break;
    // Add more message handlers as needed
  }
}

/**
 * Renders a debug diff for testing purposes
 */
async function renderDebugDiff(workspaceId: string): Promise<void> {
  try {
    // Get the chart path from workspace mapping
    const workspaceModule = await import('../workspace');
    const mapping = await workspaceModule.getWorkspaceMapping(workspaceId);

    if (!mapping || !mapping.localPath) {
      vscode.window.showErrorMessage('Could not find chart path for workspace');
      return;
    }

    // The localPath is the full path to the chart directory
    const chartBasePath = mapping.localPath;

    // Path to deployment.yaml
    const targetFilePath = `${chartBasePath}/templates/deployment.yaml`;

    // Import modules
    const fs = require('fs');
    const path = require('path');
    const renderModule = await import('../render');

    // Read the file content
    const currentContent = await fs.promises.readFile(targetFilePath, 'utf8');

    // Make a change to the content
    const modifiedContent = currentContent + "\n# MODIFIED LINE\n";

    // Call the showFileDiff function to display the diff
    await renderModule.showFileDiff(
      targetFilePath,
      modifiedContent,
      `Debug Diff: ${path.basename(targetFilePath)}`
    );

  } catch (error) {
    vscode.window.showErrorMessage(`Error rendering debug diff: ${error}`);
  }
}

/**
 * Handle file diff request from the webview
 * Gets the file path and displays a diff
 */
async function handleFileDiff(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {
  try {
    console.log(`Viewing diff for file: ${filePath} in workspace: ${workspaceId}`);
    console.log(`Initial pending content provided: ${pendingContent ? 'Yes' : 'No'}`);
    
    // First check if we already have the content stored in our map
    if (!pendingContent && global.pendingContentMap?.has(filePath)) {
      pendingContent = global.pendingContentMap.get(filePath);
      console.log(`Retrieved pending content from global map for ${filePath}`);
    }
    
    // Check if the content is available in the global chartsmith content map
    if (!pendingContent && global.chartsmithContentMap?.has(filePath)) {
      pendingContent = global.chartsmithContentMap.get(filePath);
      console.log(`Retrieved pending content from chartsmithContentMap for ${filePath}`);
    }
    
    // As a fallback, create demo content
    if (!pendingContent) {
      // For demonstration/development purposes, create content that will visibly change the file
      const demoPendingContent = `# This is a demonstration change added by ChartSmith
# File: ${filePath}
# Timestamp: ${new Date().toISOString()}

# The content below shows what would be in the actual file
# In a real implementation, we would fetch the real pending content from the API

version: 0.1.0
name: chartsmith
apiVersion: v2
description: A Helm chart with pending changes from ChartSmith
type: application
`;
      pendingContent = demoPendingContent;
      console.log('Using demo content as fallback');
    }
    
    // Get the chart path from workspace mapping
    const workspaceModule = await import('../workspace');
    const mapping = await workspaceModule.getWorkspaceMapping(workspaceId);

    if (!mapping || !mapping.localPath) {
      vscode.window.showErrorMessage('Could not find chart path for workspace');
      return;
    }

    // The localPath is the full path to the chart directory
    const chartBasePath = mapping.localPath;

    // Import modules first so we can use path
    const fs = require('fs');
    const path = require('path');

    // Clean up the file path to prevent duplication
    // Remove any leading slashes
    const cleanFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    // Get chart name from base path to check for duplication
    const chartName = path.basename(chartBasePath);

    // Check if the file path starts with the chart name to avoid duplication
    const finalFilePath = cleanFilePath.startsWith(chartName + '/') ?
      cleanFilePath.substring(chartName.length + 1) : cleanFilePath;

    // Construct the full file path
    const fullFilePath = path.join(chartBasePath, finalFilePath);

    // Log detailed path information for debugging
    console.log(`Chart base path: ${chartBasePath}`);
    console.log(`Original file path: ${filePath}`);
    console.log(`Cleaned file path: ${cleanFilePath}`);
    console.log(`Chart name: ${chartName}`);
    console.log(`Final path component: ${finalFilePath}`);
    console.log(`Full file path: ${fullFilePath}`);
    console.log(`Pending content provided: ${pendingContent ? 'Yes' : 'No'}`);

    try {
      // Check if the file exists
      const fileExists = fs.existsSync(fullFilePath);

      // Read current content or use empty string if file doesn't exist
      const currentContent = fileExists ?
        await fs.promises.readFile(fullFilePath, 'utf8') : '';

      // Store the pending content in global variable so we can access it when accepting/rejecting
      // We'll use this as a workaround for not having the content in the file objects
      global.pendingContentMap?.set(filePath, pendingContent);
      console.log(`Stored pending content in global map for ${filePath}`);
      
      // Import the render module
      const renderModule = await import('../render');

      // Show the diff
      const result = await renderModule.showFileDiff(
        fullFilePath,
        pendingContent,
        `File Diff: ${path.basename(fullFilePath)}`
      );

      console.log(`Diff shown with result: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error(`Error reading file: ${error}`);
      vscode.window.showErrorMessage(`Error reading file: ${error}`);
    }
  } catch (error) {
    console.error(`Error handling file diff: ${error}`);
    vscode.window.showErrorMessage(`Error handling file diff: ${error}`);
  }
}

/**
 * Accept file changes - apply pending content to the file
 */
async function acceptFileChanges(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {
  try {
    console.log(`Accepting changes for file: ${filePath} in workspace: ${workspaceId}`);
    console.log(`Pending content provided: ${pendingContent ? 'Yes' : 'No'}`);
    
    // First check if we have stored content in the global map
    if (!pendingContent && global.pendingContentMap?.has(filePath)) {
      pendingContent = global.pendingContentMap.get(filePath);
      console.log(`Retrieved pending content from global map for ${filePath}`);
    }
    
    // If we still don't have content, create demo content
    if (!pendingContent) {
      // For demonstration/development purposes, create content that will visibly change the file
      const demoPendingContent = `# This is a demonstration change added by ChartSmith
# File: ${filePath}
# Timestamp: ${new Date().toISOString()}

# The content below shows what would be in the actual file
# In a real implementation, we would fetch the real pending content from the API

version: 0.1.0
name: chartsmith
apiVersion: v2
description: A Helm chart with pending changes from ChartSmith
type: application
`;
      pendingContent = demoPendingContent;
      console.log('Using demo content for development purposes');
    }

    // Get the chart path from workspace mapping
    const workspaceModule = await import('../workspace');
    const mapping = await workspaceModule.getWorkspaceMapping(workspaceId);

    if (!mapping || !mapping.localPath) {
      vscode.window.showErrorMessage('Could not find chart path for workspace');
      return;
    }

    // The localPath is the full path to the chart directory
    const chartBasePath = mapping.localPath;

    // Import modules first so we can use path
    const fs = require('fs');
    const path = require('path');

    // Clean up the file path to prevent duplication
    // Remove any leading slashes
    const cleanFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    // Get chart name from base path to check for duplication
    const chartName = path.basename(chartBasePath);

    // Check if the file path starts with the chart name to avoid duplication
    const finalFilePath = cleanFilePath.startsWith(chartName + '/') ?
      cleanFilePath.substring(chartName.length + 1) : cleanFilePath;

    // Construct the full file path
    const fullFilePath = path.join(chartBasePath, finalFilePath);

    // Log detailed path information for debugging
    console.log(`Chart base path: ${chartBasePath}`);
    console.log(`Original file path: ${filePath}`);
    console.log(`Cleaned file path: ${cleanFilePath}`);
    console.log(`Chart name: ${chartName}`);
    console.log(`Final path component: ${finalFilePath}`);
    console.log(`Full file path for accepting changes: ${fullFilePath}`);

    try {
      // First, check if the directory exists and create it if needed
      await fs.promises.mkdir(path.dirname(fullFilePath), { recursive: true });

      // Log all maps and keys for debugging
      console.log(`pendingContentMap keys: ${Array.from(global.pendingContentMap?.keys() || []).join(', ')}`);
      console.log(`chartsmithContentMap keys: ${Array.from(global.chartsmithContentMap?.keys() || []).join(', ')}`);
      
      // Double-check we have content at this point
      if (!pendingContent) {
        console.error('No pending content provided for file:', filePath);
        vscode.window.showErrorMessage(`Cannot accept changes: No pending content available for ${path.basename(filePath)}`);
        return;
      }

      // Write the pending content directly to the file
      await fs.promises.writeFile(fullFilePath, pendingContent);

      console.log(`Successfully applied changes to: ${fullFilePath}`);
      
      // Clean up the entries from our maps since we've applied the content
      global.pendingContentMap?.delete(filePath);
      global.chartsmithContentMap?.delete(filePath);
      console.log(`Removed pending content from maps for ${filePath} after applying`);

      // Show success message
      // vscode.window.showInformationMessage(`Applied changes to ${path.basename(filePath)}`);

      // Notify the webview that changes were applied
      if (globalState.webviewGlobal) {
        globalState.webviewGlobal.postMessage({
          command: 'fileChangeApplied',
          filePath: filePath,
          status: 'accepted'
        });
      }
    } catch (error) {
      console.error(`Error writing to file: ${error}`);
      vscode.window.showErrorMessage(`Error writing file: ${error}`);
    }
  } catch (error) {
    console.error(`Error accepting file changes: ${error}`);
    vscode.window.showErrorMessage(`Error accepting file changes: ${error}`);
  }
}

/**
 * Reject file changes - discard pending content
 */
async function rejectFileChanges(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {
  try {
    console.log(`Rejecting changes for file: ${filePath} in workspace: ${workspaceId}`);
    console.log(`Pending content provided: ${pendingContent ? 'Yes' : 'No'}`);
    
    // First check if we have stored content in the global map
    if (!pendingContent && global.pendingContentMap?.has(filePath)) {
      pendingContent = global.pendingContentMap.get(filePath);
      console.log(`Retrieved pending content from global map for ${filePath} for rejection`);
    }

    // Get the chart path from workspace mapping
    const workspaceModule = await import('../workspace');
    const mapping = await workspaceModule.getWorkspaceMapping(workspaceId);

    if (!mapping || !mapping.localPath) {
      vscode.window.showErrorMessage('Could not find chart path for workspace');
      return;
    }

    // The localPath is the full path to the chart directory
    const chartBasePath = mapping.localPath;

    // Import modules first so we can use path
    const path = require('path');

    // Clean up the file path to prevent duplication
    // Remove any leading slashes
    const cleanFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    // Get chart name from base path to check for duplication
    const chartName = path.basename(chartBasePath);

    // Check if the file path starts with the chart name to avoid duplication
    const finalFilePath = cleanFilePath.startsWith(chartName + '/') ?
      cleanFilePath.substring(chartName.length + 1) : cleanFilePath;

    // Construct the full file path
    const fullFilePath = path.join(chartBasePath, finalFilePath);

    // Log detailed path information for debugging
    console.log(`Chart base path: ${chartBasePath}`);
    console.log(`Original file path: ${filePath}`);
    console.log(`Cleaned file path: ${cleanFilePath}`);
    console.log(`Chart name: ${chartName}`);
    console.log(`Final path component: ${finalFilePath}`);
    console.log(`Full file path for rejecting changes: ${fullFilePath}`);

    // In a real implementation, you would:
    // 1. Update the file status in your API to rejected
    // 2. Clear any pending content from your state

    // Log all maps and keys for debugging
    console.log(`pendingContentMap keys: ${Array.from(global.pendingContentMap?.keys() || []).join(', ')}`);
    console.log(`chartsmithContentMap keys: ${Array.from(global.chartsmithContentMap?.keys() || []).join(', ')}`);
    
    // If pending content was provided, log that we're rejecting it
    if (pendingContent) {
      console.log(`Rejecting pending content for ${filePath}`);
    }
    
    // Clean up the entries from our maps
    global.pendingContentMap?.delete(filePath);
    global.chartsmithContentMap?.delete(filePath);
    console.log(`Removed pending content from maps for ${filePath}`);

    // Show success message
    // vscode.window.showInformationMessage(`Changes rejected for ${path.basename(filePath)}`);

    // Notify the webview that changes were rejected
    if (globalState.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'fileChangeApplied',
        filePath: filePath,
        status: 'rejected'
      });
    }
  } catch (error) {
    console.error(`Error rejecting file changes: ${error}`);
    vscode.window.showErrorMessage(`Error rejecting file changes: ${error}`);
  }
}
