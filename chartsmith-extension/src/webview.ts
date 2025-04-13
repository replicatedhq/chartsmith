// This file contains the client-side code for the webview
// It will be bundled into dist/webview.js

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
      case 'renderMessages':
        console.log('Re-rendering all messages to update plans');
        renderAllMessages();
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

        // Also fetch renders and plans for the workspace
        vscode.postMessage({
          command: 'fetchRenders',
          workspaceId: message.workspaceId
        });

        // Fetch plans
        vscode.postMessage({
          command: 'fetchPlans',
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
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
      const url = `${context.wwwEndpoint}/workspace/${context.workspaceId}`;
      vscode.postMessage({
        command: 'openExternal',
        url
      });
    }
  });

  // Add message input handlers
  const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  const sendMessageBtn = document.getElementById('send-message-btn') as HTMLButtonElement;

  if (messageInput && sendMessageBtn) {
    // Disable send button if input is empty
    messageInput.addEventListener('input', () => {
      sendMessageBtn.disabled = !messageInput.value.trim();
    });

    // Initialize button state
    sendMessageBtn.disabled = true;

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

    // Clear input
    messageInput.value = '';

    // Reset button after delay (will be properly updated when message is confirmed)
    setTimeout(() => {
      sendBtn.innerHTML = originalContent;
      sendBtn.disabled = true;
    }, 1000);
  }

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
    console.log(`Initialized with workspaceId: ${context.workspaceId}`);
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
      planEl.style.cssText = 'position: relative; z-index: 1; margin: 10px 0; display: block; align-self: flex-start; background-color: var(--vscode-editor-inactiveSelectionBackground); border-bottom-left-radius: 4px; max-width: 90%;';

      // Create content container - no special header needed
      const planContainer = document.createElement('div');
      planContainer.style.cssText = 'border-radius: 12px; margin: 0;';
      planEl.appendChild(planContainer);

      // Try to find matching plan
      const matchingPlan = plans.find(plan => plan.id === planId);

      // Add plan content based on whether we found the plan
      if (matchingPlan) {
        console.log('Found matching plan:', matchingPlan);
        const planContentDiv = document.createElement('div');
        planContentDiv.className = 'message-content markdown-content';
        planContentDiv.style.cssText = 'position: relative; min-height: 50px;';

        // Add the plan description
        try {
          // Use marked synchronously - handle return type explicitly
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

        // Check if plan status is "review" and add a Proceed button
        if (matchingPlan.status && matchingPlan.status.toLowerCase() === 'review') {
          // Create a button container div
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = 'margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--vscode-panel-border); text-align: right;';

          // Create the Proceed button
          const proceedButton = document.createElement('button');
          proceedButton.textContent = 'Proceed';
          proceedButton.className = 'plan-proceed-button';
          proceedButton.style.cssText = `
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
          `;

          // Append button to container and container to plan
          buttonContainer.appendChild(proceedButton);
          planContentDiv.appendChild(buttonContainer);

          // Log that we added a proceed button
          console.log('Added Proceed button to plan with review status');
        }
      } else {
        console.log('No matching plan found for ID:', planId);

        // Create a content div for the "not found" message
        const notFoundDiv = document.createElement('div');
        notFoundDiv.className = 'message-content';
        notFoundDiv.style.cssText = 'position: relative; min-height: 30px;';
        notFoundDiv.textContent = `Plan data not loaded yet. Plan ID: ${planId}`;
        planContainer.appendChild(notFoundDiv);

        // Try to fetch plans if we have a workspace ID
        if (context.workspaceId) {
          console.log(`Fetching plans for workspace ${context.workspaceId}`);
          vscode.postMessage({
            command: 'fetchPlans',
            workspaceId: context.workspaceId
          });
        }
      }

      // Append the plan element to the messages container
      messagesContainer.appendChild(planEl);
      console.log(planEl);
      console.log('Plan element added to DOM');
    }

    // If there's a responseRenderId, check if we should show a terminal-like RENDER indicator
    if (message.responseRenderId) {
      // Make sure we have the workspace ID in the store
      const workspaceId = store.get(workspaceIdAtom);
      if (!workspaceId && context.workspaceId) {
        console.log('Setting missing workspaceId in store:', context.workspaceId);
        actions.setWorkspaceId(context.workspaceId);
      }

      // Find the matching render in the rendersAtom
      const renders = store.get(rendersAtom);
      console.log(`Looking for render ID ${message.responseRenderId} among ${renders.length} renders`);
      let matchingRender = renders.find(render => render.id === message.responseRenderId);

      // If render not found, try to fetch it
      if (!matchingRender && context.workspaceId) {
        console.log(`Render not found, fetching renders for workspace ${context.workspaceId}`);
        vscode.postMessage({
          command: 'fetchRenders',
          workspaceId: context.workspaceId
        });
      }

      // Skip auto-rendered items
      console.log(matchingRender);
      if (matchingRender && matchingRender.isAutorender === true) {
        console.log(`Skipping auto-rendered item: ${message.responseRenderId}`);
        // Don't render this indicator, but continue with the loop
      } else {

      // Create terminal container element
      const renderIndicatorEl = document.createElement('div');
      renderIndicatorEl.className = 'message render-indicator';
      renderIndicatorEl.style.cssText = 'position: relative; z-index: 5; display: block; width: 100%; min-height: 100px; margin: 15px 0; clear: both;';

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
      console.log(matchingRender);
      if (matchingRender && matchingRender.charts && matchingRender.charts.length > 0) {
        // Iterate through each chart
        matchingRender.charts.forEach((chart, index) => {
          // Add a blank line between chart sections if not the first one
          if (index > 0) {
            terminalHTML += `\n\n`;
          }

          // Add the command line for this chart
          const depUpdateCommand = chart.depUpdateCommand || '';
          const escapedCommand = depUpdateCommand ? escapeHtml(depUpdateCommand) : '';
          terminalHTML += `<span class="terminal-prompt">$</span>${escapedCommand ? ` <span class="terminal-command">${escapedCommand}</span>` : ''}`;

          // Add stdout if available
          if (chart.depUpdateStdout) {
            const escapedStdout = escapeHtml(chart.depUpdateStdout);
            terminalHTML += `\n<span class="terminal-stdout">${escapedStdout}</span>`;
          }

          // Add stderr if available
          if (chart.depUpdateStderr) {
            const escapedStderr = escapeHtml(chart.depUpdateStderr);
            terminalHTML += `\n<span class="terminal-stderr">${escapedStderr}</span>`;
          }
        });

        // Add cursor at the end
        terminalHTML += `\n<span class="terminal-prompt">$</span><span class="terminal-cursor"></span>`;
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

      console.log('Render indicator element created:', renderIndicatorEl);
      messagesContainer.appendChild(renderIndicatorEl);
      console.log('Render indicator element added to DOM');
      } // Close the else block
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

// Helper function to escape HTML content for safety
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Add more UI functionality as needed