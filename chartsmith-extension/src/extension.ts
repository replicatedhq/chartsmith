import * as vscode from 'vscode';
import { activate as activateLifecycle, deactivate as deactivateLifecycle } from './modules/lifecycle';

export function activate(context: vscode.ExtensionContext) {
  return activateLifecycle(context);
}

export function deactivate() {
  return deactivateLifecycle();
}