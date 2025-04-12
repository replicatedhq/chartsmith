import * as vscode from 'vscode';
import * as path from 'path';
import { ConnectionStatus } from '../../types';

export function getHtmlForWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  context: {
    apiEndpoint?: string,
    pushEndpoint?: string,
    wwwEndpoint?: string,
    userId?: string,
    token?: string,
    connectionStatus: ConnectionStatus,
    workspaceId?: string
  }
): string {
  // Get the local path to main script
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
  );

  // Get the local path to css
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'styles.css')
  );

  // Use a nonce to whitelist which scripts can be run
  const nonce = getNonce();

  // Sanitize the context data for passing to the webview
  const contextJson = JSON.stringify({
    apiEndpoint: context.apiEndpoint || '',
    wwwEndpoint: context.wwwEndpoint || '',
    userId: context.userId || '',
    token: context.token || '',
    connectionStatus: context.connectionStatus,
    workspaceId: context.workspaceId || ''
  });

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
      <link href="${styleUri}" rel="stylesheet">
      <title>ChartSmith</title>
    </head>
    <body>
      <div id="app">
        <div class="loading">
          <h2>ChartSmith</h2>
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
      <script nonce="${nonce}">
        window.vscodeWebviewContext = ${contextJson};
      </script>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
  </html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}