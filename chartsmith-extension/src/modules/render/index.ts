import { AuthData } from '../../types';
import { fetchApi } from '../api';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { chartsmithContentMap } from '../webSocket';

// Define interface for diff registry entry
interface DiffRegistryEntry {
  filePath: string;
  oldUri: vscode.Uri;
  newUri: vscode.Uri;
  pendingContent: string;
}

// Extend global type definitions
declare global {
  var chartsmithDiffRegistry: Map<string, DiffRegistryEntry> | undefined;
  var activeDiffIds: Set<string> | undefined;
  var chartsmithDisposables: Map<string, vscode.Disposable[]> | undefined;
}

// Initialize global registry for tracking active diffs
if (!global.chartsmithDiffRegistry) {
  global.chartsmithDiffRegistry = new Map<string, DiffRegistryEntry>();
}

// Keep track of active diff editors
let activeDiffEditors: Map<string, vscode.TextEditor> = new Map();

// Keep track of command disposables
let acceptCommandDisposable: vscode.Disposable | null = null;
let rejectCommandDisposable: vscode.Disposable | null = null;

// Initialize shared command handlers with proper context
let extensionContext: vscode.ExtensionContext | undefined;

// Export a function to set the context from extension.ts during activation
export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
  setupSharedCommandHandlers(context);
}

/**
 * Helper function to get the active diff ID from the current editor
 */
function getActiveDiffId(): string | undefined {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    console.log('No active editor found when trying to get diff ID');
    return undefined;
  }

  if (activeEditor.document.uri.scheme !== 'chartsmith-diff') {
    console.log(`Active editor scheme is ${activeEditor.document.uri.scheme}, not a chartsmith diff`);
    return undefined;
  }
  
  const uriString = activeEditor.document.uri.toString();
  console.log(`Looking for diff ID in URI: ${uriString}`);
  
  // Find matching diff ID from registry
  for (const [id, diffInfo] of global.chartsmithDiffRegistry?.entries() || []) {
    console.log(`Checking diff ID ${id} against URI`);
    // Check both old and new URIs since either could be active
    if (uriString === diffInfo.oldUri.toString() || 
        uriString === diffInfo.newUri.toString() ||
        uriString.includes(id)) {
      console.log(`Found matching diff ID: ${id}`);
      return id;
    }
  }
  
  // If registry lookup fails, try to extract ID from URI path
  // The URI format is chartsmith-diff:ID/filename
  try {
    const pathParts = activeEditor.document.uri.path.split('/');
    if (pathParts.length >= 1) {
      const possibleId = pathParts[0];
      // Verify this ID exists in our registry
      if (global.chartsmithDiffRegistry?.has(possibleId)) {
        console.log(`Extracted diff ID from path: ${possibleId}`);
        return possibleId;
      }
    }
  } catch (error) {
    console.error(`Error extracting diff ID: ${error}`);
  }
  
  console.log('No matching diff ID found');
  return undefined;
}

/**
 * Updates the visibility of diff action buttons based on whether there are visible diff editors
 */
export function updateDiffButtonsVisibility() {
  // Get number of active diff editors
  let diffEditorCount = 0;
  if (global.chartsmithDiffRegistry) {
    diffEditorCount = global.chartsmithDiffRegistry.size;
  }

  // Check for visible diff editors
  const hasDiffEditors = vscode.window.visibleTextEditors.some(
    editor => editor.document.uri.scheme === 'chartsmith-diff'
  );

  // Log status for debugging
  console.log(`Updating diff buttons visibility. Registry size: ${diffEditorCount}, Has visible diff editors: ${hasDiffEditors}`);

  // Set global state based on both conditions
  // Show buttons if we have active diff registrations OR currently visible diff editors
  const shouldShowButtons = diffEditorCount > 0 || hasDiffEditors;
  console.log(`Should show diff buttons: ${shouldShowButtons}`);
  
  // Set the context variable - this controls button visibility in package.json
  vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', shouldShowButtons);
}

/**
 * Set up command handlers for accepting and rejecting changes in diff view
 */
function setupSharedCommandHandlers(context: vscode.ExtensionContext) {
  console.log('Setting up shared command handlers');
  
  // Add window state change listener to handle tab switching
  const windowStateChangeDisposable = vscode.window.onDidChangeWindowState((e) => {
    console.log('Window state changed, checking for diff editors');
    updateDiffButtonsVisibility();
  });
  
  // Also listen for visible editor changes which happens when switching tabs
  const visibleEditorsChangeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
    console.log(`Visible editors changed, now have ${editors.length} editors`);
    // Check if any are diff editors
    const diffEditors = editors.filter(e => e.document.uri.scheme === 'chartsmith-diff');
    console.log(`Found ${diffEditors.length} diff editors among visible editors`);
    
    // Always update visibility
    updateDiffButtonsVisibility();
    
    // Add a delayed update for reliability
    setTimeout(() => {
      updateDiffButtonsVisibility();
    }, 300);
  });
  
  // Add a specific handler for active text editor changes (tab switching)
  const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
    console.log(`Active editor changed to: ${editor ? editor.document.uri.toString() : 'none'}`);
    
    // When switching to a diff editor, immediately ensure buttons are visible
    if (editor && editor.document.uri.scheme === 'chartsmith-diff') {
      console.log('Switched to diff editor, ensuring buttons are visible');
      vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
      vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
    }
    
    // Always update visibility when active editor changes
    updateDiffButtonsVisibility();
    
    // Schedule another update after a delay to handle any race conditions
    setTimeout(() => {
      updateDiffButtonsVisibility();
    }, 250);
  });
  
  // Add these disposables to context
  context.subscriptions.push(windowStateChangeDisposable);
  context.subscriptions.push(visibleEditorsChangeDisposable);
  context.subscriptions.push(activeEditorChangeDisposable);
  
  // Register handlers for the new selected file commands
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.acceptSelectedFile', async () => {
      console.log('ACCEPT SELECTED FILE COMMAND TRIGGERED');
      
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.uri.scheme !== 'chartsmith-diff') {
        console.log('No active diff editor found');
        vscode.window.showErrorMessage('No active diff editor found');
        return;
      }
      
      // Extract the diff ID directly from the URI
      const uriString = activeEditor.document.uri.toString();
      console.log(`Active URI: ${uriString}`);
      
      // The URI should be in the format chartsmith-diff:DIFF_ID/filename
      const match = uriString.match(/chartsmith-diff:([^\/]+)/);
      if (match && match[1]) {
        const diffId = match[1];
        console.log(`Extracted diff ID: ${diffId}`);
        
        // Check if this diff ID exists in our registry
        if (global.chartsmithDiffRegistry?.has(diffId)) {
          console.log(`Found diff in registry: ${diffId}`);
          await acceptDiffChanges(diffId);
        } else {
          console.log(`Diff ID ${diffId} not found in registry`);
          vscode.window.showErrorMessage(`Diff ID ${diffId} not found in registry`);
        }
      } else {
        console.log(`Could not extract diff ID from URI: ${uriString}`);
        vscode.window.showErrorMessage('Could not identify the current diff');
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('chartsmith.rejectSelectedFile', async () => {
      console.log('REJECT SELECTED FILE COMMAND TRIGGERED');
      
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.uri.scheme !== 'chartsmith-diff') {
        console.log('No active diff editor found');
        vscode.window.showErrorMessage('No active diff editor found');
        return;
      }
      
      // Extract the diff ID directly from the URI
      const uriString = activeEditor.document.uri.toString();
      console.log(`Active URI: ${uriString}`);
      
      // The URI should be in the format chartsmith-diff:DIFF_ID/filename
      const match = uriString.match(/chartsmith-diff:([^\/]+)/);
      if (match && match[1]) {
        const diffId = match[1];
        console.log(`Extracted diff ID: ${diffId}`);
        
        // Check if this diff ID exists in our registry
        if (global.chartsmithDiffRegistry?.has(diffId)) {
          console.log(`Found diff in registry: ${diffId}`);
          await rejectDiffChanges(diffId);
        } else {
          console.log(`Diff ID ${diffId} not found in registry`);
          vscode.window.showErrorMessage(`Diff ID ${diffId} not found in registry`);
        }
      } else {
        console.log(`Could not extract diff ID from URI: ${uriString}`);
        vscode.window.showErrorMessage('Could not identify the current diff');
      }
    })
  );
  
  if (!acceptCommandDisposable) {
    console.log('Registering chartsmith.acceptChanges command');
    acceptCommandDisposable = vscode.commands.registerCommand('chartsmith.acceptChanges', async () => {
      console.log('ACCEPT COMMAND TRIGGERED');
      
      // Get the active editor - this is the key part
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        console.log('No active editor found');
        vscode.window.showErrorMessage('No active editor found');
        return;
      }

      // Check if it's a diff editor
      if (activeEditor.document.uri.scheme !== 'chartsmith-diff') {
        console.log(`Active editor is not a diff: ${activeEditor.document.uri.scheme}`);
        vscode.window.showErrorMessage('Not viewing a diff');
        return;
      }
      
      // Extract the diff ID directly from the URI - this is the most reliable approach
      const uriString = activeEditor.document.uri.toString();
      console.log(`Active diff URI: ${uriString}`);
      
      // The URI format is chartsmith-diff:ID/filename
      const match = uriString.match(/chartsmith-diff:([^\/]+)/);
      if (!match || !match[1]) {
        console.log(`Could not extract diff ID from URI: ${uriString}`);
        vscode.window.showErrorMessage('Could not identify the current diff');
        return;
      }
      
      const diffId = match[1];
      console.log(`Extracted diff ID from URI: ${diffId}`);
      
      // Check if this diff exists in our registry
      if (!global.chartsmithDiffRegistry?.has(diffId)) {
        console.log(`Diff ID ${diffId} not found in registry`);
        
        // If not in registry but URI is valid, we might have lost track of it
        // Try to re-register it if possible by looking for content in the content map
        const oldUri = vscode.Uri.parse(`chartsmith-diff:${diffId}/${path.basename(uriString)}`);
        const newUri = vscode.Uri.parse(`chartsmith-diff:${diffId}/${path.basename(uriString)}-new`);
        
        if (chartsmithContentMap.has(oldUri.toString()) && chartsmithContentMap.has(newUri.toString())) {
          console.log(`Found content for diff ${diffId}, recreating registry entry`);
          // We can recreate the registry entry
          
          // Ask for filepath and pending content
          const filepath = await vscode.window.showInputBox({
            prompt: 'Enter the file path to accept changes for',
            placeHolder: 'e.g. /path/to/file.yaml'
          });
          
          if (!filepath) {
            vscode.window.showErrorMessage('No file path provided');
            return;
          }
          
          const pendingContent = chartsmithContentMap.get(newUri.toString()) || '';
          
          // Recreate the registry entry
          global.chartsmithDiffRegistry?.set(diffId, {
            filePath: filepath,
            oldUri,
            newUri,
            pendingContent
          });
          
          console.log(`Recreated registry entry for diff ${diffId}`);
        } else {
          vscode.window.showErrorMessage(`Could not find information for diff ${diffId}`);
          return;
        }
      }
      
      // Now we can process the diff
      await acceptDiffChanges(diffId);
    });
  } else {
    console.log('Accept command disposable already exists');
  }

  if (!rejectCommandDisposable) {
    console.log('Registering chartsmith.rejectChanges command');
    rejectCommandDisposable = vscode.commands.registerCommand('chartsmith.rejectChanges', async () => {
      console.log('REJECT COMMAND TRIGGERED');
      
      // Get the active editor
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        console.log('No active editor found');
        vscode.window.showErrorMessage('No active editor found');
        return;
      }

      // Check if it's a diff editor
      if (activeEditor.document.uri.scheme !== 'chartsmith-diff') {
        console.log(`Active editor is not a diff: ${activeEditor.document.uri.scheme}`);
        vscode.window.showErrorMessage('Not viewing a diff');
        return;
      }
      
      // Extract the diff ID directly from the URI - this is the most reliable approach
      const uriString = activeEditor.document.uri.toString();
      console.log(`Active diff URI: ${uriString}`);
      
      // The URI format is chartsmith-diff:ID/filename
      const match = uriString.match(/chartsmith-diff:([^\/]+)/);
      if (!match || !match[1]) {
        console.log(`Could not extract diff ID from URI: ${uriString}`);
        vscode.window.showErrorMessage('Could not identify the current diff');
        return;
      }
      
      const diffId = match[1];
      console.log(`Extracted diff ID from URI: ${diffId}`);
      
      // Check if this diff exists in our registry
      if (!global.chartsmithDiffRegistry?.has(diffId)) {
        console.log(`Diff ID ${diffId} not found in registry`);
        
        // If not in registry but URI is valid, we might have lost track of it
        // Try to re-register it if possible by looking for content in the content map
        const oldUri = vscode.Uri.parse(`chartsmith-diff:${diffId}/${path.basename(uriString)}`);
        const newUri = vscode.Uri.parse(`chartsmith-diff:${diffId}/${path.basename(uriString)}-new`);
        
        if (chartsmithContentMap.has(oldUri.toString()) && chartsmithContentMap.has(newUri.toString())) {
          console.log(`Found content for diff ${diffId}, recreating registry entry`);
          // We can recreate the registry entry
          
          // Ask for filepath and pending content
          const filepath = await vscode.window.showInputBox({
            prompt: 'Enter the file path to reject changes for',
            placeHolder: 'e.g. /path/to/file.yaml'
          });
          
          if (!filepath) {
            vscode.window.showErrorMessage('No file path provided');
            return;
          }
          
          const pendingContent = chartsmithContentMap.get(newUri.toString()) || '';
          
          // Recreate the registry entry
          global.chartsmithDiffRegistry?.set(diffId, {
            filePath: filepath,
            oldUri,
            newUri,
            pendingContent
          });
          
          console.log(`Recreated registry entry for diff ${diffId}`);
        } else {
          vscode.window.showErrorMessage(`Could not find information for diff ${diffId}`);
          return;
        }

      }
      
      // Now we can process the diff
      await rejectDiffChanges(diffId);
    });
  }
  
  // Register handler for text editor focus changes - ensures buttons show for any diff editor
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    console.log('Active editor changed:', editor?.document.uri.toString());
    
    // Update button visibility regardless of which editor is active
    // This ensures buttons remain visible as long as there are diff editors open
    updateDiffButtonsVisibility();
  }, null, context.subscriptions);
  
  // Also track tab changes to maintain button visibility
  vscode.window.tabGroups.onDidChangeTabs((e) => {
    console.log(`Tab change detected (${e.changed.length} changed, ${e.closed.length} closed)`);
    
    // Short delay to ensure tab state is settled
    setTimeout(() => {
      updateDiffButtonsVisibility();
    }, 100);
  }, null, context.subscriptions);
  
  // Ensure global registry is checked periodically
  const statusCheckInterval = setInterval(() => {
    if (global.chartsmithDiffRegistry && global.chartsmithDiffRegistry.size > 0) {
      // If we have diffs in registry, ensure buttons are visible
      vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
    }
  }, 5000);
  
  // Clean up interval when extension is deactivated
  context.subscriptions.push({
    dispose: () => clearInterval(statusCheckInterval)
  });
}

/**
 * Closes all editor tabs associated with a specific diff ID
 * without affecting other diff tabs
 */
async function closeAllDiffEditors(diffId: string): Promise<void> {
  console.log(`Attempting to close editors for diff ID: ${diffId}`);
  
  // Get the diff info from registry
  const diffInfo = global.chartsmithDiffRegistry?.get(diffId);
  if (!diffInfo) {
    console.log(`No diff info found for ID: ${diffId}`);
    return;
  }
  
  // Store the URIs we need to clean up 
  const oldUri = diffInfo.oldUri;
  const newUri = diffInfo.newUri;
  
  try {
    // First attempt: Try to find and close the tabs directly using tab API
    const tabGroups = vscode.window.tabGroups;
    
    // Find all tabs containing our diff
    const diffTabs = tabGroups.all.flatMap(group => 
      group.tabs.filter(tab => {
        const input = tab.input as any;
        if (!input || !input.uri || typeof input.uri.toString !== 'function') {
          return false;
        }
        
        const uriString = input.uri.toString();
        // Very precise matching - either old or new URI for this specific diff
        return uriString === oldUri.toString() || uriString === newUri.toString();
      })
    );
    
    console.log(`Found ${diffTabs.length} tabs matching URIs for diff ID ${diffId}`);
    
    // Before closing tabs, let's dispose all registered handlers
    if (global.chartsmithDisposables?.has(diffId)) {
      console.log(`Disposing registered handlers for diff ${diffId}`);
      const disposables = global.chartsmithDisposables.get(diffId) || [];
      
      for (const disposable of disposables) {
        try {
          disposable.dispose();
        } catch (err) {
          console.error(`Error disposing handler: ${err}`);
        }
      }
      
      // Remove from registry
      global.chartsmithDisposables.delete(diffId);
    }
    
    // Clear content from provider cache BEFORE closing tabs
    // This is critical to prevent VS Code from re-opening the tabs
    chartsmithContentMap.delete(oldUri.toString());
    chartsmithContentMap.delete(newUri.toString());
    
    // Wait a moment for content clearing to take effect
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // If we found tabs, close them directly
    if (diffTabs.length > 0) {
      // Close all matching tabs at once
      await vscode.window.tabGroups.close(diffTabs);
      console.log(`Closed ${diffTabs.length} tabs using tabGroups API`);
      
      // Add a small delay to allow VS Code to process tab closing
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Second attempt: Try to close any remaining editors
    try {
      // First check if we have any editors still open for this diff
      const remainingEditors = vscode.window.visibleTextEditors.filter(editor => {
        const uriString = editor.document.uri.toString();
        return uriString === oldUri.toString() || uriString === newUri.toString();
      });
      
      if (remainingEditors.length > 0) {
        console.log(`Still have ${remainingEditors.length} editors open, trying to close them differently`);
        
        // For each editor, try to close it by focusing and using the close command
        for (const editor of remainingEditors) {
          try {
            await vscode.window.showTextDocument(editor.document);
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          } catch (err) {
            console.error(`Error closing editor: ${err}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error closing remaining editors: ${error}`);
    }
    
    // Final check for any remaining editors with this diff ID
    const finalCheck = vscode.window.visibleTextEditors.filter(editor => {
      const uriString = editor.document.uri.toString();
      return uriString.includes(diffId);
    });
    
    if (finalCheck.length > 0) {
      console.log(`Still have ${finalCheck.length} editors with diff ID ${diffId} after all attempts`);
    } else {
      console.log(`Successfully closed all editors for diff ID: ${diffId}`);
    }
  } catch (error) {
    console.error(`Error closing diff editors: ${error}`);
  }
}

// Helper function to accept changes for a specific diff
async function acceptDiffChanges(diffId: string): Promise<boolean> {
  const outputChannel = vscode.window.createOutputChannel('ChartSmith Diff Accept');
  
  try {
    // Get the diff info from our registry
    const diffInfo = global.chartsmithDiffRegistry?.get(diffId);
    if (!diffInfo) {
      vscode.window.showErrorMessage('Could not find diff information.');
      return false;
    }
    
    // Get the workspace ID
    let workspaceId = '';
    
    try {
      const workspace = await import('../workspace');
      workspaceId = await workspace.getActiveWorkspaceId() || '';
    } catch (error) {
      outputChannel.appendLine(`Error getting workspace ID: ${error}`);
    }
    
    // Check if we have a workspace ID
    if (!workspaceId) {
      vscode.window.showErrorMessage('Could not determine workspace ID. Please try again.');
      return false;
    }
    
    outputChannel.appendLine(`Using workspace ID: ${workspaceId}`);
    
    // Apply changes for this specific file
    const filePath = diffInfo.filePath;
    const pendingContent = diffInfo.pendingContent;
    
    if (!pendingContent) {
      vscode.window.showErrorMessage('Could not retrieve content to accept.');
      return false;
    }
    
    // Store the URIs we need to clean up from the content map
    const oldUriString = diffInfo.oldUri.toString();
    const newUriString = diffInfo.newUri.toString();
    
    // First, immediately hide diff action buttons to prevent them from flashing
    vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', false);
    vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', false);
    
    // Clear all content providers and event handlers first to prevent tab restoration
    if (global.chartsmithDisposables?.has(diffId)) {
      console.log(`Disposing registered handlers for diff ${diffId}`);
      const disposables = global.chartsmithDisposables.get(diffId) || [];
      for (const disposable of disposables) {
        try {
          disposable.dispose();
        } catch (err) {
          console.error(`Error disposing handler: ${err}`);
        }
      }
      global.chartsmithDisposables.delete(diffId);
    }
    
    // Clear content from provider cache to prevent restoration
    chartsmithContentMap.delete(oldUriString);
    chartsmithContentMap.delete(newUriString);
    
    // Clean up registry entries immediately
    global.chartsmithDiffRegistry?.delete(diffId);
    activeDiffEditors.delete(diffId);
    
    // Close all related diff editors using tab groups API
    try {
      const tabGroups = vscode.window.tabGroups;
      const diffTabs = tabGroups.all.flatMap(group => 
        group.tabs.filter(tab => {
          const input = tab.input as any;
          if (!input || !input.uri || typeof input.uri.toString !== 'function') {
            return false;
          }
          const uriString = input.uri.toString();
          return uriString.includes(diffId);
        })
      );
      
      if (diffTabs.length > 0) {
        await vscode.window.tabGroups.close(diffTabs);
        console.log(`Closed ${diffTabs.length} diff tabs`);
      }
    } catch (error) {
      console.error(`Error closing diff tabs: ${error}`);
    }
    
    // Now import necessary modules for file operations
    const lifecycle = await import('../lifecycle');
    
    // Apply the changes to the file
    await lifecycle.acceptFileChanges(filePath, workspaceId, pendingContent);
    outputChannel.appendLine(`Successfully applied changes for ${filePath}`);
    vscode.window.showInformationMessage(`Applied changes to ${path.basename(filePath)}`);
    
    // Now open the actual file to show the changes
    try {
      // Check if file exists on disk
      if (fs.existsSync(filePath)) {
        console.log(`Opening actual file: ${filePath}`);
        const fileUri = vscode.Uri.file(filePath);
        
        // Open the file in the editor
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document, { preview: false });
        
        // Focus the editor
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      } else {
        console.log(`File does not exist on disk: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error opening file after accepting changes: ${error}`);
    }
    
    // Update button visibility
    updateDiffButtonsVisibility();
    
    return true;
  } catch (error) {
    outputChannel.appendLine(`Error applying changes: ${error}`);
    vscode.window.showErrorMessage(`Error applying changes: ${error}`);
    return false;
  }
}

// Helper function to reject changes for a specific diff
async function rejectDiffChanges(diffId: string): Promise<boolean> {
  const outputChannel = vscode.window.createOutputChannel('ChartSmith Diff Reject');
  
  try {
    // Get the diff info from our registry
    const diffInfo = global.chartsmithDiffRegistry?.get(diffId);
    if (!diffInfo) {
      outputChannel.appendLine('Could not find diff information.');
      return false;
    }
    
    // Store the actual file path
    const filePath = diffInfo.filePath;
    
    // Store the URIs we need to clean up from the content map
    const oldUriString = diffInfo.oldUri.toString();
    const newUriString = diffInfo.newUri.toString();
    
    // First, immediately hide diff action buttons to prevent them from flashing
    vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', false);
    vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', false);
    
    // Clear all content providers and event handlers first to prevent tab restoration
    if (global.chartsmithDisposables?.has(diffId)) {
      console.log(`Disposing registered handlers for diff ${diffId}`);
      const disposables = global.chartsmithDisposables.get(diffId) || [];
      for (const disposable of disposables) {
        try {
          disposable.dispose();
        } catch (err) {
          console.error(`Error disposing handler: ${err}`);
        }
      }
      global.chartsmithDisposables.delete(diffId);
    }
    
    // Clear content from provider cache to prevent restoration
    chartsmithContentMap.delete(oldUriString);
    chartsmithContentMap.delete(newUriString);
    
    // Clean up registry entries immediately
    global.chartsmithDiffRegistry?.delete(diffId);
    activeDiffEditors.delete(diffId);
    
    // Close all related diff editors using tab groups API
    try {
      const tabGroups = vscode.window.tabGroups;
      const diffTabs = tabGroups.all.flatMap(group => 
        group.tabs.filter(tab => {
          const input = tab.input as any;
          if (!input || !input.uri || typeof input.uri.toString !== 'function') {
            return false;
          }
          const uriString = input.uri.toString();
          return uriString.includes(diffId);
        })
      );
      
      if (diffTabs.length > 0) {
        await vscode.window.tabGroups.close(diffTabs);
        console.log(`Closed ${diffTabs.length} diff tabs`);
      }
    } catch (error) {
      console.error(`Error closing diff tabs: ${error}`);
    }
    
    // Import necessary modules
    const lifecycle = await import('../lifecycle');
    const workspace = await import('../workspace');
    const workspaceId = await workspace.getActiveWorkspaceId() || '';
    
    if (workspaceId) {
      // Reject changes for this file
      await lifecycle.rejectFileChanges(diffInfo.filePath, workspaceId);
      outputChannel.appendLine(`Rejected changes for ${diffInfo.filePath}`);
      vscode.window.showInformationMessage(`Rejected changes to ${path.basename(diffInfo.filePath)}`);
    }
    
    // Now open the actual file to show the unchanged version
    try {
      // Check if file exists on disk
      if (fs.existsSync(filePath)) {
        console.log(`Opening actual file: ${filePath}`);
        const fileUri = vscode.Uri.file(filePath);
        
        // Open the file in the editor
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document, { preview: false });
        
        // Focus the editor
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      } else {
        console.log(`File does not exist on disk: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error opening file after rejecting changes: ${error}`);
    }
    
    // Update button visibility
    updateDiffButtonsVisibility();
    
    return true;
  } catch (error) {
    outputChannel.appendLine(`Error rejecting changes: ${error}`);
    vscode.window.showErrorMessage(`Error rejecting changes: ${error}`);
    return false;
  }
}

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
  console.log(`[showFileDiff] Starting diff creation for ${filePath}`);

  try {
    try {
      // Ensure directory exists if the file doesn't exist yet
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    } catch (error) {
      outputChannel.appendLine(`Error creating directory: ${error}`);
      // Continue anyway - the error might just be that the directory already exists
    }

    // Read current content or use empty string if file doesn't exist
    let currentContent = '';
    try {
      if (fs.existsSync(filePath)) {
        currentContent = await fs.promises.readFile(filePath, 'utf8');
        outputChannel.appendLine(`Read existing file (${currentContent.length} bytes)`);
      } else {
        outputChannel.appendLine('File does not exist, using empty string for current content');
      }
    } catch (error) {
      outputChannel.appendLine(`Error reading file: ${error}`);
      // Continue with empty content
    }

    // Create custom URIs for the diff view
    const fileName = path.basename(filePath);
    
    // Generate a unique ID for this diff session
    const diffId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const oldUri = vscode.Uri.parse(`chartsmith-diff:${diffId}/${fileName}`);
    const newUri = vscode.Uri.parse(`chartsmith-diff:${diffId}/${fileName}-new`);
    console.log(`[showFileDiff] Generated diff ID: ${diffId} for ${fileName}`);

    // Store content in the map
    chartsmithContentMap.set(oldUri.toString(), currentContent);
    chartsmithContentMap.set(newUri.toString(), newContent);
    
    // Store diff info in our registry
    global.chartsmithDiffRegistry?.set(diffId, {
      filePath,
      oldUri,
      newUri,
      pendingContent: newContent
    });
    console.log(`[showFileDiff] Stored diff in registry with ID: ${diffId}`);
    
    // Register the provider
    const provider = new class implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        return chartsmithContentMap.get(uri.toString()) || '';
      }
    };

    // Register the provider with a clear disposable
    const registration = vscode.workspace.registerTextDocumentContentProvider('chartsmith-diff', provider);
    
    // Create a collection of disposables for this diff that we can clean up later
    const diffDisposables: vscode.Disposable[] = [registration];

    // Pre-load documents to ensure VS Code activates them
    let oldDoc: vscode.TextDocument | undefined;
    let newDoc: vscode.TextDocument | undefined;
    
    try {
      oldDoc = await vscode.workspace.openTextDocument(oldUri);
      newDoc = await vscode.workspace.openTextDocument(newUri);
      console.log(`Pre-loaded documents for diff ${diffId}`);
    } catch (preloadError) {
      outputChannel.appendLine(`Error pre-loading documents: ${preloadError}`);
    }

    console.log(`[showFileDiff] About to show diff view for ${filePath} (ID: ${diffId})`);
    // Show the diff view
    await vscode.commands.executeCommand(
      'vscode.diff',
      oldUri,
      newUri,
      title || `Changes to ${fileName}`,
      { preview: false }
    );
    console.log(`[showFileDiff] Diff view command executed`);
    
    // Set up periodic visibility checks for the next few seconds
    // to ensure buttons remain visible even if the user switches tabs
    const maxAttempts = 10;
    let attempts = 0;
    const visibilityInterval = setInterval(() => {
      if (attempts >= maxAttempts) {
        clearInterval(visibilityInterval);
        return;
      }
      
      console.log(`[showFileDiff] Periodic visibility check ${attempts + 1}/${maxAttempts} for diff ${diffId}`);
      vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
      vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
      updateDiffButtonsVisibility();
      attempts++;
    }, 500);
    
    // Get active editor and store it in our registry
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.scheme === 'chartsmith-diff') {
      activeDiffEditors.set(diffId, editor);
      outputChannel.appendLine(`Stored active editor for diff ${diffId}`);
      console.log(`[showFileDiff] Stored active editor for diff ${diffId}: ${editor.document.uri.toString()}`);
    } else {
      console.log(`[showFileDiff] Active editor is not a diff: ${editor ? editor.document.uri.toString() : 'No editor'}`);
    }
    
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');

    // Enable accept/reject buttons whenever a diff is shown
    vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
    vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
    // Set the editor scheme context explicitly (in case VS Code doesn't do it automatically)
    vscode.commands.executeCommand('setContext', 'editorScheme', 'chartsmith-diff');
    console.log('Diff buttons enabled for new diff view - multiple context variables set');
    
    // Add a storage property on the extension to track active diff IDs
    if (!global.activeDiffIds) {
      global.activeDiffIds = new Set<string>();
    }
    global.activeDiffIds.add(diffId);
    console.log(`Added diff ID ${diffId} to global activeDiffIds set`);
    
    // Update all context variables
    setTimeout(() => {
      vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
      vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
      console.log('Re-enabled diff context after short delay');
    }, 500);
    
    // Register accept/reject commands with this diff ID
    const acceptRegistration = vscode.commands.registerCommand(`chartsmith.acceptDiff.${diffId}`, async () => {
      console.log(`Accept diff command triggered for ${diffId}`);
      await acceptDiffChanges(diffId);
      
      // Update button visibility after accepting
      updateDiffButtonsVisibility();
    });
    
    const rejectRegistration = vscode.commands.registerCommand(`chartsmith.rejectDiff.${diffId}`, async () => {
      console.log(`Reject diff command triggered for ${diffId}`);
      await rejectDiffChanges(diffId);
      
      // Update button visibility after rejecting
      updateDiffButtonsVisibility();
    });
    
    // Add command registrations to our disposables
    diffDisposables.push(acceptRegistration, rejectRegistration);
    
    // When the diff view is closed or changed
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      console.log(`Active editor changed: ${editor ? editor.document.uri.toString() : 'none'}`);
      
      // Get all diff editors that might still be open
      const allDiffEditors = vscode.window.visibleTextEditors.filter(
        e => e.document.uri.scheme === 'chartsmith-diff'
      );
      
      // Check if our specific diff is still visible
      const isDiffStillVisible = allDiffEditors.some(
        e => e.document.uri.toString().includes(diffId)
      );
      
      // Check if active editor is now a diff view
      if (editor && editor.document.uri.scheme === 'chartsmith-diff') {
        console.log('Diff editor activated, ensuring buttons are enabled');
        vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
        vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
        
        // Immediately focus on the editor to ensure VS Code's UI updates
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        
        // Force a refresh after a small delay to ensure buttons appear
        setTimeout(() => {
          vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
          vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
          // Run the more comprehensive visibility update
          updateDiffButtonsVisibility();
        }, 100);
        
        return;
      }
      
      // When switching away from diff editor to a non-diff editor
      if (!editor || editor.document.uri.scheme !== 'chartsmith-diff') {
        console.log(`Switched away from diff editor. ${allDiffEditors.length} diff editors remain visible`);
        
        if (allDiffEditors.length > 0) {
          // Other diff editors are still visible
          console.log(`Still have ${allDiffEditors.length} diff editors open, keeping buttons visible`);
          vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
          vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
          
          // If this diff is still visible but not active, ensure it can be accessed
          if (isDiffStillVisible) {
            console.log(`Diff ${diffId} is still visible in a tab, ensuring buttons remain available`);
            setTimeout(() => {
              vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
              vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
            }, 200);
          }
        } else if (global.chartsmithDiffRegistry && global.chartsmithDiffRegistry.size > 0) {
          // No diff editors visible but registry has entries
          // This could be a tab switch where diff editors are still open but not visible
          console.log('No diff editors visible but registry has entries, maintaining button visibility');
          vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
          vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
        } else {
          // No diff editors visible and registry is empty, hide buttons
          console.log('No diff editors remain visible, hiding buttons');
          vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', false);
          vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', false);
        }
      }
      
      // Run the more comprehensive visibility update
      updateDiffButtonsVisibility();
    });
    
    // Add editor change handler to our disposables
    diffDisposables.push(editorChangeDisposable);
    
    // Make sure diff action buttons are visible when diff is shown
    vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
    
    // Register cleanup to remove commands and event listeners when diff is closed
    const documentCloseDisposable = vscode.workspace.onDidCloseTextDocument(document => {
      if (document.uri.scheme === 'chartsmith-diff') {
        console.log(`Diff document closed: ${document.uri.toString()}`);
        
        // Extract the diff ID from the URI
        const match = document.uri.toString().match(/chartsmith-diff:([^\/]+)/);
        if (match && match[1]) {
          const closedDiffId = match[1];
          console.log(`Extracted diff ID from closed document: ${closedDiffId}`);
          
          // Check if this diff is completely closed (both old and new)
          const hasOtherPart = vscode.window.visibleTextEditors.some(editor => 
            editor.document.uri.scheme === 'chartsmith-diff' && 
            editor.document.uri.toString().includes(closedDiffId)
          );
          
          if (!hasOtherPart) {
            console.log(`Both parts of diff ${closedDiffId} are closed, cleaning up`);
            
            // Get the diff info from our registry
            const diffInfo = global.chartsmithDiffRegistry?.get(closedDiffId);
            if (diffInfo) {
              // Immediately cleanup content from map to prevent reopening
              chartsmithContentMap.delete(diffInfo.oldUri.toString());
              chartsmithContentMap.delete(diffInfo.newUri.toString());
              
              // Remove from registry with a slight delay to ensure VS Code has completed the close operation
              setTimeout(() => {
                global.chartsmithDiffRegistry?.delete(closedDiffId);
                activeDiffEditors.delete(closedDiffId);
                console.log(`Removed diff ${closedDiffId} from registry with delay`);
                
                // Update button visibility after registry cleanup
                updateDiffButtonsVisibility();
              }, 100);
            }
          } else {
            console.log(`Only one part of diff ${closedDiffId} closed, not cleaning up yet`);
          }
        }
        
        // Update button visibility based on remaining diff editors
        updateDiffButtonsVisibility();
      }
    });
    
    // Add document close handler to our disposables
    diffDisposables.push(documentCloseDisposable);
    
    // Store disposables in a global registry for cleanup later
    if (!global.chartsmithDisposables) {
      global.chartsmithDisposables = new Map<string, vscode.Disposable[]>();
    }
    global.chartsmithDisposables.set(diffId, diffDisposables);
    
    return new Promise((resolve) => {
      // Return a Promise that resolves immediately but doesn't clean up
      // This allows the diff view to remain active with its event handlers
      setTimeout(() => {
        resolve({ applied: true });
      }, 100);
    });
  } catch (error) {
    outputChannel.appendLine(`ERROR showing diff: ${error}`);
    vscode.window.showErrorMessage(`Error showing diff: ${error}`);
    return { applied: false };
  }
}

/**
 * Helper function to save the current diff state to extension context
 * This helps retain diff information between reloads
 */
export function saveDiffState(context: vscode.ExtensionContext) {
  if (!global.chartsmithDiffRegistry || global.chartsmithDiffRegistry.size === 0) {
    // Nothing to save
    return;
  }
  
  // Serialize the important parts of diff registry
  const diffState = Array.from(global.chartsmithDiffRegistry.entries()).map(([id, entry]) => ({
    id,
    filePath: entry.filePath,
    pendingContent: entry.pendingContent
  }));
  
  context.globalState.update('chartsmith.diffState', diffState);
  console.log(`Saved ${diffState.length} diffs to persistent storage`);
}

/**
 * Helper function to restore diff views from saved state
 */
export function restoreDiffState(context: vscode.ExtensionContext) {
  const diffState = context.globalState.get('chartsmith.diffState') as any[] || [];
  
  if (diffState.length === 0) {
    console.log('No saved diff state to restore');
    return;
  }
  
  console.log(`Restoring ${diffState.length} saved diffs`);
  
  // Restore diffs if any exist
  for (const entry of diffState) {
    // Recreate diff view from saved state
    showFileDiff(entry.filePath, entry.pendingContent);
  }
  
  // Clear the saved state after restoring
  context.globalState.update('chartsmith.diffState', []);
}

/**
 * Force refreshes the diff button visibility by checking current editor state
 * and explicitly setting VS Code context variables
 */
export function forceRefreshDiffButtons() {
  console.log('Force refreshing diff buttons visibility');
  
  // Get all open diff editors
  const diffEditors = vscode.window.visibleTextEditors.filter(
    editor => editor.document.uri.scheme === 'chartsmith-diff'
  );
  
  // Check registry size
  const registrySize = global.chartsmithDiffRegistry?.size || 0;
  
  console.log(`Force refresh: Found ${diffEditors.length} diff editors and ${registrySize} registry entries`);
  
  if (diffEditors.length > 0 || registrySize > 0) {
    // We should show the buttons
    console.log('Force enabling diff buttons');
    vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', true);
    vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', true);
  } else {
    // Should hide buttons
    console.log('Force hiding diff buttons');
    vscode.commands.executeCommand('setContext', 'chartsmith.showDiffActions', false);
    vscode.commands.executeCommand('setContext', 'chartsmith.diffVisible', false);
  }
  
  // Also run the regular update
  updateDiffButtonsVisibility();
}