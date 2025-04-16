import { AuthData } from '../../types';
import { fetchApi } from '../api';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { chartsmithContentMap } from '../webSocket';

export async function fetchWorkspaceRenders(
  authData: AuthData,
  workspaceId: string
): Promise<any[]> {
  try {
    const response = await fetchApi(
      authData,
      `v1/workspaces/${workspaceId}/renders`,
      'GET'
    );
    
    return response.renders || [];
  } catch (error) {
    console.error('Error fetching workspace renders:', error);
    return [];
  }
}

export async function requestWorkspaceRender(
  authData: AuthData,
  workspaceId: string,
  params: any = {}
): Promise<any> {
  try {
    return await fetchApi(
      authData,
      `v1/workspaces/${workspaceId}/renders`,
      'POST',
      params
    );
  } catch (error) {
    console.error('Error requesting workspace render:', error);
    throw error;
  }
}

export async function getRenderDetails(
  authData: AuthData,
  workspaceId: string,
  renderId: string
): Promise<any> {
  try {
    return await fetchApi(
      authData,
      `v1/workspaces/${workspaceId}/renders/${renderId}`,
      'GET'
    );
  } catch (error) {
    console.error('Error fetching render details:', error);
    throw error;
  }
}

/**
 * Shows a diff between the current content of a file and new content
 * @param filePath The absolute path to the file to diff
 * @param newContent The new content to show in the diff
 * @param title Optional title for the diff view
 * @returns A promise that resolves when the diff is shown
 */
export async function showFileDiff(
  filePath: string,
  newContent: string,
  title?: string
): Promise<{ applied: boolean }> {
  const outputChannel = vscode.window.createOutputChannel('ChartSmith Diff');
  outputChannel.appendLine(`Showing diff for file: ${filePath}`);

  try {
    // Ensure directory exists if the file doesn't exist yet
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    // Read current content or use empty string if file doesn't exist
    let currentContent = '';
    try {
      if (fs.existsSync(filePath)) {
        currentContent = await fs.promises.readFile(filePath, 'utf8');
      }
    } catch (error) {
      outputChannel.appendLine(`Error reading file: ${error}`);
    }

    // Create custom URIs for the diff view
    const fileName = path.basename(filePath);
    const oldUri = vscode.Uri.parse(`chartsmith-diff:${fileName}`);
    const newUri = vscode.Uri.parse(`chartsmith-diff:${fileName}-new`);

    // Store content in the map
    chartsmithContentMap.clear(); // Clear any previous entries
    chartsmithContentMap.set(oldUri.toString(), currentContent);
    chartsmithContentMap.set(newUri.toString(), newContent);

    // Register the provider
    const provider = new class implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        return chartsmithContentMap.get(uri.toString()) || '';
      }
    };

    // Register the provider
    const registration = vscode.workspace.registerTextDocumentContentProvider('chartsmith-diff', provider);

    // Pre-load documents to ensure VS Code activates them
    try {
      await vscode.workspace.openTextDocument(oldUri);
      await vscode.workspace.openTextDocument(newUri);
    } catch (preloadError) {
      outputChannel.appendLine(`Error pre-loading documents: ${preloadError}`);
    }

    // Show the diff view
    await vscode.commands.executeCommand(
      'vscode.diff',
      oldUri,
      newUri,
      title || `Changes to ${fileName}`,
      { preview: false }
    );
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');

    // Show notification with options to apply or discard changes
    const applyChanges = 'Apply Changes';
    const discardChanges = 'Keep Original';

    return new Promise((resolve) => {
      vscode.window.showInformationMessage(
        `Review changes for ${fileName}. Apply them or keep the original?`,
        applyChanges,
        discardChanges
      ).then(async selection => {
        if (selection === applyChanges) {
          // Apply the new content to the file
          try {
            await fs.promises.writeFile(filePath, newContent);
            outputChannel.appendLine(`Applied new content to file: ${filePath}`);
            vscode.window.showInformationMessage(`Applied changes to ${fileName}`);

            // Close the diff view and open the updated file
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            await vscode.window.showTextDocument(vscode.Uri.file(filePath));
            resolve({ applied: true });
          } catch (error) {
            outputChannel.appendLine(`Error applying changes: ${error}`);
            vscode.window.showErrorMessage(`Failed to apply changes: ${error}`);
            resolve({ applied: false });
          }
        } else {
          // Just close the diff view
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          vscode.window.showInformationMessage(`Kept original content for ${fileName}`);
          resolve({ applied: false });
        }

        // Dispose the provider registration
        registration.dispose();
      });
    });
  } catch (error) {
    outputChannel.appendLine(`ERROR showing diff: ${error}`);
    vscode.window.showErrorMessage(`Error showing diff: ${error}`);
    return { applied: false };
  }
}