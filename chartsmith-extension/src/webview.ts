// This file contains the client-side code for the webview
// It will be bundled into dist/webview.js

// Helper function to escape HTML for security
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Import state management
import { store, actions } from './state/store';
import { messagesAtom, workspaceIdAtom, connectionStatusAtom, rendersAtom, plansAtom } from './state/atoms';
import { marked } from 'marked';

// Define global interfaces
interface Window {
  vscodeWebviewContext: any;
  acquireVsCodeApi(): any;
  jotaiStore: any;
  pushTokenFetched?: boolean;
}

// When running in a webview inside VS Code
let vscode: any;
try {
  vscode = (window as any).acquireVsCodeApi();
} catch (error) {
  // Fallback for testing in a browser
  vscode = {
    postMessage: (message: any) => console.log('postMessage:', message)
  };
}

// Create an object to store state in the VS Code webview's state
const state = {
  draftMessage: '',
  workspaceId: '',
  activateWorkspace: true // Add flag to control workspace activation
};

// For state persistence
let persistenceInterval: NodeJS.Timeout | null = null;

// Try to load any saved state
try {
  const savedState = vscode.getState();
  if (savedState) {
    Object.assign(state, savedState);
    console.log('Loaded saved state:', state);
  }
} catch (e) {
  console.log('Error loading state:', e);
}

const context = (window as any).vscodeWebviewContext || {};

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  
  // Set up a heartbeat to regularly save state
  if (persistenceInterval) {
    clearInterval(persistenceInterval);
  }
  
  persistenceInterval = setInterval(() => {
    // Only persist if we have a workspaceId
    if (context.workspaceId) {
      state.workspaceId = context.workspaceId;
      state.activateWorkspace = true;
      try {
        vscode.setState(state);
        console.log(`State persistence heartbeat - saved workspace ID: ${context.workspaceId}`);
      } catch (e) {
        console.error('Error in persistence heartbeat:', e);
      }
    }
  }, 5000); // Check every 5 seconds
});

function initUI() {
  const app = document.getElementById('app');
  if (!app) return;

  if (context.token) {
    renderLoggedInView(app);
    
    // If we have a saved workspaceId in state but not in context,
    // and we should activate it (not just after manually disconnecting)
    if (state.workspaceId && !context.workspaceId && state.activateWorkspace) {
      console.log(`Restoring previous workspace session: ${state.workspaceId}`);
      // Restore the previous workspace
      vscode.postMessage({
        command: 'fetchWorkspaceData',
        workspaceId: state.workspaceId
      });
      
      // Set a delay to fetch messages after workspace data is loaded
      setTimeout(() => {
        vscode.postMessage({
          command: 'fetchMessages',
          workspaceId: state.workspaceId
        });
        
        // Update the context manually
        context.workspaceId = state.workspaceId;
        actions.setWorkspaceId(state.workspaceId);
        
        // Re-render the view with the restored context
        renderLoggedInView(app);
      }, 500);
    }
  } else {
    renderLoginView(app);
  }

  // Initialize the store with context values
  if (context.workspaceId) {
    actions.setWorkspaceId(context.workspaceId);
    
    // Save the workspaceId to our persistent state
    state.workspaceId = context.workspaceId;
    state.activateWorkspace = true;
    try {
      vscode.setState(state);
      console.log('Saved workspace ID to state:', context.workspaceId);
    } catch (e) {
      console.error('Error saving workspace ID to state:', e);
    }
  }
  if (context.connectionStatus) {
    actions.setConnectionStatus(context.connectionStatus);
  }

  // Set up message listeners
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.command) {
      case 'debug':
        // Log debug messages directly to console
        console.log('DEBUG FROM EXTENSION:', message.message);
        break;
      case 'connectionStatus':
        actions.setConnectionStatus(message.status);
        updateConnectionStatus(message.status);
        break;
      case 'newMessage':
        actions.addMessage(message.message);
        renderAllMessages(); // Re-render from store
        break;
      case 'messageUpdated':
        console.log('========= MESSAGE UPDATED EVENT ==========');
        console.log('Received updated message from extension:', message.message);
        console.log('Current messages before update:', store.get(messagesAtom));
        actions.updateMessage(message.message);
        console.log('Messages after update:', store.get(messagesAtom));
        renderAllMessages(); // Re-render from store
        console.log('Re-render triggered');

        // If we have a send button and it's showing the loading state, reset it
        const sendBtn = document.getElementById('send-message-btn') as HTMLButtonElement;
        if (sendBtn && sendBtn.querySelector('.loading-icon')) {
          sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          `;
          sendBtn.disabled = true;
        }
        break;
      case 'messages':
        console.log('Received messages from extension:', message.messages);
        actions.setMessages(message.messages || []);
        renderAllMessages(); // Re-render from store
        break;
      case 'renders':
        console.log('Received renders from extension:', message.renders);
        actions.setRenders(message.renders || []);

        // Force re-render of messages to update render displays
        renderAllMessages();

        break;
      case 'newRender':
        console.log('Received new render from extension:', message.render);
        actions.addRender(message.render);
        // Force re-render of messages to update render displays
        renderAllMessages();
        break;
      case 'plans':
        console.log('Received plans from extension:', message.plans);
        actions.setPlans(message.plans || []);
        // Immediately check what's in the store after setting
        console.log('Plans in store after update:', store.get(plansAtom));
        // Re-render messages to show plans if there are any with responsePlanId
        renderAllMessages();
        break;
      case 'newPlan':
        console.log('Received new plan from extension:', message.plan);
        actions.addPlan(message.plan);
        // Check what's in the store after adding
        console.log('Plans in store after adding new plan:', store.get(plansAtom));
        // Re-render messages to show plans if there are any with responsePlanId
        renderAllMessages();
        break;
      case 'updatePlanStatus':
        console.log(`Received updatePlanStatus message for plan: ${message.planId}, status: ${message.status}`);
        // Use the updatePlanStatus action to update the plan status
        actions.updatePlanStatus(message.planId, message.status);
        
        // Force re-render of all messages to update UI
        console.log(`Forcing re-render of all messages to update plan status in UI`);
        renderAllMessages();
        break;
      case 'fileChangesApplied':
        console.log('File changes applied:', message.filePath, message.workspaceId);
        // Force re-render messages to update UI
        renderAllMessages();
        break;
      case 'renderMessages':
        console.log('Re-rendering all messages to update plans');
        renderAllMessages();
        break;
      case 'workspaceUpdated':
        console.log('Workspace updated:', message.workspace);
        // You could update workspace data in state here if needed
        break;
      case 'refresh':
        // Handle refresh message when webview becomes visible again
        console.log('Received refresh message - webview visibility restored');
        if (state.workspaceId && state.activateWorkspace) {
          console.log(`Re-initializing workspace on refresh: ${state.workspaceId}`);
          // Update local context
          context.workspaceId = state.workspaceId;
          actions.setWorkspaceId(state.workspaceId);
          
          // Reload the webview content
          const app = document.getElementById('app');
          if (app) {
            renderLoggedInView(app);
          }
          
          // Force data refresh
          vscode.postMessage({
            command: 'fetchWorkspaceData',
            workspaceId: state.workspaceId
          });
          
          // Fetch other data with delays
          setTimeout(() => {
            vscode.postMessage({
              command: 'fetchMessages',
              workspaceId: state.workspaceId
            });
            
            setTimeout(() => {
              vscode.postMessage({
                command: 'fetchRenders',
                workspaceId: state.workspaceId
              });
              vscode.postMessage({
                command: 'fetchPlans',
                workspaceId: state.workspaceId
              });
            }, 500);
          }, 300);
        }
        break;
      case 'authChanged':
        // Handle authentication state changes
        console.log('Auth state changed:', message.status);
        if (message.status === 'loggedIn') {
          // Update context with new auth data
          if (message.authData) {
            context.token = message.authData.hasToken ? 'token-exists' : undefined;
            context.apiEndpoint = message.authData.apiEndpoint;
            context.pushEndpoint = message.authData.pushEndpoint;
            context.wwwEndpoint = message.authData.wwwEndpoint;
            context.userId = message.authData.userId;
          } else {
            context.token = 'token-exists';
          }
          
          // Re-render the main view
          const appDiv = document.getElementById('app');
          if (appDiv) {
            console.log('Rendering logged-in view after auth change');
            renderLoggedInView(appDiv);
          }
        } else if (message.status === 'loggedOut') {
          // Clear context data
          context.token = undefined;
          context.workspaceId = '';
          context.apiEndpoint = undefined;
          context.pushEndpoint = undefined;
          context.wwwEndpoint = undefined;
          context.userId = undefined;
          
          // Clear state
          state.workspaceId = '';
          state.activateWorkspace = false;
          state.draftMessage = '';
          
          try {
            vscode.setState(state);
          } catch (e) {
            console.error('Error saving state after logout:', e);
          }
          
          // Reset store state
          actions.setWorkspaceId(null);
          actions.setMessages([]);
          actions.setRenders([]);
          actions.setPlans([]);
          
          // Re-render login view
          const appDiv = document.getElementById('app');
          if (appDiv) {
            console.log('Rendering login view after auth change');
            renderLoginView(appDiv);
          }
        }
        break;
      case 'planProceedError':
        console.log('Error proceeding with plan:', message.planId, message.error);
        // Find the button for this plan and reset its state
        const proceedButton = document.querySelector(`.plan-proceed-button[data-plan-id="${message.planId}"]`) as HTMLButtonElement;
        if (proceedButton) {
          proceedButton.textContent = 'Proceed';
          proceedButton.disabled = false;
        }
        break;
      case 'workspaceChanged':
        // Update the context and fetch messages for the new workspace
        console.log(`Workspace changed event received - new ID: ${message.workspaceId}`);
        context.workspaceId = message.workspaceId;
        context.chartPath = message.chartPath || '';
        actions.setWorkspaceId(message.workspaceId);

        // Save the new workspace ID to our persistent state
        state.workspaceId = message.workspaceId;
        state.activateWorkspace = true;
        try {
          vscode.setState(state);
          console.log('Updated workspace ID in state:', message.workspaceId);
        } catch (e) {
          console.error('Error saving workspace ID to state:', e);
        }

        // Update the chart path if present
        if (message.chartPath) {
          console.log(`Chart path: ${message.chartPath}`);
          const chartPathEl = document.getElementById('chart-path');
          if (chartPathEl) {
            chartPathEl.textContent = message.chartPath;
          }
        }

        // Re-render the view with updated context
        const app = document.getElementById('app');
        if (app) {
          renderLoggedInView(app);
        }

        console.log(`Fetching workspace data for changed workspace ID: ${message.workspaceId}`);
        
        // IMPORTANT: First fetch workspace data and wait for a brief delay to ensure it completes
        console.log(`EXPLICITLY FETCHING WORKSPACE DATA FIRST for changed workspace ${message.workspaceId}`);
        vscode.postMessage({
          command: 'fetchWorkspaceData',
          workspaceId: message.workspaceId
        });
        
        // Add a small delay before fetching messages to ensure workspace data is fetched first
        setTimeout(() => {
          console.log(`Now fetching messages after workspace data for changed workspace ${message.workspaceId}`);
          // Then fetch fresh messages from the server
          vscode.postMessage({
            command: 'fetchMessages',
            workspaceId: message.workspaceId
          });
        }, 500);  // 500ms delay
        
        // Add a longer delay for renders and plans to ensure they come after workspace and messages
        setTimeout(() => {
          console.log(`Now fetching renders and plans after delay for changed workspace ${message.workspaceId}`);
          // Also fetch renders and plans
          vscode.postMessage({
            command: 'fetchRenders',
            workspaceId: message.workspaceId
          });

          // Fetch plans 
          vscode.postMessage({
            command: 'fetchPlans',
            workspaceId: message.workspaceId
          });
        }, 1000);  // 1000ms delay
        break;
      case 'goHome':
        // Clear the active workspace and disconnect from WebSocket
        // Set the activateWorkspace flag to false so we don't
        // automatically reconnect to this workspace on next load
        state.activateWorkspace = false;
        try {
          vscode.setState(state);
        } catch (e) {
          console.log('Error updating state after disconnect:', e);
        }
        vscode.postMessage({ command: 'goHome' });
        break;
      // Add more message handlers here
    }
  });

  // Set up workspace selection
  const workspaceSelect = document.getElementById('workspace-select');
  if (workspaceSelect) {
    workspaceSelect.addEventListener('change', (e) => {
      const selectedWorkspaceId = (e.target as HTMLSelectElement).value;
      vscode.postMessage({
        command: 'setWorkspace',
        workspaceId: selectedWorkspaceId
      });
      
      // Save workspace ID to state and enable auto-activation
      state.workspaceId = selectedWorkspaceId;
      state.activateWorkspace = true;
      try {
        vscode.setState(state);
      } catch (e) {
        console.log('Error saving workspace selection to state:', e);
      }
    });
  }
}

function renderLoggedInView(container: HTMLElement) {
  container.innerHTML = `
    <div class="chartsmith-container">
      <div class="header">
        <h2>ChartSmith</h2>
      </div>
      ${context.workspaceId ? `
      <div class="chart-path">
        Current chart: <span id="chart-path">${context.chartPath || 'Unknown'}</span>
        <div class="chart-actions">
          <button id="open-in-chartsmith" class="icon-button" title="Open in ChartSmith.ai">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <button id="disconnect-btn" class="icon-button" title="Disconnect from workspace">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <path d="M21 12H8"></path>
              <path d="m12 8-4 4 4 4"></path>
            </svg>
          </button>
        </div>
      </div>
      ` : ''}
      <div class="content">
        <div id="messages-container" class="full-width"></div>
        <div id="renders-container"></div>
      </div>
      ${context.workspaceId ? `
      <div class="message-input-container">
        <textarea id="message-input" placeholder="Ask a question about your chart..." rows="3"></textarea>
        <button id="send-message-btn" class="icon-button" title="Send message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      ` : ''}
      <div class="footer">
        <div class="footer-left">
          ${context.workspaceId ? `
            <div class="connection-status ${context.connectionStatus}">
              ${context.connectionStatus}
            </div>
          ` : ''}
        </div>
        <div class="footer-right">
          <button id="logout-btn">Logout</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'logout' });
  });

  // Add handler for "Open in ChartSmith" button
  document.getElementById('open-in-chartsmith')?.addEventListener('click', () => {
    if (context.workspaceId && context.wwwEndpoint) {
      // Ensure we use the correct path format: /workspace/ not /api/workspace/
      const url = `${context.wwwEndpoint}/workspace/${context.workspaceId}`;
      console.log(`Opening workspace in browser: ${url}`);
      vscode.postMessage({
        command: 'openExternal',
        url
      });
    }
  });

  // Function to send message to API
  function sendMessage() {
    if (!context.workspaceId || !messageInput) return;

    const messageText = messageInput.value.trim();
    if (!messageText) return;

    // Get the send button and make sure it's not null
    const sendBtn = document.getElementById('send-message-btn') as HTMLButtonElement;
    if (!sendBtn) return;

    // Show loading state
    sendBtn.disabled = true;
    const originalContent = sendBtn.innerHTML;
    sendBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="loading-icon">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    `;

    // Send to extension to handle API call
    vscode.postMessage({
      command: 'sendMessage',
      workspaceId: context.workspaceId,
      message: messageText
    });

    // Clear input and draft
    messageInput.value = '';

    // Clear the saved draft
    state.draftMessage = '';
    try {
      vscode.setState(state);
    } catch (e) {
      console.log('Error saving state after clearing draft:', e);
    }

    // Reset button after delay (will be properly updated when message is confirmed)
    setTimeout(() => {
      sendBtn.innerHTML = originalContent;
      sendBtn.disabled = true;
    }, 1000);
  }

  // Add handler for "Disconnect" button
  document.getElementById('disconnect-btn')?.addEventListener('click', () => {
    // Show confirmation dialog
    const confirmationContainer = document.createElement('div');
    confirmationContainer.className = 'confirmation-dialog';
    confirmationContainer.innerHTML = `
      <div class="confirmation-content">
        <p>Are you sure you want to disconnect from the current workspace?</p>
        <div class="confirmation-buttons">
          <button id="confirm-disconnect">Disconnect</button>
          <button id="cancel-disconnect">Cancel</button>
        </div>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(confirmationContainer);

    // Add event listeners for confirmation buttons
    document.getElementById('confirm-disconnect')?.addEventListener('click', () => {
      // Remove the confirmation dialog
      confirmationContainer.remove();

      // Send disconnect command
      vscode.postMessage({ command: 'goHome' });

      // Clear workspace ID in context
      context.workspaceId = '';
      context.chartPath = '';
      actions.setWorkspaceId(null);
      
      // Set flag to prevent auto-reconnecting to this workspace
      state.activateWorkspace = false;
      try {
        vscode.setState(state);
      } catch (e) {
        console.log('Error updating state after disconnect:', e);
      }

      // Re-render the view
      renderLoggedInView(container);
    });

    document.getElementById('cancel-disconnect')?.addEventListener('click', () => {
      // Just remove the confirmation dialog
      confirmationContainer.remove();
    });
  });

  // Add message input handlers
  const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  const sendMessageBtn = document.getElementById('send-message-btn') as HTMLButtonElement;

  if (messageInput && sendMessageBtn) {
    // If we have a saved draft for this workspace, restore it
    if (state.draftMessage && state.workspaceId === context.workspaceId) {
      messageInput.value = state.draftMessage;
      console.log('Restored draft message:', state.draftMessage);

      // Update button state based on the restored input
      sendMessageBtn.disabled = !messageInput.value.trim();
    }

    // Save draft whenever input changes
    messageInput.addEventListener('input', () => {
      // Update button state
      sendMessageBtn.disabled = !messageInput.value.trim();

      // Save draft to state
      state.draftMessage = messageInput.value;
      state.workspaceId = context.workspaceId;

      // Save state to VS Code's webview state
      try {
        vscode.setState(state);
      } catch (e) {
        console.log('Error saving state:', e);
      }
    });

    // Initialize button state
    sendMessageBtn.disabled = !messageInput.value.trim();

    // Add keyboard shortcut (Enter to send, Shift+Enter for new line)
    messageInput.addEventListener('keydown', (e) => {
      // Send message with Enter (unless Shift is pressed for new line)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (messageInput.value.trim()) {
          sendMessage();
        }
      }
      // Keep the Ctrl/Cmd + Enter shortcut as well
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (messageInput.value.trim()) {
          sendMessage();
        }
      }
    });

    // Send button click handler
    sendMessageBtn.addEventListener('click', () => {
      if (messageInput.value.trim()) {
        sendMessage();
      }
    });
  }

  // Initialize Jotai store from context
  if (context.workspaceId) {
    actions.setWorkspaceId(context.workspaceId);
    console.log(`Initialized with workspaceId: ${context.workspaceId}`);
  }

  // Only fetch messages if we have a workspace ID
  const workspaceId = store.get(workspaceIdAtom);
  if (workspaceId) {
    // Show messages for the selected workspace
    console.log(`Webview requesting messages for workspace ID: ${workspaceId}`);

    // Render any existing messages from the store
    renderAllMessages();

    // IMPORTANT: First fetch workspace data and wait for a brief delay to ensure it completes
    console.log(`EXPLICITLY FETCHING WORKSPACE DATA FIRST for ${workspaceId}`);
    vscode.postMessage({
      command: 'fetchWorkspaceData',
      workspaceId: workspaceId
    });

    // Add a small delay before fetching messages to ensure workspace data is fetched first
    setTimeout(() => {
      console.log(`Now fetching messages after workspace data for ${workspaceId}`);
      // Then fetch fresh messages from the server
      vscode.postMessage({
        command: 'fetchMessages',
        workspaceId: workspaceId
      });
    }, 500);  // 500ms delay

    // Add a longer delay for renders and plans to ensure they come after workspace and messages
    setTimeout(() => {
      console.log(`Now fetching renders and plans after delay for ${workspaceId}`);
      // Also fetch renders and plans
      vscode.postMessage({
        command: 'fetchRenders',
        workspaceId: workspaceId
      });

      // Fetch plans 
      vscode.postMessage({
        command: 'fetchPlans',
        workspaceId: workspaceId
      });
    }, 1000);  // 1000ms delay
  } else {
    // No workspace selected, show the action buttons
    const contentContainer = document.querySelector('.content');
    if (contentContainer) {
      contentContainer.innerHTML = `
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
      `;

      // Add event listeners for the buttons
      document.getElementById('create-chart-button')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'createChart' });
      });

      document.getElementById('upload-chart-button')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'uploadChart' });
      });

      document.getElementById('download-chart-button')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'downloadChart' });
      });
    }
  }
}

function renderLoginView(container: HTMLElement) {
  container.innerHTML = `
    <div class="login-container">
      <h2>ChartSmith</h2>
      <p>You need to log in to access ChartSmith features.</p>
      <button id="login-btn">Login</button>
    </div>
  `;

  document.getElementById('login-btn')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'login' });
  });
}


function updateConnectionStatus(status: string) {
  actions.setConnectionStatus(status);

  const statusEl = document.querySelector('.connection-status');
  if (statusEl) {
    statusEl.className = `connection-status ${status}`;
    statusEl.textContent = status;
  }
}

function addMessage(message: any) {
  console.log('Adding new message to store:', message);
  actions.addMessage(message);
  renderAllMessages();
}

function renderAllMessages() {
  const messages = store.get(messagesAtom);
  console.log('========= RENDER ALL MESSAGES ==========');
  console.log('Rendering messages from store:', messages);

  // Debug: Check renders state
  const renders = store.get(rendersAtom);
  console.log('Current renders in store:', renders);

  const messagesContainer = document.getElementById('messages-container');
  if (!messagesContainer) {
    console.error('Messages container not found in DOM, cannot render!');
    return;
  }

  console.log('Messages container found, proceeding with render');

  // Clear the container first
  messagesContainer.innerHTML = '';

  // Debug: log all message IDs and their responsePlanIds
  console.log("Messages with responsePlanId:");
  messages.forEach(m => {
    if (m.responsePlanId) {
      console.log(`Message ${m.id} has responsePlanId: ${m.responsePlanId}`);
    }
  });

  // Add messages in chronological order
  messages.forEach(message => {
    // First, add the user's message (prompt)
    if (message.prompt) {
      const userMessageEl = document.createElement('div');
      userMessageEl.className = 'message user-message';
      userMessageEl.innerHTML = `
        <div class="message-content">${message.prompt}</div>
      `;
      messagesContainer.appendChild(userMessageEl);
    }

    // Then, add the agent's response if it exists
    if (message.response) {
      const agentMessageEl = document.createElement('div');
      agentMessageEl.className = 'message agent-message';

      // Render agent message as Markdown
      try {
        // Configure marked options to handle code blocks properly
        marked.setOptions({
          breaks: true,       // Add line breaks on single line breaks
          gfm: true           // Enable GitHub Flavored Markdown
        });

        // Render markdown and put in content div
        agentMessageEl.innerHTML = `
          <div class="message-content markdown-content">${marked.parse(message.response)}</div>
        `;
      } catch (error) {
        // Fallback to plain text if markdown parsing fails
        console.error('Error parsing markdown:', error);
        agentMessageEl.innerHTML = `
          <div class="message-content">${escapeHtml(message.response)}</div>
        `;
      }

      messagesContainer.appendChild(agentMessageEl);
    }

    // If there's a responsePlanId, show the plan
    if (message.responsePlanId) {
      // Log that we're processing a message with a plan
      console.log(`Processing message ${message.id} with responsePlanId: ${message.responsePlanId}`);

      // Find the matching plan in the store
      const plans = store.get(plansAtom);
      const planId = message.responsePlanId;
      console.log(`Looking for plan ID ${planId} among ${plans.length} plans`);

      // Create the container elements directly - avoid innerHTML for better TypeScript support
      // Create a div that looks like an agent message
      const planEl = document.createElement('div');
      planEl.className = 'message agent-message plan-message';
      planEl.style.cssText = 'margin: 10px 0; display: block; align-self: flex-start; background-color: var(--vscode-editor-inactiveSelectionBackground); border-bottom-left-radius: 4px; max-width: 90%;';

      // Create content container - no special header needed
      const planContainer = document.createElement('div');
      planContainer.style.cssText = 'border-radius: 12px; margin: 0;';
      planEl.appendChild(planContainer);

      // Try to find matching plan
      const matchingPlan = plans.find(plan => plan.id === planId) as any;

      // Add plan content based on whether we found the plan
      if (matchingPlan) {
        console.log('Found matching plan:', matchingPlan);
        console.log(`Rendering plan: ${matchingPlan.id}, Status: ${matchingPlan.status}, Approved: ${matchingPlan.approved}, Applied: ${matchingPlan.applied}`);
        console.log(`FULL PLAN OBJECT DUMP:`, JSON.stringify(matchingPlan, null, 2));
        
        const planContentDiv = document.createElement('div');
        planContentDiv.className = 'message-content markdown-content';
        planContentDiv.style.cssText = 'position: relative; min-height: 50px;';

        // Add the plan description
        try {
          // Convert markdown to HTML
          const parsedContent = marked.parse(matchingPlan.description || 'No description available');
          
          // If it's a string (not a Promise), set the innerHTML
          if (typeof parsedContent === 'string') {
            planContentDiv.innerHTML = parsedContent;
          } else {
            // If it's a Promise (shouldn't happen with marked), handle it
            planContentDiv.textContent = matchingPlan.description || 'No description available';
          }
        } catch (error) {
          console.error('Error parsing plan markdown:', error);
          planContentDiv.textContent = matchingPlan.description || 'No description available';
        }
        
        // Append the content div to the plan container
        planContainer.appendChild(planContentDiv);

        // Create proceed button - we'll decide later if we add it
        const proceedButton = document.createElement('button');
        proceedButton.className = 'plan-proceed-button';
        proceedButton.textContent = 'Proceed';
        proceedButton.setAttribute('data-plan-id', matchingPlan.id);
        proceedButton.style.cssText = `
          margin-top: 12px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          padding: 4px 10px;
          font-size: 11px;
          border-radius: 4px;
          cursor: pointer;
          border: none;
          align-self: flex-end;
          display: block;
          margin-left: auto;
        `;

        // First check if we should show the proceed button based on plan status
        const shouldShowButton = 
          (!matchingPlan.approved && !matchingPlan.applied) && 
          (matchingPlan.status !== 'approved' && matchingPlan.status !== 'applied');
        
        // Always check if a plan is in review state and needs the button, regardless of action files
        if (matchingPlan.status === 'review' && shouldShowButton) {
          console.log(`SHOWING PROCEED BUTTON for plan ${matchingPlan.id} (review status)`);
          console.log(`Button visibility check passed:
            - !approved = ${!matchingPlan.approved} (approved=${matchingPlan.approved})
            - !applied = ${!matchingPlan.applied} (applied=${matchingPlan.applied})
            - status = ${matchingPlan.status}`);
          
          planContainer.appendChild(proceedButton);
          
          // Add event listener to the proceed button
          proceedButton.addEventListener('click', () => {
            // Disable the button and update text
            proceedButton.disabled = true;
            proceedButton.textContent = 'Processing...';
            
            // Send message to extension to proceed with plan
            vscode.postMessage({
              command: 'proceedWithPlan',
              planId: matchingPlan.id,
              workspaceId: store.get(workspaceIdAtom)
            });
          });
        } else if (matchingPlan.status !== 'review') {
          console.log(`Not showing proceed button for plan ${matchingPlan.id}: status is not 'review' (status=${matchingPlan.status})`);
        }

        // Add action files list if present
        if (matchingPlan.actionFiles && matchingPlan.actionFiles.length > 0) {
          console.log('Plan has action files:', matchingPlan.actionFiles);

          // Filter out pending files - only show updating, creating, updated, created
          const relevantFiles = matchingPlan.actionFiles.filter((file: any) =>
            file.status === 'updating' ||
            file.status === 'creating' ||
            file.status === 'updated' ||
            file.status === 'created'
          );

          if (relevantFiles.length > 0) {
            const fileCount = relevantFiles.length;

            // Create action files container
            const actionFilesContainer = document.createElement('div');
            actionFilesContainer.style.cssText = 'margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--vscode-panel-border); font-family: var(--vscode-editor-font-family); font-size: 11px;';

            // Create heading
            const actionFilesHeading = document.createElement('div');
            actionFilesHeading.textContent = `${fileCount} ${fileCount === 1 ? 'file' : 'files'} to apply`;
            actionFilesHeading.style.cssText = 'font-weight: bold; margin-bottom: 12px;';
            actionFilesContainer.appendChild(actionFilesHeading);

            // File list container - using grid for better layout
            const fileList = document.createElement('div');
            fileList.style.cssText = `
              display: grid;
              grid-gap: 10px;
              width: 100%;
            `;

            // Add each file as a separate card/box
            relevantFiles.forEach((file: any) => {
              // Create file card
              const fileCard = document.createElement('div');
              fileCard.style.cssText = `
                display: flex;
                flex-direction: column;
                background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(100, 100, 100, 0.1));
                border: 1px solid var(--vscode-panel-border, rgba(120, 120, 120, 0.2));
                border-radius: 6px;
                padding: 10px;
                position: relative;
              `;
              fileCard.setAttribute('data-file-path', file.path);

              // Create file header with icon and name
              const fileHeader = document.createElement('div');
              fileHeader.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px; font-family: monospace; font-size: 12px;';

              // Create icon based on status and action type
              const fileIcon = document.createElement('span');

              // First, check the status to determine if we should show a spinner or checkmark
              if (file.status === 'creating' || file.status === 'updating') {
                // Spinner for in-progress status
                fileIcon.innerHTML = `
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; min-width: 14px;" class="spin-animation">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                  <style>
                    .spin-animation {
                      animation: spin 2s linear infinite;
                    }
                    @keyframes spin {
                      to { transform: rotate(360deg); }
                    }
                  </style>
                `;
              } else if (file.status === 'created' || file.status === 'updated') {
                // Green checkmark for completed status
                fileIcon.innerHTML = `
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; min-width: 14px;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                `;
              } else {
                // For all other cases, show action-based icons
                if (file.action === 'update') {
                  // Edit icon
                  fileIcon.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; min-width: 14px;">
                      <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path>
                      <polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon>
                    </svg>
                  `;
                }
              }
              
              fileHeader.appendChild(fileIcon);
              
              // File name 
              const fileName = document.createElement('span');
              fileName.textContent = file.path || 'Unknown file';
              fileName.style.cssText = 'font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
              fileHeader.appendChild(fileName);
              
              fileCard.appendChild(fileHeader);
              
              // Add to file list
              fileList.appendChild(fileCard);
            });
            
            // Add the file list to the container
            actionFilesContainer.appendChild(fileList);
            
            // Add container to plan
            planContainer.appendChild(actionFilesContainer);
          }
        } else if (!matchingPlan.actionFiles || matchingPlan.actionFiles.length === 0) {
          console.log(`Plan ${matchingPlan.id} has no action files or empty action files array`);
          
          // Check if we should force show the button as a fallback
          if (shouldShowButton) {
            // TEMPORARY FIX: Force show the button if the plan has no action files but status seems valid
            if (matchingPlan.status !== 'approved' && matchingPlan.status !== 'applied' && 
                matchingPlan.approved !== true && matchingPlan.applied !== true) {
              console.log(`FORCING PROCEED BUTTON TO SHOW for plan with no action files: ${matchingPlan.id}`);
              
              // Only add if we haven't already added the button above
              if (matchingPlan.status !== 'review') {
                planContainer.appendChild(proceedButton);
                
                // Add event listener to the proceed button
                proceedButton.addEventListener('click', () => {
                  // Disable the button and update text
                  proceedButton.disabled = true;
                  proceedButton.textContent = 'Processing...';
                  
                  // Send message to extension to proceed with plan
                  vscode.postMessage({
                    command: 'proceedWithPlan',
                    planId: matchingPlan.id,
                    workspaceId: store.get(workspaceIdAtom)
                  });
                });
              }
            }
          }
        }
      } else {
        // Plan not found - show a message
        planContainer.innerHTML = `<div style="padding: 12px;">Plan information not available.</div>`;
      }
      
      // Add the plan element to the message container
      messagesContainer.appendChild(planEl);
    }
    
    // Check for render data associated with this message
    if (message.id && renders.length > 0) {
      // Try to find a matching render - using a more generic match
      const matchingRender = renders.find((r: any) => r.messageId === message.id) as any;
      
      if (matchingRender) {
        console.log(`Found matching render for message ${message.id}:`, matchingRender);
        
        // Create a container for the render info
        const renderIndicatorEl = document.createElement('div');
        renderIndicatorEl.className = 'message render-indicator';
        // Do not set any inline styles that would override the CSS
        console.log('Render indicator element created:', renderIndicatorEl);
        
        // Create terminal window
        const terminalWindow = document.createElement('div');
        terminalWindow.className = 'terminal-window';
        
        // Create terminal header with buttons and title
        const terminalHeader = document.createElement('div');
        terminalHeader.className = 'terminal-header';
        terminalHeader.innerHTML = `
          <div class="terminal-buttons">
            <span class="terminal-button close"></span>
            <span class="terminal-button minimize"></span>
            <span class="terminal-button maximize"></span>
          </div>
          <div class="terminal-title">Terminal Output</div>
        `;
        
        // Create terminal content
        const terminalContent = document.createElement('div');
        terminalContent.className = 'terminal-content';
        
        // Format terminal content based on render data
        let terminalOutput = '';
        
        // Add command if present
        if (matchingRender.cmd) {
          terminalOutput += `<span class="terminal-prompt">$</span><span class="terminal-command">${escapeHtml(matchingRender.cmd)}</span>\n`;
        }
        
        // Add standard output if present
        if (matchingRender.stdout) {
          terminalOutput += `<span class="terminal-stdout">${escapeHtml(matchingRender.stdout)}</span>`;
        }
        
        // Add error output if present
        if (matchingRender.stderr) {
          terminalOutput += `<span class="terminal-stderr">${escapeHtml(matchingRender.stderr)}</span>`;
        }
        
        terminalContent.innerHTML = terminalOutput;
        
        // Assemble terminal elements
        terminalWindow.appendChild(terminalHeader);
        terminalWindow.appendChild(terminalContent);
        renderIndicatorEl.appendChild(terminalWindow);
        
        // Add to messages container
        messagesContainer.appendChild(renderIndicatorEl);
        console.log('Render indicator element added to DOM');
      }
    }
  });
}