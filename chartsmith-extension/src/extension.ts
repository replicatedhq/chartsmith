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
  
  // Register command to create mock diffs for testing
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.createMockDiffs', async () => {
      console.log('Creating mock diffs for testing');
      
      // Get workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Please open a workspace folder first.');
        return;
      }
      
      const baseFolder = workspaceFolders[0].uri.fsPath;
      const mockFiles = [
        {
          path: path.join(baseFolder, 'mock-test-1.yaml'),
          newContent: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: test-service\n  labels:\n    app: test\nspec:\n  selector:\n    app: test\n  ports:\n  - port: 80\n    targetPort: 8080\n    name: http'
        },
        {
          path: path.join(baseFolder, 'mock-test-2.yaml'),
          newContent: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: test-deployment\n  labels:\n    app: test\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: test\n  template:\n    metadata:\n      labels:\n        app: test\n    spec:\n      containers:\n      - name: test\n        image: nginx:1.21\n        resources:\n          limits:\n            cpu: 100m\n            memory: 128Mi'
        },
        {
          path: path.join(baseFolder, 'mock-test-3.json'),
          newContent: '{\n  "name": "test-config",\n  "version": "1.1.0",\n  "description": "Updated test configuration",\n  "author": "ChartSmith",\n  "settings": {\n    "enabled": true,\n    "timeout": 30\n  }\n}'
        }
      ];
      
      // Show diffs for each file
      let successCount = 0;
      let errorCount = 0;
      
      for (const mockFile of mockFiles) {
        try {
          // Check if the file exists
          if (!fs.existsSync(mockFile.path)) {
            vscode.window.showWarningMessage(`The file ${path.basename(mockFile.path)} doesn't exist. Run the "Test File Writing" command first to create test files.`);
            errorCount++;
            continue;
          }
          
          // Show the diff with new content
          await showFileDiff(mockFile.path, mockFile.newContent, `Mock Diff: ${path.basename(mockFile.path)}`);
          
          console.log(`Created mock diff for: ${mockFile.path}`);
          
          // Display registry status to help with debugging
          if (global.chartsmithDiffRegistry) {
            console.log(`Current diff registry contains ${global.chartsmithDiffRegistry.size} entries`);
            for (const [id, entry] of global.chartsmithDiffRegistry.entries()) {
              console.log(`  Diff ID: ${id} - File: ${path.basename(entry.filePath)}`);
            }
          }
          
          successCount++;
        } catch (error) {
          console.error(`Error creating mock diff for ${mockFile.path}:`, error);
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        vscode.window.showInformationMessage(
          `Created ${successCount} mock diffs for testing. Use Accept/Reject buttons to test functionality.`
        );
      } else if (errorCount > 0) {
        vscode.window.showErrorMessage(
          `Failed to create mock diffs. Make sure to run the "Test File Writing" command first to create the initial files.`
        );
      }
    })
  );
  
  // Register command to restore saved diffs
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.restoreDiffs', async () => {
      console.log('Manually restoring saved diffs');
      restoreDiffState(context);
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