// This file contains the client-side code for the webview
// It will be bundled into dist/webview.js

// Import state management
import { store, actions } from './state/store';
import { messagesAtom, workspaceIdAtom, connectionStatusAtom, rendersAtom } from './state/atoms';

// Define global interfaces
interface Window {
  vscodeWebviewContext: any;
  acquireVsCodeApi(): any;
  jotaiStore: any;
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

const context = (window as any).vscodeWebviewContext || {};

document.addEventListener('DOMContentLoaded', () => {
  initUI();
});

function initUI() {
  const app = document.getElementById('app');
  if (!app) return;

  if (context.token) {
    renderLoggedInView(app);
  } else {
    renderLoginView(app);
  }

  // Initialize the store with context values
  if (context.workspaceId) {
    actions.setWorkspaceId(context.workspaceId);
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
      case 'messages':
        console.log('Received messages from extension:', message.messages);
        actions.setMessages(message.messages || []);
        renderAllMessages(); // Re-render from store
        break;
      case 'renders':
        console.log('Received renders from extension:', message.renders);
        actions.setRenders(message.renders || []);
        // No UI rendering needed at this point, just store in atom
        break;
      case 'newRender':
        console.log('Received new render from extension:', message.render);
        actions.addRender(message.render);
        // No UI rendering needed at this point, just store in atom
        break;
      case 'workspaceChanged':
        // Update the context and fetch messages for the new workspace
        console.log(`Workspace changed event received - new ID: ${message.workspaceId}`);
        context.workspaceId = message.workspaceId;
        context.chartPath = message.chartPath || '';
        actions.setWorkspaceId(message.workspaceId);
        
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
        
        console.log(`Fetching messages for changed workspace ID: ${message.workspaceId}`);
        vscode.postMessage({ 
          command: 'fetchMessages',
          workspaceId: message.workspaceId
        });
        
        // Also fetch renders for the workspace
        vscode.postMessage({
          command: 'fetchRenders',
          workspaceId: message.workspaceId
        });
        break;
      // Add more message handlers here
    }
  });
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
        <button id="open-in-chartsmith" class="icon-button" title="Open in ChartSmith.ai">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </div>
      ` : ''}
      <div class="content">
        <div id="messages-container" class="full-width"></div>
        <div id="renders-container"></div>
      </div>
      <div class="footer">
        <div class="footer-left">
          ${context.workspaceId ? `
            <div class="connection-status ${context.connectionStatus}">
              ${context.connectionStatus}
            </div>
          ` : ''}
        </div>
        <div class="footer-right">
          ${context.workspaceId ? `<button id="disconnect-btn">Disconnect</button>` : ''}
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
      const url = `${context.wwwEndpoint}/workspace/${context.workspaceId}`;
      vscode.postMessage({ 
        command: 'openExternal', 
        url 
      });
    }
  });
  
  // Add disconnect button event listener
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
      
      // Re-render the view
      renderLoggedInView(container);
    });
    
    document.getElementById('cancel-disconnect')?.addEventListener('click', () => {
      // Just remove the confirmation dialog
      confirmationContainer.remove();
    });
  });
  
  // Initialize Jotai store from context
  if (context.workspaceId) {
    actions.setWorkspaceId(context.workspaceId);
  }
  
  // Only fetch messages if we have a workspace ID
  const workspaceId = store.get(workspaceIdAtom);
  if (workspaceId) {
    // Show messages for the selected workspace
    console.log(`Webview requesting messages for workspace ID: ${workspaceId}`);
    
    // Render any existing messages from the store
    renderAllMessages();
    
    // Then fetch fresh messages and renders from the server
    vscode.postMessage({ 
      command: 'fetchMessages',
      workspaceId: workspaceId
    });
    
    // Also fetch renders
    vscode.postMessage({
      command: 'fetchRenders',
      workspaceId: workspaceId
    });
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
  console.log('Rendering messages from store:', messages);
  const messagesContainer = document.getElementById('messages-container');
  if (!messagesContainer) return;
  
  // Clear the container first
  messagesContainer.innerHTML = '';
  
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
      agentMessageEl.innerHTML = `
        <div class="message-content">${message.response}</div>
      `;
      messagesContainer.appendChild(agentMessageEl);
      
      // If there's a responseRenderId, show a terminal-like RENDER indicator
      if (message.responseRenderId) {
        // Find the matching render in the rendersAtom
        const renders = store.get(rendersAtom);
        const matchingRender = renders.find(render => render.id === message.responseRenderId);
        
        // Create terminal container element
        const renderIndicatorEl = document.createElement('div');
        renderIndicatorEl.className = 'message render-indicator';
        
        // Start building terminal HTML
        let terminalHTML = `
          <div class="terminal-window">
            <div class="terminal-header">
              <div class="terminal-buttons">
                <span class="terminal-button close"></span>
                <span class="terminal-button minimize"></span>
                <span class="terminal-button maximize"></span>
              </div>
              <span class="terminal-title">Render Output</span>
            </div>
            <div class="terminal-content">`;
        
        // Check if the render has charts
        if (matchingRender && matchingRender.charts && matchingRender.charts.length > 0) {
          // Iterate through each chart
          matchingRender.charts.forEach((chart, index) => {
            // Add a blank line between commands if not the first one
            if (index > 0) {
              terminalHTML += `\n`;
            }
            
            // Add the command line for this chart
            const depUpdateCommand = chart.depUpdateCommand || '';
            terminalHTML += `<span class="terminal-prompt">$</span>${depUpdateCommand ? ` <span class="terminal-command">${depUpdateCommand}</span>` : ''}`;
          });
          
          // Add cursor at the end of the last command
          terminalHTML += `<span class="terminal-cursor"></span>`;
        } else {
          // No charts found, just show a prompt
          terminalHTML += `<span class="terminal-prompt">$</span><span class="terminal-cursor"></span>`;
        }
        
        // Close the terminal HTML
        terminalHTML += `
            </div>
          </div>
        `;
        
        renderIndicatorEl.innerHTML = terminalHTML;
        messagesContainer.appendChild(renderIndicatorEl);
      }
    }
  });
  
  // Scroll to the bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Keep for backward compatibility, but use store-based rendering
function displayMessages(messages: any[]) {
  actions.setMessages(messages);
  renderAllMessages();
}

// Add more UI functionality as needed