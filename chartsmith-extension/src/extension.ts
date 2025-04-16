import * as vscode from 'vscode';
import { activate as activateLifecycle, deactivate as deactivateLifecycle } from './modules/lifecycle';
import { showFileDiff } from './modules/render';

export function activate(context: vscode.ExtensionContext) {
  // Register the showDiff command
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.showFileDiff', async () => {
      // Get the active file if any
      const activeEditor = vscode.window.activeTextEditor;
      let filePath = '';
      
      if (activeEditor) {
        filePath = activeEditor.document.uri.fsPath;
      } else {
        // Ask the user to select a file
        const fileUris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: 'Select File'
        });
        
        if (!fileUris || fileUris.length === 0) {
          vscode.window.showErrorMessage('No file selected.');
          return;
        }
        
        filePath = fileUris[0].fsPath;
      }
      
      // Prompt for the new content
      const newContent = await vscode.window.showInputBox({
        prompt: 'Enter the new content to show in the diff',
        placeHolder: 'New content...',
        value: ''
      });
      
      if (newContent === undefined) {
        vscode.window.showErrorMessage('No content provided.');
        return;
      }
      
      // Show the diff
      await showFileDiff(filePath, newContent, 'Custom Diff');
    })
  );
  
  // Activate the core lifecycle module
  return activateLifecycle(context);
}

export function deactivate() {
  return deactivateLifecycle();
}