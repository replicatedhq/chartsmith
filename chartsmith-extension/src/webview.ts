// This file contains the client-side code for the webview
// It will be bundled into dist/webview.js

// Define global interfaces
interface Window {
  vscodeWebviewContext: any;
  acquireVsCodeApi(): any;
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

  // Set up message listeners
  window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.command) {
      case 'debug':
        // Log debug messages directly to console
        console.log('DEBUG FROM EXTENSION:', message.message);
        break;
      case 'connectionStatus':
        updateConnectionStatus(message.status);
        break;
      case 'newMessage':
        addMessage(message.message);
        break;
      case 'messages':
        console.log('Received messages from extension:', message.messages);
        displayMessages(message.messages || []);
        break;
      case 'workspaceChanged':
        // Update the context and fetch messages for the new workspace
        console.log(`Workspace changed event received - new ID: ${message.workspaceId}`);
        context.workspaceId = message.workspaceId;
        console.log(`Fetching messages for changed workspace ID: ${message.workspaceId}`);
        vscode.postMessage({ 
          command: 'fetchMessages',
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
        <div class="header-actions">
          ${context.workspaceId ? `
            <button id="home-btn" class="icon-button" title="Home">🏠</button>
            <div class="connection-status ${context.connectionStatus}">
              ${context.connectionStatus}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="content">
        <div id="messages-container"></div>
        <div id="renders-container"></div>
      </div>
      <div class="footer">
        <button id="logout-btn">Logout</button>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'logout' });
  });
  
  // Add home button event listener
  document.getElementById('home-btn')?.addEventListener('click', () => {
    // Clear workspace ID in context and switch to action buttons
    context.workspaceId = '';
    vscode.postMessage({ command: 'goHome' });
    renderLoggedInView(container);
  });
  
  // Only fetch messages if we have a workspace ID
  if (context.workspaceId) {
    // Show messages for the selected workspace
    console.log(`Webview requesting messages for workspace ID: ${context.workspaceId}`);
    vscode.postMessage({ 
      command: 'fetchMessages',
      workspaceId: context.workspaceId
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
  const statusEl = document.querySelector('.connection-status');
  if (statusEl) {
    statusEl.className = `connection-status ${status}`;
    statusEl.textContent = status;
  }
}

function addMessage(message: any) {
  const messagesContainer = document.getElementById('messages-container');
  if (!messagesContainer) return;

  console.log('Adding new message:', message);

  // If it's a user message (prompt)
  if (message.prompt) {
    const userMessageEl = document.createElement('div');
    userMessageEl.className = 'message user-message';
    userMessageEl.innerHTML = `
      <div class="message-content">${message.prompt}</div>
    `;
    messagesContainer.appendChild(userMessageEl);
  }

  // If it has a response, add the agent's message
  if (message.response) {
    const agentMessageEl = document.createElement('div');
    agentMessageEl.className = 'message agent-message';
    agentMessageEl.innerHTML = `
      <div class="message-content">${message.response}</div>
    `;
    messagesContainer.appendChild(agentMessageEl);
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayMessages(messages: any[]) {
  console.log('Displaying messages:', messages);
  const messagesContainer = document.getElementById('messages-container');
  console.log('Messages container:', messagesContainer);
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
    }
  });
  
  // Scroll to the bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add more UI functionality as needed