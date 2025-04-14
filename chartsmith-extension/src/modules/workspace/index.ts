import * as vscode from 'vscode';
import { WorkspaceMapping } from '../../types';
import { WORKSPACE_MAPPINGS_KEY } from '../../constants';
import { store, actions } from '../../state/store';

let globalStorage: vscode.Memento;

export function initWorkspace(extensionContext: vscode.ExtensionContext): void {
  globalStorage = extensionContext.globalState;
}

export async function saveWorkspaceMapping(mapping: WorkspaceMapping): Promise<void> {
  const mappings = await getAllWorkspaceMappings();
  
  // Check if mapping already exists, update if it does
  const existingIndex = mappings.findIndex(m => 
    m.workspaceId === mapping.workspaceId || m.localPath === mapping.localPath
  );
  
  if (existingIndex !== -1) {
    mappings[existingIndex] = mapping;
  } else {
    mappings.push(mapping);
  }
  
  await globalStorage.update(WORKSPACE_MAPPINGS_KEY, mappings);
}

export async function getWorkspaceMapping(workspaceId: string): Promise<WorkspaceMapping | null> {
  const mappings = await getAllWorkspaceMappings();
  const mapping = mappings.find(m => m.workspaceId === workspaceId);
  return mapping || null;
}

export async function getWorkspaceMappingByPath(localPath: string): Promise<WorkspaceMapping | null> {
  const mappings = await getAllWorkspaceMappings();
  const mapping = mappings.find(m => m.localPath === localPath);
  return mapping || null;
}

export async function getAllWorkspaceMappings(): Promise<WorkspaceMapping[]> {
  const mappings = globalStorage.get<WorkspaceMapping[]>(WORKSPACE_MAPPINGS_KEY, []);
  return mappings;
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  // Get the active workspace ID from global storage
  const activeWorkspaceId = globalStorage.get<string>('chartsmith.activeWorkspaceId');
  
  // Also make sure the store is in sync
  if (activeWorkspaceId) {
    actions.setWorkspaceId(activeWorkspaceId);
  }
  
  return activeWorkspaceId || null;
}

export async function setActiveWorkspaceId(workspaceId: string | null): Promise<void> {
  console.log(`Setting active workspace ID to: ${workspaceId}`);
  
  if (workspaceId === null) {
    // Clear the active workspace ID
    await globalStorage.update('chartsmith.activeWorkspaceId', undefined);
    
    // Also clear the store
    actions.setWorkspaceId(null);
    
    // Disconnect from WebSocket
    const globalState = (global as any).chartsmithGlobalState;
    if (globalState) {
      try {
        const webSocket = await import('../webSocket');
        webSocket.disconnectFromCentrifugo();
      } catch (error) {
        console.error('Error disconnecting from WebSocket:', error);
      }
    }
    return;
  }
  
  if (!workspaceId) {
    console.error('Attempted to set empty workspace ID');
    return;
  }
  
  // Store the active workspace ID
  await globalStorage.update('chartsmith.activeWorkspaceId', workspaceId);
  
  // Also update the store
  actions.setWorkspaceId(workspaceId);
  console.log(`Updated store with workspace ID: ${workspaceId}`);
  
  // If we have a webview, notify it of the workspace change
  const globalState = (global as any).chartsmithGlobalState;
  
  if (globalState?.webviewGlobal) {
    globalState.webviewGlobal.postMessage({
      command: 'workspaceChanged',
      workspaceId: workspaceId
    });
  }
}

export async function removeWorkspaceMapping(workspaceId: string): Promise<void> {
  const mappings = await getAllWorkspaceMappings();
  const filteredMappings = mappings.filter(m => m.workspaceId !== workspaceId);
  await globalStorage.update(WORKSPACE_MAPPINGS_KEY, filteredMappings);
}

export async function removeWorkspaceMappingByPath(localPath: string): Promise<void> {
  const mappings = await getAllWorkspaceMappings();
  const filteredMappings = mappings.filter(m => m.localPath !== localPath);
  await globalStorage.update(WORKSPACE_MAPPINGS_KEY, filteredMappings);
}

/**
 * Helper function to construct a channel name from workspaceId and userId
 * Format: {workspaceId}#{userId}
 */
export function constructChannelName(workspaceId: string, userId: string): string {
  return `${workspaceId}#${userId}`;
}

/**
 * Updates workspace data with response from the server
 * This function is used when proceeding with a plan to update any workspace state
 */
export function updateWorkspaceData(workspaceData: any): void {
  console.log('Updating workspace data:', workspaceData);
  
  // For now, just log the data. If we need to store or update any specific
  // workspace state in the future, we can add it here.
  
  // You could store the workspace data in a new atom if needed:
  // if (workspaceData.id) {
  //   actions.setWorkspaceData(workspaceData);
  // }
}