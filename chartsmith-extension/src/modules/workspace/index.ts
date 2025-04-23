import * as vscode from 'vscode';
import { WorkspaceMapping } from '../../types';
import { WORKSPACE_MAPPINGS_KEY } from '../../constants';
import { store, actions } from '../../state/store';
import * as fileContent from '../fileContent';
import { getAuthData } from '../auth';

/**
 * Interface for workspace file data returned from the API
 */
interface WorkspaceFile {
  id: string;
  revisionNumber: number;
  filePath: string;
  content?: string;
  contentPending?: string;
}

/**
 * Interface for workspace data returned from the API
 */
interface WorkspaceData {
  id: string;
  currentRevisionNumber: number;
  files?: WorkspaceFile[];
}

let globalStorage: vscode.Memento;

// In-memory database for workspace data
const memoryDb = new Map<string, any>();

// Debug function to show all keys in the memory DB
export function debugShowAllKeys(): void {
  console.log('Memory DB Keys:');
  Array.from(memoryDb.keys()).forEach(key => {
    console.log(`- ${key}`);
  });
}

/**
 * Store workspace data in memory
 * @param workspaceId The workspace ID
 * @param data The workspace data to store
 */
export function setWorkspaceData(workspaceId: string, data: any): void {
  const key = `workspace:${workspaceId}`;
  memoryDb.set(key, data);
}

/**
 * Get workspace data from memory
 * @param workspaceId The workspace ID
 * @returns The workspace data or null if not found
 */
export function getWorkspaceData(workspaceId: string): any {
  const key = `workspace:${workspaceId}`;
  return memoryDb.get(key) || null;
}

/**
 * Store revision data in memory
 * @param workspaceId The workspace ID
 * @param revisionId The revision ID
 * @param data The revision data to store
 */
export function setRevisionData(workspaceId: string, revisionId: string, data: any): void {
  const key = `workspace:${workspaceId}:revision:${revisionId}`;
  memoryDb.set(key, data);
}

/**
 * Get revision data from memory
 * @param workspaceId The workspace ID
 * @param revisionId The revision ID
 * @returns The revision data or null if not found
 */
export function getRevisionData(workspaceId: string, revisionId: string): any {
  const key = `workspace:${workspaceId}:revision:${revisionId}`;
  return memoryDb.get(key) || null;
}

/**
 * Store file content for a specific revision
 * @param workspaceId The workspace ID
 * @param filePath The file path
 * @param revisionId The revision ID
 * @param content The file content
 */
export function setFileContent(workspaceId: string, filePath: string, revisionId: string, content: string): void {
  const key = `file:${workspaceId}:${filePath}:revision:${revisionId}`;
  memoryDb.set(key, content);
}

/**
 * Get file content for a specific revision
 * @param workspaceId The workspace ID
 * @param filePath The file path
 * @param revisionId The revision ID
 * @returns The file content or null if not found
 */
export function getFileContent(workspaceId: string, filePath: string, revisionId: string): string | null {
  const key = `file:${workspaceId}:${filePath}:revision:${revisionId}`;
  return memoryDb.get(key) || null;
}

/**
 * Get all file keys for a specific workspace and revision
 * @param workspaceId The workspace ID
 * @param revisionId The revision ID
 * @returns Array of file keys that match the pattern
 */
export function getFilesForRevision(workspaceId: string, revisionId: string): string[] {
  const prefix = `file:${workspaceId}:`;
  const suffix = `:revision:${revisionId}`;
  
  return Array.from(memoryDb.keys())
    .filter(key => key.startsWith(prefix) && key.endsWith(suffix))
    .map(key => {
      // Extract the file path from the key
      const withoutPrefix = key.substring(prefix.length);
      const withoutSuffix = withoutPrefix.substring(0, withoutPrefix.length - suffix.length);
      return withoutSuffix;
    });
}

/**
 * Clear all data for a specific workspace
 * @param workspaceId The workspace ID to clear data for
 */
export function clearWorkspaceData(workspaceId: string): void {
  const prefix = `workspace:${workspaceId}`;
  const filePrefix = `file:${workspaceId}:`;
  
  // Remove all keys that start with the workspace prefix
  Array.from(memoryDb.keys())
    .filter(key => key.startsWith(prefix) || key.startsWith(filePrefix))
    .forEach(key => memoryDb.delete(key));
}

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
    console.log('Cleared active workspace ID in global storage');
    
    // Also clear the store
    actions.setWorkspaceId(null);
    console.log('Cleared workspace ID in store');
    
    // Disconnect from WebSocket
    const globalState = (global as any).chartsmithGlobalState;
    if (globalState) {
      try {
        const webSocket = await import('../webSocket');
        webSocket.disconnectFromCentrifugo();
        console.log('Disconnected from WebSocket');
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
  
  // Store the active workspace ID with forced persistence
  try {
    // First try to clear to ensure no stale state
    await globalStorage.update('chartsmith.activeWorkspaceId', undefined);
    // Then set the new value
    await globalStorage.update('chartsmith.activeWorkspaceId', workspaceId);
    console.log(`Persisted workspace ID to global storage: ${workspaceId}`);
    
    // Verify the value was saved
    const savedId = globalStorage.get<string>('chartsmith.activeWorkspaceId');
    if (savedId !== workspaceId) {
      console.warn(`Storage verification failed! Expected: ${workspaceId}, Got: ${savedId}`);
      // Try again with a different approach
      await globalStorage.update('chartsmith.activeWorkspaceId', workspaceId.toString());
      console.log('Attempted alternative persistence method');
    }
  } catch (error) {
    console.error('Error persisting workspace ID:', error);
  }
  
  // Also update the store
  actions.setWorkspaceId(workspaceId);
  console.log(`Updated store with workspace ID: ${workspaceId}`);
  
  // Fetch workspace data from API and store it
  await fetchAndStoreWorkspaceData(workspaceId);
  
  // If we have a webview, notify it of the workspace change
  const globalState = (global as any).chartsmithGlobalState;
  
  if (globalState?.webviewGlobal) {
    globalState.webviewGlobal.postMessage({
      command: 'workspaceChanged',
      workspaceId: workspaceId
    });
    console.log(`Notified webview of workspace change to: ${workspaceId}`);
  } else {
    console.log('No webview available to notify of workspace change');
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
 * Get pending content for a file
 * @param workspaceId The workspace ID
 * @param filePath The file path
 * @returns The pending content or null if not found
 */
export async function getPendingFileContent(workspaceId: string, filePath: string): Promise<string | null> {
  console.log(`[getPendingFileContent] Getting pending content for ${filePath} in workspace ${workspaceId}`);
  
  // First check the memory store
  const key = `pendingContent:${workspaceId}:${filePath}`;
  const content = memoryDb.get(key);
  
  if (content) {
    console.log(`[getPendingFileContent] Found content in memory for ${filePath}`);
    return content;
  }
  
  // Check the current store.plans for pending content
  const state = (store as any).getState();
  const plans = state.plans || [];
  
  // Get the active plan id from store
  const activePlanId = state.activePlan ? state.activePlan.id : null;
  
  if (activePlanId) {
    console.log(`[getPendingFileContent] Checking active plan ${activePlanId} for pending content`);
    
    // Find file in active plan
    const activePlan = plans.find((plan: any) => plan.id === activePlanId);
    
    if (activePlan && activePlan.files) {
      const file = activePlan.files.find((f: any) => f.path === filePath);
      
      if (file && file.pendingContent) {
        console.log(`[getPendingFileContent] Found pending content in active plan for ${filePath}`);
        memoryDb.set(key, file.pendingContent);
        return file.pendingContent;
      }
    }
  }
  
  // If not found in memory, try to get from fileContent module (API or cache)
  try {
    console.log(`[getPendingFileContent] Getting content from API for ${filePath}`);
    const authData = getAuthData();
    
    if (!authData) {
      console.log(`[getPendingFileContent] No auth data available, cannot fetch content`);
      return null;
    }
    
    // Use the fileContent module to get the content
    const content = await fileContent.getFileContent(
      authData,
      workspaceId,
      activePlanId || 'latest', // Use active plan or 'latest' as fallback
      filePath
    );
    
    if (content) {
      // Store in memory for future use
      memoryDb.set(key, content);
      return content;
    }
  } catch (error) {
    console.error(`[getPendingFileContent] Error fetching content: ${error}`);
  }
  
  console.log(`[getPendingFileContent] No pending content found for ${filePath}`);
  return null;
}

/**
 * Fetch workspace data from the API and store it in our key-value database
 * @param workspaceId The ID of the workspace to fetch
 */
export async function fetchAndStoreWorkspaceData(workspaceId: string): Promise<void> {
  try {
    console.log(`!!! ACTUALLY MAKING WORKSPACE API CALL for ${workspaceId} !!!`);
    
    // Get the global state to access auth data
    const globalState = (global as any).chartsmithGlobalState;
    if (!globalState || !globalState.authData) {
      console.error('No auth data available for API call');
      return;
    }
    
    console.log(`Auth data available: ${!!globalState.authData}`);
    console.log(`Auth token available: ${!!globalState.authData.token}`);
    console.log(`API endpoint: ${globalState.authData.apiEndpoint}`);
    
    // Import API module
    console.log('Importing API module...');
    const api = await import('../api');
    console.log('API module imported successfully');
    
    // Construct the URL for debugging
    const utils = await import('../utils');
    const fullUrl = utils.constructApiUrl(globalState.authData.apiEndpoint, `/workspace/${workspaceId}`);
    console.log(`Full API URL for workspace data: ${fullUrl}`);
    
    // Make API call to get workspace data
    console.log('Making fetchApi call now...');
    const workspaceData = await api.fetchApi(
      globalState.authData,
      `/workspace/${workspaceId}`,
      'GET'
    ) as WorkspaceData;
    
    console.log(`Received workspace data for ${workspaceId}`, workspaceData);
    
    // Store the complete workspace data
    setWorkspaceData(workspaceId, workspaceData);
    
    // Check for currentRevisionNumber
    if (workspaceData.currentRevisionNumber) {
      console.log(`Current revision number: ${workspaceData.currentRevisionNumber}`);
      
      // Store the current revision number for quick access
      const revisionKey = `workspace:${workspaceId}:currentRevision`;
      memoryDb.set(revisionKey, workspaceData.currentRevisionNumber);
      
      // Store the files data if present
      if (workspaceData.files && Array.isArray(workspaceData.files)) {
        console.log(`Storing ${workspaceData.files.length} files`);
        
        workspaceData.files.forEach((file: WorkspaceFile) => {
          if (file.filePath) {
            // Store the file content
            if (file.contentPending) {
              // Store pending content with current revision number
              setFileContent(
                workspaceId, 
                file.filePath, 
                `${workspaceData.currentRevisionNumber}`, 
                file.contentPending
              );
              console.log(`Stored pending content for ${file.filePath} (revision ${workspaceData.currentRevisionNumber})`);
            } else if (file.content) {
              // Store regular content with file's revision number
              setFileContent(
                workspaceId, 
                file.filePath, 
                `${file.revisionNumber || workspaceData.currentRevisionNumber}`, 
                file.content
              );
              console.log(`Stored content for ${file.filePath} (revision ${file.revisionNumber || workspaceData.currentRevisionNumber})`);
            }
          }
        });
      }
    }
    
    // Log the keys we've stored for debugging
    debugShowAllKeys();
    
  } catch (error) {
    console.error(`Error fetching workspace data: ${error}`);
    console.error(`Error stack trace: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
    
    // Check for specific error types to provide better diagnostics
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        console.error('Connection error - the API server may be unreachable. Check your network connection and API endpoint.');
      } else if (error.message.includes('401')) {
        console.error('Authentication error - check that your auth token is valid and not expired.');
      } else if (error.message.includes('404')) {
        console.error(`Resource not found - the workspace ID ${workspaceId} might not exist or you might not have access to it.`);
      }
    }
    
    // Log the global state if available for debugging
    const globalState = (global as any).chartsmithGlobalState;
    if (globalState) {
      console.log('Global state available:', {
        isLoggedIn: globalState.isLoggedIn,
        connectionStatus: globalState.connectionStatus,
        authDataAvailable: !!globalState.authData,
        webviewAvailable: !!globalState.webviewGlobal
      });
    } else {
      console.error('Global state not available - this suggests a serious initialization issue.');
    }
  }
}

export function updateWorkspaceData(workspaceData: WorkspaceData): void {
  console.log('Updating workspace data:', workspaceData);
  
  // Store the workspace data in our memory DB
  if (workspaceData.id) {
    setWorkspaceData(workspaceData.id, workspaceData);
    
    // Store the current revision information if present
    if (workspaceData.currentRevisionNumber) {
      // Store the current revision number
      const revisionKey = `workspace:${workspaceData.id}:currentRevision`;
      memoryDb.set(revisionKey, workspaceData.currentRevisionNumber);
      
      // Store the files data if present
      if (workspaceData.files && Array.isArray(workspaceData.files)) {
        workspaceData.files.forEach((file: WorkspaceFile) => {
          if (file.filePath) {
            // Store the file content
            if (file.contentPending) {
              // Store pending content with current revision
              setFileContent(
                workspaceData.id, 
                file.filePath, 
                `${workspaceData.currentRevisionNumber}`, 
                file.contentPending
              );
            } else if (file.content) {
              // Store regular content with file's revision
              setFileContent(
                workspaceData.id, 
                file.filePath, 
                `${file.revisionNumber || workspaceData.currentRevisionNumber}`, 
                file.content
              );
            }
          }
        });
      }
    }
  }
  
  // Log the keys we've stored for debugging
  debugShowAllKeys();
}