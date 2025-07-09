/**
 * Creates the HTML content for the Chartsmith diff webview
 */

import * as vscode from 'vscode';

// Define the interface locally to avoid circular imports
export interface DiffFile {
  id: string;
  path: string;
  name: string;
  status: 'added' | 'modified' | 'removed';
  changes: number;
}

/**
 * Generates the HTML content for the diff webview
 * @param webview The webview to create content for
 * @param diffId The unique ID for this diff session
 * @returns The HTML content for the webview
 */
export function getDiffWebviewContent(webview: vscode.Webview, diffId: string): string {
  // Sample chart content with version change
  const originalContent = 
`apiVersion: v2
name: my-helm-chart
description: A Helm chart for Kubernetes
type: application
version: 0.6.5
appVersion: "1.16.0"
dependencies:
  - name: common
    version: 1.0.0
    repository: https://charts.bitnami.com/bitnami`;

  const modifiedContent = 
`apiVersion: v2
name: my-helm-chart
description: A Helm chart for Kubernetes
type: application
version: 0.7.0
appVersion: "1.16.0"
dependencies:
  - name: common
    version: 1.0.0
    repository: https://charts.bitnami.com/bitnami`;

  // Create a basic HTML diff view without relying on Monaco
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chartsmith Diff</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #1e1e1e;
      color: #cccccc;
    }
    
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    
    /* Header */
    .header {
      background-color: #252526;
      color: #cccccc;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #3c3c3c;
    }
    
    .logo {
      display: flex;
      align-items: center;
      font-weight: 600;
      font-size: 16px;
    }
    
    .logo-icon {
      width: 20px;
      height: 20px;
      margin-right: 8px;
    }
    
    .workspace-info {
      font-size: 14px;
    }
    
    /* Main Content Layout */
    .content-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    /* File Navigator */
    .file-navigator {
      width: 220px;
      background-color: #252526;
      border-right: 1px solid #3c3c3c;
      overflow: auto;
      color: #cccccc;
      font-size: 13px;
    }
    
    .nav-header {
      padding: 10px 12px;
      font-size: 11px;
      text-transform: uppercase;
      color: #8c8c8c;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    
    .file-item {
      padding: 6px 12px;
      display: flex;
      align-items: center;
      cursor: pointer;
      user-select: none;
      border-left: 2px solid transparent;
    }
    
    .file-item.active {
      background-color: #37373d;
      border-left: 2px solid #003399;
    }
    
    .file-item:hover:not(.active) {
      background-color: #2a2d2e;
    }
    
    .file-icon {
      width: 16px;
      height: 16px;
      margin-right: 8px;
      opacity: 0.8;
    }
    
    /* Main Content */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    /* Toolbar */
    .toolbar {
      background-color: #1e1e1e;
      border-bottom: 1px solid #333;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .file-info {
      font-size: 14px;
      display: flex;
      align-items: center;
    }
    
    .file-path {
      margin-left: 8px;
      opacity: 0.7;
    }
    
    /* Actions section for buttons */
    .actions {
      display: flex;
      gap: 8px;
    }
    
    .btn {
      padding: 6px 12px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .btn-accept {
      background-color: #22c55e;
      color: white;
    }
    
    .btn-accept:hover {
      background-color: #16a34a;
    }
    
    .btn-reject {
      background-color: #ef4444;
      color: white;
    }
    
    .btn-reject:hover {
      background-color: #dc2626;
    }
    
    /* Diff View */
    .diff-container {
      flex: 1;
      overflow: auto;
      font-family: monospace;
      font-size: 13px;
      line-height: 1.5;
      padding: 16px 0;
    }
    
    .diff-line {
      display: flex;
      white-space: pre;
    }
    
    .line-number {
      width: 40px;
      text-align: right;
      padding-right: 16px;
      color: #888;
      user-select: none;
    }
    
    .line-content {
      flex: 1;
    }
    
    .line-removed {
      background-color: rgba(255, 0, 0, 0.2);
    }
    
    .line-added {
      background-color: rgba(0, 255, 0, 0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        </svg>
        Chartsmith Diff Viewer
      </div>
      <div class="workspace-info">My Chartsmith Workspace — platform-examples</div>
    </div>
    
    <!-- Main Content with File Navigator -->
    <div class="content-container">
      <!-- File Navigator -->
      <div class="file-navigator">
        <div class="nav-header">Files Changed</div>
        <div class="file-item active">
          <svg class="file-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13 14H3c-.6 0-1-.4-1-1V3c0-.6.4-1 1-1h5l2 2h3c.6 0 1 .4 1 1v8c0 .6-.4 1-1 1z"/>
          </svg>
          Chart.yaml
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="main-content">
        <!-- Toolbar -->
        <div class="toolbar">
          <div class="file-info">
            <span>Chart.yaml</span>
            <span class="file-path">/Chart.yaml</span>
          </div>
          <div class="actions">
            <button class="btn btn-accept" id="accept-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Accept
            </button>
            <button class="btn btn-reject" id="reject-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Reject
            </button>
          </div>
        </div>
        
        <!-- Diff View -->
        <div class="diff-container" id="diff-container">
          <!-- Line 1 -->
          <div class="diff-line">
            <div class="line-number">1</div>
            <div class="line-content">apiVersion: v2</div>
          </div>
          <!-- Line 2 -->
          <div class="diff-line">
            <div class="line-number">2</div>
            <div class="line-content">name: my-helm-chart</div>
          </div>
          <!-- Line 3 -->
          <div class="diff-line">
            <div class="line-number">3</div>
            <div class="line-content">description: A Helm chart for Kubernetes</div>
          </div>
          <!-- Line 4 -->
          <div class="diff-line">
            <div class="line-number">4</div>
            <div class="line-content">type: application</div>
          </div>
          <!-- Line 5 (removed) -->
          <div class="diff-line line-removed">
            <div class="line-number">5</div>
            <div class="line-content">version: 0.6.5</div>
          </div>
          <!-- Line 6 (added) -->
          <div class="diff-line line-added">
            <div class="line-number">6</div>
            <div class="line-content">version: 0.7.0</div>
          </div>
          <!-- Line 7 -->
          <div class="diff-line">
            <div class="line-number">7</div>
            <div class="line-content">appVersion: "1.16.0"</div>
          </div>
          <!-- Line 8 -->
          <div class="diff-line">
            <div class="line-number">8</div>
            <div class="line-content">dependencies:</div>
          </div>
          <!-- Line 9 -->
          <div class="diff-line">
            <div class="line-number">9</div>
            <div class="line-content">  - name: common</div>
          </div>
          <!-- Line 10 -->
          <div class="diff-line">
            <div class="line-number">10</div>
            <div class="line-content">    version: 1.0.0</div>
          </div>
          <!-- Line 11 -->
          <div class="diff-line">
            <div class="line-number">11</div>
            <div class="line-content">    repository: https://charts.bitnami.com/bitnami</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const diffId = "${diffId}";
      
      // Setup button event listeners
      document.getElementById('accept-btn').addEventListener('click', () => {
        vscode.postMessage({
          command: 'acceptChanges',
          diffId: diffId,
          filePath: 'Chart.yaml'
        });
      });
      
      document.getElementById('reject-btn').addEventListener('click', () => {
        vscode.postMessage({
          command: 'rejectChanges',
          diffId: diffId,
          filePath: 'Chart.yaml'
        });
      });
      
      // Request content from the extension
      vscode.postMessage({
        command: 'getDiffContent',
        diffId: diffId
      });
      
      // Listen for messages from the extension
      window.addEventListener('message', event => {
        const message = event.data;
        
        if (message.command === 'diffContent') {
          // Update workspace info if needed
          const content = message.content;
          const workspaceInfo = document.querySelector('.workspace-info');
          if (workspaceInfo && content.workspaceId && content.workspaceName) {
            workspaceInfo.textContent = content.workspaceName + " — " + content.workspaceId;
          }
        }
      });
    })();
  </script>
</body>
</html>`;
} 