/**
 * Custom diff module entry point.
 * Exports the functionality for showing diffs from remote Chartsmith workspaces.
 */

import * as vscode from 'vscode';
import customDiffModule from './index';

/**
 * Initializes the custom diff module
 * @param context VS Code extension context
 */
export function initializeCustomDiffModule(context: vscode.ExtensionContext): void {
  // Register commands
  customDiffModule.registerCustomDiffCommands(context);
  
  console.log('Custom diff module initialized');
}

export {
  customDiffModule
}; 