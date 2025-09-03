/**
 * Main entry point for the custom diff functionality.
 * This module creates a webview for navigating diffs from a remote Chartsmith workspace.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getDiffWebviewContent } from './diffWebview';

// Track active diff webviews
const activeDiffPanels = new Map<string, vscode.WebviewPanel>();

// Keep track of file content for diff views
export interface DiffContent {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  workspaceId: string;
  workspaceName: string;
  title?: string;
  allFiles?: DiffFile[];
  currentFileIndex?: number;
}

export interface DiffFile {
  id: string;
  path: string;
  name: string;
  status: 'added' | 'modified' | 'removed';
  changes: number;
}

const diffContentRegistry = new Map<string, DiffContent>();

/**
 * Shows a diff between current content and new content using the custom diff viewer
 * @param filePath The path to the file being diffed
 * @param newContent The new content to compare
 * @param workspaceId The ID of the workspace this diff belongs to
 * @param workspaceName The name of the workspace this diff belongs to
 * @param allFiles Optional array of all files that have diffs
 * @param currentFileIndex Optional index of the current file in the allFiles array
 * @param title Optional title for the diff view
 * @returns Promise that resolves when the diff is shown
 */
export async function showCustomFileDiff(
  filePath: string,
  newContent: string,
  workspaceId: string,
  workspaceName: string,
  allFiles?: DiffFile[],
  currentFileIndex?: number,
  title?: string
): Promise<void> {
  try {
    console.log(`[customDiff] Showing diff for ${filePath} in workspace ${workspaceName}`);

    // Read current content or use empty string if file doesn't exist
    let currentContent = '';
    try {
      if (fs.existsSync(filePath)) {
        currentContent = await fs.promises.readFile(filePath, 'utf8');
      }
    } catch (error) {
      console.error(`Error reading file: ${error}`);
      // Continue with empty content
    }

    // Generate a unique ID for this diff session
    const diffId = `diff-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fileName = path.basename(filePath);

    // Create or show webview panel
    const panel = vscode.window.createWebviewPanel(
      'chartsmithDiff',  // Type
      `${fileName} - ${workspaceName}`, // Title with workspace name
      vscode.ViewColumn.Active, // Editor column
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(
            vscode.Uri.file(path.dirname(filePath)),
            '..',
            '..',
            'node_modules'
          )
        ]
      }
    );

    // Store the content for retrieval by the webview
    diffContentRegistry.set(diffId, {
      filePath,
      originalContent: currentContent,
      modifiedContent: newContent,
      workspaceId,
      workspaceName,
      title: title || `Changes to ${fileName}`,
      allFiles,
      currentFileIndex
    });

    // Set webview content
    panel.webview.html = getDiffWebviewContent(panel.webview, diffId);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'getDiffContent':
            const content = diffContentRegistry.get(message.diffId);
            if (content) {
              panel.webview.postMessage({
                command: 'diffContent',
                content
              });
            }
            break;
          case 'acceptChanges':
            handleAcceptChanges(message.diffId, message.filePath);
            break;
          case 'rejectChanges':
            handleRejectChanges(message.diffId, message.filePath);
            break;
          case 'acceptAllChanges':
            handleAcceptAllChanges(message.diffId);
            break;
          case 'rejectAllChanges':
            handleRejectAllChanges(message.diffId);
            break;
          case 'navigateToFile':
            navigateToFile(message.diffId, message.fileIndex);
            break;
        }
      },
      undefined,
      []
    );

    // Store the panel reference
    activeDiffPanels.set(diffId, panel);

    // Clean up when the panel is closed
    panel.onDidDispose(() => {
      activeDiffPanels.delete(diffId);
      diffContentRegistry.delete(diffId);
    });

    // Set keyboard focus to the webview
    panel.reveal(vscode.ViewColumn.Active);

  } catch (error) {
    console.error('Error creating custom diff view:', error);
    vscode.window.showErrorMessage(`Failed to show diff: ${error}`);
  }
}

/**
 * Handles accepting changes for a specific file
 * @param diffId The ID of the diff session
 * @param filePath The path of the file to accept changes for
 */
async function handleAcceptChanges(diffId: string, filePath?: string): Promise<void> {
  const content = diffContentRegistry.get(diffId);
  if (!content) {
    return;
  }

  const fileToAccept = filePath || content.filePath;

  try {
    // Write the modified content to the file
    await fs.promises.writeFile(fileToAccept, content.modifiedContent, 'utf8');
    
    // Show success message
    vscode.window.showInformationMessage(`Changes accepted for ${path.basename(fileToAccept)}`);
    
    // If we have more files to navigate to, switch to the next one
    if (content.allFiles && content.allFiles.length > 1 && content.currentFileIndex !== undefined) {
      const nextIndex = (content.currentFileIndex + 1) % content.allFiles.length;
      navigateToFile(diffId, nextIndex);
    } else {
      // Close the panel if this is the only file
      const panel = activeDiffPanels.get(diffId);
      if (panel) {
        panel.dispose();
      }
      
      // Clean up
      activeDiffPanels.delete(diffId);
      diffContentRegistry.delete(diffId);
    }
  } catch (error) {
    console.error('Error accepting changes:', error);
    vscode.window.showErrorMessage(`Failed to accept changes: ${error}`);
  }
}

/**
 * Handles rejecting changes for a specific file
 * @param diffId The ID of the diff session
 * @param filePath The path of the file to reject changes for
 */
async function handleRejectChanges(diffId: string, filePath?: string): Promise<void> {
  const content = diffContentRegistry.get(diffId);
  if (!content) {
    return;
  }

  const fileToReject = filePath || content.filePath;

  try {
    // Show rejection message
    vscode.window.showInformationMessage(`Changes rejected for ${path.basename(fileToReject)}`);
    
    // If we have more files to navigate to, switch to the next one
    if (content.allFiles && content.allFiles.length > 1 && content.currentFileIndex !== undefined) {
      const nextIndex = (content.currentFileIndex + 1) % content.allFiles.length;
      navigateToFile(diffId, nextIndex);
    } else {
      // Close the panel if this is the only file
      const panel = activeDiffPanels.get(diffId);
      if (panel) {
        panel.dispose();
      }
      
      // Clean up
      activeDiffPanels.delete(diffId);
      diffContentRegistry.delete(diffId);
    }
  } catch (error) {
    console.error('Error rejecting changes:', error);
    vscode.window.showErrorMessage(`Failed to reject changes: ${error}`);
  }
}

/**
 * Handles accepting all changes in the diff session
 * @param diffId The ID of the diff session
 */
async function handleAcceptAllChanges(diffId: string): Promise<void> {
  const content = diffContentRegistry.get(diffId);
  if (!content || !content.allFiles) {
    return;
  }

  try {
    // Here in a real implementation, you would write the modified content for all files
    // For this mockup, we'll just show a message
    vscode.window.showInformationMessage(`All changes accepted in workspace ${content.workspaceName}`);
    
    // Close the panel
    const panel = activeDiffPanels.get(diffId);
    if (panel) {
      panel.dispose();
    }
    
    // Clean up
    activeDiffPanels.delete(diffId);
    diffContentRegistry.delete(diffId);
  } catch (error) {
    console.error('Error accepting all changes:', error);
    vscode.window.showErrorMessage(`Failed to accept all changes: ${error}`);
  }
}

/**
 * Handles rejecting all changes in the diff session
 * @param diffId The ID of the diff session
 */
async function handleRejectAllChanges(diffId: string): Promise<void> {
  const content = diffContentRegistry.get(diffId);
  if (!content || !content.allFiles) {
    return;
  }

  try {
    // In a real implementation, you would reject changes for all files
    // For this mockup, we'll just show a message
    vscode.window.showInformationMessage(`All changes rejected in workspace ${content.workspaceName}`);
    
    // Close the panel
    const panel = activeDiffPanels.get(diffId);
    if (panel) {
      panel.dispose();
    }
    
    // Clean up
    activeDiffPanels.delete(diffId);
    diffContentRegistry.delete(diffId);
  } catch (error) {
    console.error('Error rejecting all changes:', error);
    vscode.window.showErrorMessage(`Failed to reject all changes: ${error}`);
  }
}

/**
 * Navigates to a specific file in the diff session
 * @param diffId The ID of the diff session
 * @param fileIndex The index of the file to navigate to
 */
async function navigateToFile(diffId: string, fileIndex: number): Promise<void> {
  const content = diffContentRegistry.get(diffId);
  if (!content || !content.allFiles || fileIndex >= content.allFiles.length) {
    return;
  }

  try {
    const targetFile = content.allFiles[fileIndex];
    
    // In a real implementation, you would load the content of the target file
    // For this mockup, we'll just update the current file index and notify the webview
    const updatedContent: DiffContent = {
      ...content,
      currentFileIndex: fileIndex,
      filePath: targetFile.path,
      title: `Changes to ${targetFile.name}`
    };
    
    diffContentRegistry.set(diffId, updatedContent);
    
    // Update the panel title
    const panel = activeDiffPanels.get(diffId);
    if (panel) {
      panel.title = `${targetFile.name} - ${content.workspaceName}`;
      
      // Notify the webview of the navigation
      panel.webview.postMessage({
        command: 'diffContent',
        content: updatedContent
      });
    }
  } catch (error) {
    console.error('Error navigating to file:', error);
    vscode.window.showErrorMessage(`Failed to navigate to file: ${error}`);
  }
}

/**
 * Registers commands for the custom diff functionality
 * @param context Extension context
 */
export function registerCustomDiffCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.showCustomFileDiff', async () => {
      // Create hard-coded sample Chart.yaml with version change
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
      
      // Use a sample workspace ID
      const workspaceId = "ws-23fdb97";
      const workspaceName = "My Chartsmith Workspace";
      
      // Sample path - using a hypothetical chart path
      const filePath = "/Chart.yaml";
      
      // Show the diff
      await showCustomFileDiff(
        filePath,
        modifiedContent,
        workspaceId,
        workspaceName,
        [{
          id: 'file-1',
          path: '/Chart.yaml',
          name: 'Chart.yaml',
          status: 'modified',
          changes: 1
        }],
        0,
        `Changes to Chart.yaml`
      );
    })
  );
}

// Make sure to export the module
export default {
  showCustomFileDiff,
  registerCustomDiffCommands
}; 