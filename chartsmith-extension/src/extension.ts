import * as vscode from 'vscode';
import { activate as activateLifecycle, deactivate as deactivateLifecycle } from './modules/lifecycle';
import { showFileDiff, saveDiffState, restoreDiffState, setExtensionContext, updateDiffButtonsVisibility, forceRefreshDiffButtons } from './modules/render';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  // Set extension context in render module
  setExtensionContext(context);
  
  // Register command to manually refresh diff buttons visibility
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.refreshDiffButtons', () => {
      console.log('Manually refreshing diff buttons visibility');
      forceRefreshDiffButtons();
      
      // Force another refresh after a short delay in case of race conditions
      setTimeout(() => {
        forceRefreshDiffButtons();
      }, 200);
      
      vscode.window.showInformationMessage('Diff buttons visibility refreshed');
    })
  );
  
  // Make sure we have context variables set for diff buttons
  vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', false);
  
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
  
  // Listen for window state changes to save diff state
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((e) => {
      if (!e.focused) {
        // Window is losing focus, save current diff state
        console.log('Window losing focus, saving diff state');
        saveDiffState(context);
      }
    })
  );
  
  // Save diff state when extension is about to be deactivated
  context.subscriptions.push({
    dispose: () => {
      console.log('Extension being deactivated, saving diff state');
      saveDiffState(context);
    }
  });
  
  // Try to restore any previously saved diffs
  restoreDiffState(context);
  
  // Activate the core lifecycle module
  return activateLifecycle(context);
}

export function deactivate() {
  return deactivateLifecycle();
}