import * as vscode from 'vscode';
import * as path from 'path';
import { GlobalState, ConnectionStatus } from '../../types';
import { Plan } from '../../state/atoms';
import { initAuth, loadAuthData } from '../auth';
import { initWebSocket, connectToCentrifugo } from '../webSocket';
import { initWorkspace } from '../workspace';
import { initChat } from '../chat';
import { initRenders } from '../renders';
import { getHtmlForWebview } from '../ui';
import * as config from "../config";
import { isDevelopmentMode } from "../config";

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

  // Register reset endpoints command directly in activate
  vscode.commands.registerCommand("chartsmith.resetEndpoints", async () => {
    try {
      await config.resetEndpointsToConfig(context.secrets);
      vscode.window.showInformationMessage("Endpoints have been reset to match configuration values");
    } catch (error) {
      console.error("[ERROR][LIFECYCLE] Error resetting endpoints:", error);
      vscode.window.showErrorMessage(`Failed to reset endpoints: ${error}`);
    }
  });
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
  console.log(`==== PROCEED WITH PLAN FUNCTION CALLED ====`);
  console.log(`Proceeding with plan ${planId} for workspace ${workspaceId}`);
  
  if (!globalState.authData) {
    console.error('Authentication data not available');
    vscode.window.showErrorMessage('Please log in to ChartSmith first.');
    return;
  }

  outputChannel.appendLine(`Proceeding with plan ${planId} for workspace ${workspaceId}`);

  try {
    // Update plan status in the local store immediately
    import('../../state/store').then(async ({ actions, store }) => {
      console.log(`Setting plan ${planId} status to 'applying' locally`);
      actions.updatePlanStatus(planId, 'applying');
      
      // Read the current plan state for debugging
      const plansAtom = (await import('../../state/atoms')).plansAtom;
      const currentPlans = store.get(plansAtom);
      const plan = currentPlans.find(p => p.id === planId);
      
      console.log(`Current plan state in store:`, plan);
    }).catch(error => {
      console.error('Error updating local plan status:', error);
    });

    // Import API module
    const api = await import('../api');

    console.log(`Making API request to proceed with plan ${planId}`);
    // Make the POST request to the revision endpoint
    const response = await api.fetchApi(
      globalState.authData,
      `/workspace/${workspaceId}/revision`,
      'POST',
      { planId: planId }
    );

    console.log(`Plan proceed API response:`, response);
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
          console.log(`Sending workspace update to webview`);
          globalState.webviewGlobal.postMessage({
            command: 'workspaceUpdated',
            workspace: response
          });
          
          // Explicitly update the plan status
          console.log(`Explicitly updating plan status in webview to 'applied'`);
          globalState.webviewGlobal.postMessage({
            command: 'updatePlanStatus',
            planId: planId,
            status: 'applied'
          });
        }
      }

      // Refresh messages, renders, and plans to reflect changes
      console.log(`Triggering refresh of messages, renders, and plans`);
      vscode.commands.executeCommand('chartsmith.fetchMessages', workspaceId);
      vscode.commands.executeCommand('chartsmith.fetchRenders', workspaceId);
      
      // First, import the store to update the local plan status
      import('../../state/store').then(async ({ actions, store }) => {
        // Update the plan status locally so it's not overridden by API response
        console.log(`Setting plan ${planId} status to 'applied' in store`);
        actions.updatePlanStatus(planId, 'applied');
        
        // Also update file statuses if possible
        const plansAtom = (await import('../../state/atoms')).plansAtom;
        const currentPlans = store.get(plansAtom);
        const plan = currentPlans.find(p => p.id === planId);
        
        if (plan && plan.actionFiles) {
          // Mark files as in progress
          console.log(`Updating file statuses for plan ${planId}`);
          const updatedPlan = { ...plan };
          updatedPlan.actionFiles = updatedPlan.actionFiles.map(file => ({
            ...file,
            status: file.status === 'pending' ? 'updating' : file.status
          }));
          actions.addPlan(updatedPlan);
        }
        
        // Add a delay before fetching plans to ensure our local change is respected
        console.log(`Scheduling fetch plans after delay`);
        setTimeout(() => {
          vscode.commands.executeCommand('chartsmith.fetchPlans', workspaceId);
        }, 500);
      }).catch(error => {
        console.error('Error importing store:', error);
        // Fallback: fetch plans immediately if store import fails
        vscode.commands.executeCommand('chartsmith.fetchPlans', workspaceId);
      });
    }
    
    console.log(`==== PROCEED WITH PLAN FUNCTION COMPLETED SUCCESSFULLY ====`);
  } catch (error) {
    console.error(`Error proceeding with plan:`, error);
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
        // Import chat module dynamically and fetch messages
        const chat = await import('../chat');
        console.log(`Fetching messages for workspace: ${workspaceId}`);
        const messages = await chat.fetchWorkspaceMessages(
          globalState.authData,
          workspaceId
        );

        if (globalState.webviewGlobal) {
          globalState.webviewGlobal.postMessage({
            command: 'messages',
            messages: messages,
            workspaceId: workspaceId
          });
        }

        // Call /push API
        try {
          const api = await import('../api');
          const pushResponse = await api.fetchApi(
            globalState.authData,
            '/push',
            'GET'
          );

          // Store the push token in memory
          if (pushResponse && pushResponse.pushToken) {
            globalState.centrifugoJwt = pushResponse.pushToken;

            // Try to connect to Centrifugo with the JWT
            try {
              const webSocket = await import('../webSocket');
              await webSocket.connectWithCentrifugoJwt();
            } catch (error) {
              console.error('Error connecting to Centrifugo:', error);
            }
          }
        } catch (error) {
          console.error('Error fetching push data:', error);
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

  // Register fetch workspace data command
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.fetchWorkspaceData', async (workspaceId: string) => {
      if (!globalState.authData) {
        vscode.window.showErrorMessage('Please log in to ChartSmith first.');
        return;
      }

      try {
        // Import workspace module
        const workspace = await import('../workspace');
        await workspace.fetchAndStoreWorkspaceData(workspaceId);
        
        // Notify the webview that workspace data has been updated
        if (globalState.webviewGlobal) {
          globalState.webviewGlobal.postMessage({
            command: 'workspaceDataFetched',
            workspaceId: workspaceId
          });
        }
        
      } catch (error) {
        console.error(`Error fetching workspace data: ${error}`);
        vscode.window.showErrorMessage(`Failed to fetch workspace data: ${error}`);
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
        const workspaceRenders = await renders.fetchWorkspaceRenders(
          globalState.authData,
          workspaceId
        );

        if (globalState.webviewGlobal) {
          globalState.webviewGlobal.postMessage({
            command: 'renders',
            renders: workspaceRenders,
            workspaceId: workspaceId
          });
        }

        // Call /push API
        try {
          const api = await import('../api');
          const pushResponse = await api.fetchApi(
            globalState.authData,
            '/push',
            'GET'
          );

          // Store the push token in memory
          if (pushResponse && pushResponse.pushToken) {
            globalState.centrifugoJwt = pushResponse.pushToken;

            // Try to connect to Centrifugo with the JWT
            try {
              const webSocket = await import('../webSocket');
              await webSocket.connectWithCentrifugoJwt();
            } catch (error) {
              console.error('Error connecting to Centrifugo:', error);
            }
          }
        } catch (error) {
          console.error('Error fetching push data:', error);
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
        const workspacePlans: Plan[] = await plans.fetchWorkspacePlans(
          globalState.authData,
          workspaceId
        );

        if (globalState.webviewGlobal) {
          globalState.webviewGlobal.postMessage({
            command: 'plans',
            plans: workspacePlans,
            workspaceId: workspaceId
          });

          // Force re-render of messages to make sure plans are displayed
          setTimeout(() => {
            if (globalState.webviewGlobal) {
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
        // Import the config module
        const config = await import('../config');

        // Start the auth server first
        auth.startAuthServer(port).then(token => {
          if (token) {
            vscode.window.showInformationMessage('Successfully logged in to ChartSmith.');
            // We don't connect to WebSocket here - only when a workspace is opened
          }
        });

        // Get the WWW endpoint from configuration
        const wwwEndpoint = config.getWwwEndpointConfig();
        
        // Open the authentication URL in the browser
        const authUrl = `${wwwEndpoint}/auth/extension?next=http://localhost:${port}`;
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

  // Register a command to verify session
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.verifySession', async () => {
      try {
        // Import the auth module and verify session
        const auth = await import('../auth');
        let sessionValid = await auth.verifySession();
        
        if (sessionValid) {
          vscode.window.showInformationMessage('Session verified successfully. You are authenticated.');
        } else {
          // If verification fails, try to refresh the session
          vscode.window.showWarningMessage('Session verification failed. Attempting to refresh...');
          
          const refreshed = await auth.refreshSession();
          if (refreshed) {
            // Verify again after refresh
            sessionValid = await auth.verifySession();
            if (sessionValid) {
              vscode.window.showInformationMessage('Session refreshed and verified successfully.');
            } else {
              vscode.window.showErrorMessage('Session still invalid after refresh. Please log out and log in again.');
            }
          } else {
            vscode.window.showErrorMessage('Session refresh failed. Please log out and log in again.');
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Session verification failed: ${error}`);
      }
    })
  );

  // Register a command to test file writing for development use
  if (isDevelopmentMode()) {
    context.subscriptions.push(
      vscode.commands.registerCommand('chartsmith.testFileWrite', async () => {
        try {
          // Get the active workspace ID
          const workspace = await import('../workspace');
          const activeWorkspaceId = await workspace.getActiveWorkspaceId();
          
          if (!activeWorkspaceId) {
            vscode.window.showErrorMessage('No active workspace. Please open a chart first.');
            return;
          }
          
          // Import the fileContent module
          const fileContent = await import('../fileContent');
          
          // Run the test
          await fileContent.testFileWrite(activeWorkspaceId);
          
        } catch (error) {
          console.error('Error running file write test:', error);
          vscode.window.showErrorMessage(`File write test failed: ${error}`);
        }
      })
    );
  }
}

function registerViews(context: vscode.ExtensionContext): void {
  const provider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('chartsmith.view', provider)
  );
  
  // Check for a saved workspace ID and activate it if found
  setTimeout(async () => {
    try {
      const workspaceModule = await import('../workspace');
      const activeWorkspaceId = await workspaceModule.getActiveWorkspaceId();
      
      if (activeWorkspaceId) {
        console.log(`Found saved workspace ID at startup: ${activeWorkspaceId}`);
        console.log('Activating saved workspace...');
        
        // Verify that the workspace mapping still exists
        const mapping = await workspaceModule.getWorkspaceMapping(activeWorkspaceId);
        if (mapping) {
          console.log(`Verified workspace mapping exists for ID: ${activeWorkspaceId}`);
          // Re-set the active workspace to trigger proper initialization
          await workspaceModule.setActiveWorkspaceId(activeWorkspaceId);
        } else {
          console.warn(`No workspace mapping found for saved ID: ${activeWorkspaceId}`);
        }
      }
    } catch (error) {
      console.error('Error activating saved workspace:', error);
    }
  }, 1000); // Wait a second after registration to ensure extension is fully loaded
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

    // Add event listener for webview visibility changes
    webviewView.onDidChangeVisibility(async () => {
      console.log(`Webview visibility changed. Is visible: ${webviewView.visible}`);
      
      if (webviewView.visible) {
        // When view becomes visible again, restore the workspace state
        const workspaceModule = await import('../workspace');
        const activeWorkspaceId = await workspaceModule.getActiveWorkspaceId();
        
        if (activeWorkspaceId) {
          console.log(`Restoring workspace session: ${activeWorkspaceId}`);
          
          // Get mapping for chart path
          let chartPath = '';
          const mapping = await workspaceModule.getWorkspaceMapping(activeWorkspaceId);
          if (mapping && mapping.localPath) {
            chartPath = mapping.localPath;
          }
          
          // Send a refresh command to the webview
          webviewView.webview.postMessage({
            command: 'refresh'
          });
          
          // Send the workspace data to the webview
          webviewView.webview.postMessage({
            command: 'workspaceChanged',
            workspaceId: activeWorkspaceId,
            chartPath: chartPath
          });
          
          // Force a reload of the workspace data
          vscode.commands.executeCommand('chartsmith.fetchWorkspaceData', activeWorkspaceId);
          
          // Add a delay before fetching messages
          setTimeout(() => {
            if (activeWorkspaceId) {
              vscode.commands.executeCommand('chartsmith.fetchMessages', activeWorkspaceId);
              
              // Fetch renders and plans after more delay
              setTimeout(() => {
                vscode.commands.executeCommand('chartsmith.fetchRenders', activeWorkspaceId);
                vscode.commands.executeCommand('chartsmith.fetchPlans', activeWorkspaceId);
              }, 500);
            }
          }, 300);
        }
      }
    });

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
      if (message.filePath && message.workspaceId) {
        await renderDebugDiff(message.filePath, message.workspaceId);
      } else {
        console.error('Missing required parameters for renderDebugDiff: filePath and workspaceId are required');
      }
      break;
    case 'fetchWorkspaceData':
      console.log(`!!! RECEIVED fetchWorkspaceData MESSAGE from webview for ${message.workspaceId} !!!`);
      if (message.workspaceId) {
        console.log(`!!! EXECUTING chartsmith.fetchWorkspaceData COMMAND for ${message.workspaceId} !!!`);
        vscode.commands.executeCommand('chartsmith.fetchWorkspaceData', message.workspaceId);
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
 * Renders a debug diff of a file
 */
export async function renderDebugDiff(filePath: string, workspaceId: string): Promise<void> {
  try {
    console.log(`Rendering debug diff for file: ${filePath} in workspace: ${workspaceId}`);
    
    // First get the current file content from the filesystem
    const fs = require('fs');
    const path = require('path');
    
    // Get the chart path from workspace mapping
    const workspaceModule = await import('../workspace');
    const mapping = await workspaceModule.getWorkspaceMapping(workspaceId);

    if (!mapping || !mapping.localPath) {
      vscode.window.showErrorMessage('Could not find chart path for workspace');
      return;
    }

    // The localPath is the full path to the chart directory
    const chartBasePath = mapping.localPath;
    
    // Normalize both paths for consistent comparison
    const normalizedChartPath = path.normalize(chartBasePath);
    const normalizedFilePath = path.normalize(filePath);
    
    // Handle path extraction and normalization similar to acceptFileChanges
    let relativePath;
    
    // Special case: if the file path contains both the chart path AND a duplicate of the chart path
    if (normalizedFilePath.includes(normalizedChartPath)) {
      // Extract all occurrences of the chart path
      const allMatches = [];
      let startIndex = 0;
      let foundIndex;
      
      while ((foundIndex = normalizedFilePath.indexOf(normalizedChartPath, startIndex)) !== -1) {
        allMatches.push(foundIndex);
        startIndex = foundIndex + normalizedChartPath.length;
      }
      
      console.log(`Found ${allMatches.length} occurrences of chartPath in filePath for debug diff`);
      
      if (allMatches.length > 1) {
        // Multiple occurrences means we have duplication - take everything after the last match
        const lastMatchIndex = allMatches[allMatches.length - 1];
        relativePath = normalizedFilePath.substring(lastMatchIndex + normalizedChartPath.length);
        console.log(`Multiple occurrences detected - extracted path after last match: ${relativePath}`);
      } else if (allMatches.length === 1) {
        // Single occurrence - normal case, extract the path after the chart path
        relativePath = normalizedFilePath.substring(allMatches[0] + normalizedChartPath.length);
        console.log(`Single occurrence - extracted path: ${relativePath}`);
      }
    }
    
    // If no relative path extracted yet, use standard handling
    if (!relativePath) {
      if (normalizedFilePath.startsWith(normalizedChartPath)) {
        // Extract just the relative part by removing the chart base path
        relativePath = normalizedFilePath.substring(normalizedChartPath.length);
        console.log(`Path starts with chart base path, extracted relative part: ${relativePath}`);
      } else {
        // Treat as a relative path, just remove any leading slashes
        relativePath = normalizedFilePath.replace(/^\/+/, '');
        console.log(`Using as relative path: ${relativePath}`);
      }
    }
    
    // Ensure no leading slash for proper path joining
    relativePath = relativePath.replace(/^\/+/, '');
    
    // Join paths correctly to create the full absolute path
    const fullFilePath = path.join(normalizedChartPath, relativePath);
    
    console.log(`Full file path for debug diff: ${fullFilePath}`);
    
    // Check if the file exists in the filesystem
    let currentContent = '';
    try {
      if (fs.existsSync(fullFilePath)) {
        currentContent = fs.readFileSync(fullFilePath, 'utf8');
        console.log(`Read current content from filesystem: ${fullFilePath}`);
      } else {
        console.log(`File does not exist in filesystem: ${fullFilePath}`);
      }
    } catch (error) {
      console.error(`Error reading current content: ${error}`);
    }
    
    // Attempt to get pending content
    let pendingContent = '';
    
    // Check global maps
    if (global.pendingContentMap?.has(filePath)) {
      pendingContent = global.pendingContentMap.get(filePath) || '';
      console.log(`Found pending content in global map for ${filePath}`);
    } else if (global.chartsmithContentMap?.has(filePath)) {
      pendingContent = global.chartsmithContentMap.get(filePath) || '';
      console.log(`Found content in chartsmith map for ${filePath}`);
    }
    
    // Try to get it from our workspace KV store if not found in maps
    if (!pendingContent) {
      try {
        const currentWorkspaceId = await workspaceModule.getActiveWorkspaceId();
        
        if (currentWorkspaceId) {
          const storedContent = await workspaceModule.getPendingFileContent(currentWorkspaceId, filePath);
          if (storedContent) {
            pendingContent = storedContent;
            console.log(`Retrieved pending content from workspace KV store for ${filePath}`);
          }
        }
      } catch (error) {
        console.error(`Error getting content from workspace KV store: ${error}`);
      }
    }
    
    // If still no pending content, fetch from API
    if (!pendingContent) {
      try {
        // Find the active plan for this workspace
        const plans = await import('../plans');
        
        // Let's use the fetch API approach directly
        const globalState = (global as any).chartsmithGlobalState;
        if (!globalState || !globalState.authData) {
          vscode.window.showErrorMessage('No auth data available. Please log in again.');
          return;
        }
        
        // Import API module
        const api = await import('../api');
        
        // Fetch the plans for this workspace
        const plansResponse = await api.fetchApi(
          globalState.authData,
          `/workspace/${workspaceId}/plans`,
          'GET'
        );
        
        const activePlans = Array.isArray(plansResponse) ? plansResponse : [];
        const relevantPlan = activePlans.find((p: any) => 
          p.status === 'pending' || p.status === 'approved'
        );
        
        if (relevantPlan?.id) {
          console.log(`Found active plan with ID: ${relevantPlan.id}`);
          
          const fetchedContent = await api.fetchPendingFileContentWithProgress(
            globalState.authData,
            workspaceId,
            relevantPlan.id,
            filePath
          );
          
          if (fetchedContent) {
            pendingContent = fetchedContent;
            console.log(`Successfully retrieved content from API for ${filePath}`);
          } else {
            console.error(`Failed to retrieve content from API for ${filePath}`);
          }
        } else {
          console.error('No active plan found for workspace:', workspaceId);
        }
      } catch (error) {
        console.error(`Error fetching content from API: ${error}`);
      }
    }
    
    // If we couldn't get pending content, show error
    if (!pendingContent) {
      vscode.window.showErrorMessage(`Could not retrieve pending content for ${filePath} to show diff.`);
      return;
    }

    // Use the render module to show the diff
    const render = await import('../render');
    await render.showFileDiff(
      fullFilePath, 
      pendingContent,
      `Debug Diff: ${path.basename(filePath)}`
    );
    
    console.log(`Displayed diff for ${filePath}`);
  } catch (error) {
    console.error(`Error rendering debug diff: ${error}`);
    vscode.window.showErrorMessage(`Error displaying diff: ${error}`);
  }
}

/**
 * Handle file diff request from the webview
 * Gets the file path and displays a diff
 */
export async function handleFileDiff(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {
  try {
    console.log(`Viewing diff for file: ${filePath} in workspace: ${workspaceId}`);
    // Rest of the function remains unchanged...
  } catch (error) {
    console.error(`Error handling file diff: ${error}`);
    vscode.window.showErrorMessage(`Failed to view file diff: ${error}`);
  }
}

/**
 * Accept file changes - apply pending content to the file
 */
export async function acceptFileChanges(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {
  try {
    console.log(`Accepting changes for file: ${filePath} in workspace: ${workspaceId}`);
    console.log(`Pending content provided: ${pendingContent ? 'Yes' : 'No'}`);
    
    // First check if we have stored content in the global map
    if (!pendingContent && global.pendingContentMap?.has(filePath)) {
      pendingContent = global.pendingContentMap.get(filePath);
      console.log(`Retrieved pending content from global map for ${filePath}`);
    }
    
    // Try to get it from our workspace KV store
    if (!pendingContent) {
      try {
        const workspace = await import('../workspace');
        const currentWorkspaceId = await workspace.getActiveWorkspaceId();
        
        if (currentWorkspaceId) {
          const storedContent = await workspace.getPendingFileContent(currentWorkspaceId, filePath);
          if (storedContent) {
            pendingContent = storedContent;
            console.log(`Retrieved pending content from workspace KV store for ${filePath}`);
          }
        }
      } catch (error) {
        console.error(`Error getting content from workspace KV store: ${error}`);
      }
    }
    
    // If we still don't have content, fetch from the API
    if (!pendingContent) {
      try {
        // Find the active plan for this workspace
        const plans = await import('../plans');
        
        // Let's use the fetch API approach directly since we don't have a getPlansForWorkspace method
        const globalState = (global as any).chartsmithGlobalState;
        if (!globalState || !globalState.authData) {
          vscode.window.showErrorMessage('No auth data available. Please log in again.');
          return;
        }
        
        // Import API module
        const api = await import('../api');
        
        // Fetch the plans for this workspace
        const plansResponse = await api.fetchApi(
          globalState.authData,
          `/workspace/${workspaceId}/plans`,
          'GET'
        );
        
        const activePlans = Array.isArray(plansResponse) ? plansResponse : [];
        const relevantPlan = activePlans.find((p: any) => 
          p.status === 'pending' || p.status === 'approved'
        );
        
        if (relevantPlan?.id) {
          console.log(`Found active plan with ID: ${relevantPlan.id}`);
          
          // Use the progress indicator version for better UX
          const fetchedContent = await api.fetchPendingFileContentWithProgress(
            globalState.authData,
            workspaceId,
            relevantPlan.id,
            filePath
          );
          
          if (fetchedContent) {
            pendingContent = fetchedContent;
            console.log(`Successfully retrieved content from API for ${filePath}`);
          } else {
            console.error(`Failed to retrieve content from API for ${filePath}`);
          }
        } else {
          console.error('No active plan found for workspace:', workspaceId);
        }
      } catch (error) {
        console.error(`Error fetching content from API: ${error}`);
      }
    }
    
    // If we still don't have content, show error and abort
    if (!pendingContent) {
      vscode.window.showErrorMessage(`Could not retrieve content for ${filePath}. The operation has been cancelled.`);
      return;
    }

    // Use the file content module to write to filesystem instead of duplicating logic
    const fileContent = await import('../fileContent');

    // Add detailed logging of content before writing
    if (!pendingContent) {
      console.error(`[acceptFileChanges] ERROR: pendingContent is null or undefined for ${filePath}`);
      vscode.window.showErrorMessage(`Failed to apply changes: No content available for ${path.basename(filePath)}`);
      return;
    }

    console.log(`[acceptFileChanges] Content validation before writing:
- File path: ${filePath}
- Workspace ID: ${workspaceId}
- Content length: ${pendingContent.length}
- Content preview: ${pendingContent.substring(0, 100)}${pendingContent.length > 100 ? '...' : ''}
`);

    // Try writing the file with the enhanced implementation
    await fileContent.writeContentToFilesystem(filePath, workspaceId, pendingContent);

    // Log all maps and keys for debugging
    console.log(`pendingContentMap keys: ${Array.from(global.pendingContentMap?.keys() || []).join(', ')}`);
    console.log(`chartsmithContentMap keys: ${Array.from(global.chartsmithContentMap?.keys() || []).join(', ')}`);
    
    // Clean up the entries from our maps since we've applied the content
    global.pendingContentMap?.delete(filePath);
    global.chartsmithContentMap?.delete(filePath);
    console.log(`Removed pending content from maps for ${filePath} after applying`);

    // Show success message
    vscode.window.showInformationMessage(`Applied changes to ${path.basename(filePath)}`);

    // Notify the webview that changes were applied
    const globalState = (global as any).chartsmithGlobalState;
    if (globalState?.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'fileChangesApplied',
        filePath: filePath,
        workspaceId: workspaceId
      });
      
      // Find the active plan for this file and update its status
      try {
        import('../../state/store').then(async ({ actions, store }) => {
          const plansAtom = (await import('../../state/atoms')).plansAtom;
          const currentPlans = store.get(plansAtom);
          
          // Find plans that have this file
          const relevantPlan = currentPlans.find(plan => 
            plan.actionFiles && 
            plan.actionFiles.some(file => file.path === filePath)
          );
          
          if (relevantPlan) {
            console.log(`Updating status for plan ${relevantPlan.id} after applying file changes`);
            
            // Use the new action to update file status
            actions.updateFileStatus(relevantPlan.id, filePath, 'applied');
            
            // No need to check allApplied manually - the updateFileStatus action handles this
            // and will update the plan status automatically if needed
          }
        }).catch(error => {
          console.error('Error updating plan status after applying file changes:', error);
        });
      } catch (error) {
        console.error('Error importing store or updating plan status:', error);
      }
    }
  } catch (error) {
    console.error(`Error accepting file changes: ${error}`);
    vscode.window.showErrorMessage(`Error applying changes: ${error}`);
  }
}

/**
 * Reject file changes - discard pending content
 */
export async function rejectFileChanges(filePath: string, workspaceId: string, pendingContent?: string): Promise<void> {
  try {
    console.log(`Rejecting changes for file: ${filePath} in workspace: ${workspaceId}`);
    console.log(`Pending content provided: ${pendingContent ? 'Yes' : 'No'}`);
    
    // First check if we have stored content in the global map
    if (!pendingContent && global.pendingContentMap?.has(filePath)) {
      pendingContent = global.pendingContentMap.get(filePath);
      console.log(`Retrieved pending content from global map for ${filePath} for rejection`);
    }
    
    // Try to get it from our workspace KV store
    if (!pendingContent) {
      try {
        const workspace = await import('../workspace');
        const currentWorkspaceId = await workspace.getActiveWorkspaceId();
        
        if (currentWorkspaceId) {
          const storedContent = await workspace.getPendingFileContent(currentWorkspaceId, filePath);
          if (storedContent) {
            pendingContent = storedContent;
            console.log(`Retrieved pending content from workspace KV store for ${filePath} for rejection`);
          }
        }
      } catch (error) {
        console.error(`Error getting content from workspace KV store: ${error}`);
      }
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

    // IMPROVED PATH HANDLING:
    // Normalize both paths for consistent comparison
    const normalizedChartPath = path.normalize(chartBasePath);
    const normalizedFilePath = path.normalize(filePath);
    
    console.log(`Path analysis for rejection:
      normalizedChartPath: ${normalizedChartPath}
      normalizedFilePath: ${normalizedFilePath}
      isAbsoluteFilePath: ${path.isAbsolute(normalizedFilePath)}
    `);
    
    let relativePath;
    
    // Special case: if the file path contains both the chart path AND a duplicate of the chart path
    if (normalizedFilePath.includes(normalizedChartPath)) {
      // Extract all occurrences of the chart path
      const allMatches = [];
      let startIndex = 0;
      let foundIndex;
      
      while ((foundIndex = normalizedFilePath.indexOf(normalizedChartPath, startIndex)) !== -1) {
        allMatches.push(foundIndex);
        startIndex = foundIndex + normalizedChartPath.length;
      }
      
      console.log(`Found ${allMatches.length} occurrences of chartPath in filePath for rejection`);
      
      if (allMatches.length > 1) {
        // Multiple occurrences means we have duplication - take everything after the last match
        const lastMatchIndex = allMatches[allMatches.length - 1];
        relativePath = normalizedFilePath.substring(lastMatchIndex + normalizedChartPath.length);
        console.log(`Multiple occurrences detected - extracted path after last match: ${relativePath}`);
      } else if (allMatches.length === 1) {
        // Single occurrence - normal case, extract the path after the chart path
        relativePath = normalizedFilePath.substring(allMatches[0] + normalizedChartPath.length);
        console.log(`Single occurrence - extracted path: ${relativePath}`);
      }
    }
    
    // If no relative path extracted yet, use standard handling
    if (!relativePath) {
      if (normalizedFilePath.startsWith(normalizedChartPath)) {
        // Extract just the relative part by removing the chart base path
        relativePath = normalizedFilePath.substring(normalizedChartPath.length);
        console.log(`Path starts with chart base path, extracted relative part: ${relativePath}`);
      } else {
        // Treat as a relative path, just remove any leading slashes
        relativePath = normalizedFilePath.replace(/^\/+/, '');
        console.log(`Using as relative path: ${relativePath}`);
      }
    }
    
    // Ensure no leading slash for proper path joining
    relativePath = relativePath.replace(/^\/+/, '');
    
    // Join paths correctly to create the full absolute path
    const fullFilePath = path.join(normalizedChartPath, relativePath);

    // Log detailed path information for debugging
    console.log(`Chart base path: ${chartBasePath}`);
    console.log(`Original file path: ${filePath}`);
    console.log(`Relative path for rejection: ${relativePath}`);
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
    vscode.window.showInformationMessage(`Changes rejected for ${path.basename(filePath)}`);

    // Notify the webview that changes were rejected
    if (globalState.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'fileChangeRejected',
        filePath: filePath,
        status: 'rejected'
      });
    }
  } catch (error) {
    console.error(`Error rejecting file changes: ${error}`);
    vscode.window.showErrorMessage(`Error rejecting file changes: ${error}`);
  }
}
