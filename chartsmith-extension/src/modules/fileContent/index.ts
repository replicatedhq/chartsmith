import * as vscode from 'vscode';
import * as path from 'path';
import { log } from '../logging';
import { getAuthData } from '../auth';
import { AuthData } from '../../types';
import { constructApiUrl } from '../utils';
import { isDevelopmentMode } from '../config';

// Cache for pending file content
const pendingContentCache = new Map<string, string>();

/**
 * Gets the cache key for a file
 * @param planId The plan ID
 * @param filePath The file path
 * @returns The cache key
 */
function getCacheKey(planId: string, filePath: string): string {
  return `${planId}:${filePath}`;
}

/**
 * Stores content in the cache
 * @param planId The plan ID
 * @param filePath The file path
 * @param content The file content
 */
export function storeContentInCache(planId: string, filePath: string, content: string): void {
  const key = getCacheKey(planId, filePath);
  pendingContentCache.set(key, content);
  log.info(`[storeContentInCache] Cached content for ${filePath}`);
}

/**
 * Gets content from the cache
 * @param planId The plan ID
 * @param filePath The file path
 * @returns The cached content or null if not found
 */
export function getContentFromCache(planId: string, filePath: string): string | null {
  const key = getCacheKey(planId, filePath);
  const content = pendingContentCache.get(key);
  
  if (content) {
    log.info(`[getContentFromCache] Found cached content for ${filePath}`);
    return content;
  }
  
  log.info(`[getContentFromCache] No cached content found for ${filePath}`);
  return null;
}

/**
 * Clears content from the cache
 * @param planId The plan ID
 * @param filePath The file path
 */
export function clearContentFromCache(planId: string, filePath: string): void {
  const key = getCacheKey(planId, filePath);
  pendingContentCache.delete(key);
  log.info(`[clearContentFromCache] Cleared cached content for ${filePath}`);
}

/**
 * Clears all content for a plan from the cache
 * @param planId The plan ID
 */
export function clearPlanContentFromCache(planId: string): void {
  let count = 0;
  for (const key of pendingContentCache.keys()) {
    if (key.startsWith(`${planId}:`)) {
      pendingContentCache.delete(key);
      count++;
    }
  }
  log.info(`[clearPlanContentFromCache] Cleared ${count} cached items for plan ${planId}`);
}

/**
 * Fetches pending content for a specific file in a plan
 * @param authData The auth data
 * @param workspaceId The workspace ID
 * @param planId The plan ID
 * @param filePath The file path
 * @returns The file content or null if not available
 */
export async function fetchPendingFileContent(
  authData: AuthData | null,
  workspaceId: string,
  planId: string,
  filePath: string
): Promise<string | null> {
  if (!authData) {
    log.warn(`[fetchPendingFileContent] Missing auth data, cannot fetch content for ${filePath}`);
    return null;
  }

  try {
    log.info(`[fetchPendingFileContent] Fetching content for ${filePath} via workspace endpoint`);
    
    // Validate parameters
    if (!workspaceId || !filePath) {
      log.error(`[fetchPendingFileContent] Invalid parameters: workspaceId=${workspaceId}, filePath=${filePath}`);
      return null;
    }
    
    // Construct the workspace API endpoint
    const apiUrl = constructApiUrl(
      authData.apiEndpoint,
      `/workspace/${workspaceId}`
    );
    
    log.debug(`[fetchPendingFileContent] Requesting from: ${apiUrl}`);
    
    // Fetch the entire workspace data
    const response = await fetch(
      apiUrl,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      log.error(`[fetchPendingFileContent] Error fetching workspace data: ${response.status} ${response.statusText}`);
      if (response.status === 401 || response.status === 403) {
        log.error(`[fetchPendingFileContent] Authentication error - token may be invalid or expired`);
      }
      return null;
    }

    // Parse the response
    let workspace;
    try {
      workspace = await response.json();
      log.debug(`[fetchPendingFileContent] Workspace data received: ${workspace ? 'yes' : 'no'}`);
      
      if (!workspace) {
        log.error(`[fetchPendingFileContent] Empty workspace data returned`);
        return null;
      }
    } catch (jsonError) {
      log.error(`[fetchPendingFileContent] Error parsing workspace JSON response: ${jsonError}`);
      return null;
    }
    
    // Look for the file in the workspace charts
    if (workspace.charts && Array.isArray(workspace.charts)) {
      log.debug(`[fetchPendingFileContent] Searching in ${workspace.charts.length} charts`);
      
      for (const chart of workspace.charts) {
        if (chart.files && Array.isArray(chart.files)) {
          const file = chart.files.find((f: any) => f.filePath === filePath);
          if (file && file.contentPending) {
            log.info(`[fetchPendingFileContent] Found content in workspace charts for ${filePath}`);
            storeContentInCache(planId, filePath, file.contentPending);
            return file.contentPending;
          }
        }
      }
    } else {
      log.debug(`[fetchPendingFileContent] No charts found in workspace data`);
    }
    
    // Look for the file in loose files
    if (workspace.files && Array.isArray(workspace.files)) {
      log.debug(`[fetchPendingFileContent] Searching in ${workspace.files.length} loose files`);
      
      const file = workspace.files.find((f: any) => f.filePath === filePath);
      if (file && file.contentPending) {
        log.info(`[fetchPendingFileContent] Found content in workspace loose files for ${filePath}`);
        storeContentInCache(planId, filePath, file.contentPending);
        return file.contentPending;
      }
    } else {
      log.debug(`[fetchPendingFileContent] No loose files found in workspace data`);
    }

    log.warn(`[fetchPendingFileContent] No pending content found for ${filePath} in workspace`);
    return null;
  } catch (error) {
    log.error(`[fetchPendingFileContent] Failed to fetch content for ${filePath}: ${error}`);
    return null;
  }
}

/**
 * Fetches pending content with a progress indicator
 * @deprecated This function will be removed in a future version. Use the workspace module's getPendingFileContent instead.
 * @param authData The auth data
 * @param workspaceId The workspace ID
 * @param planId The plan ID
 * @param filePath The file path
 * @returns The file content or null if not available
 */
export async function fetchPendingFileContentWithProgress(
  authData: AuthData | null,
  workspaceId: string,
  planId: string,
  filePath: string
): Promise<string | null> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Fetching content for ${path.basename(filePath)}`,
      cancellable: true
    },
    async (progress, token) => {
      // Setup cancellation
      let isCancelled = false;
      token.onCancellationRequested(() => {
        isCancelled = true;
        log.info(`[fetchPendingFileContentWithProgress] User cancelled content fetch for ${filePath}`);
      });

      // Check cache first
      progress.report({ message: "Checking cache...", increment: 20 });
      const cachedContent = getContentFromCache(planId, filePath);
      if (cachedContent) {
        log.info(`[fetchPendingFileContentWithProgress] Using cached content for ${filePath}`);
        return cachedContent;
      }

      if (isCancelled) return null;

      // Fetch from API
      progress.report({ message: "Fetching from API...", increment: 30 });
      const content = await fetchPendingFileContent(authData, workspaceId, planId, filePath);
      
      if (isCancelled) return null;

      progress.report({ message: "Processing...", increment: 50 });
      
      return content;
    }
  );
}

/**
 * Gets file content, prioritizing provided content, then API content
 * @param authData The auth data
 * @param workspaceId The workspace ID
 * @param planId The plan ID
 * @param filePath The file path
 * @param providedContent Optional content already provided
 * @returns The file content or null if not available
 */
export async function getFileContent(
  authData: AuthData | null,
  workspaceId: string,
  planId: string,
  filePath: string,
  providedContent?: string
): Promise<string | null> {
  // Log development mode status for debugging
  if (isDevelopmentMode()) {
    log.debug(`[getFileContent] Development mode is enabled for ${filePath}`);
  }

  // If content is already provided, use it
  if (providedContent) {
    log.info(`[getFileContent] Using provided content for ${filePath}`);
    
    // Cache for future use
    storeContentInCache(planId, filePath, providedContent);
    
    // Write content to filesystem
    await writeContentToFilesystem(filePath, workspaceId, providedContent);
    
    return providedContent;
  }
  
  // Check cache
  const cachedContent = getContentFromCache(planId, filePath);
  if (cachedContent) {
    log.info(`[getFileContent] Using cached content for ${filePath}`);
    
    // Write content to filesystem
    await writeContentToFilesystem(filePath, workspaceId, cachedContent);
    
    return cachedContent;
  }
  
  // Fetch from API with progress indicator
  const apiContent = await fetchPendingFileContentWithProgress(
    authData, 
    workspaceId, 
    planId, 
    filePath
  );
  
  if (apiContent) {
    log.info(`[getFileContent] Using API content for ${filePath}`);
    
    // Write content to filesystem
    await writeContentToFilesystem(filePath, workspaceId, apiContent);
    
    return apiContent;
  }
  
  // No content available
  log.error(`[getFileContent] No content available for ${filePath}`);
  vscode.window.showErrorMessage(
    `Failed to get content for ${path.basename(filePath)}.`
  );
  
  return null;
}

/**
 * Writes content to the filesystem at the appropriate location for the workspace
 * @param filePath The file path
 * @param workspaceId The workspace ID
 * @param content The content to write
 */
export async function writeContentToFilesystem(
  filePath: string,
  workspaceId: string,
  content: string
): Promise<void> {
  try {
    // Get workspace module
    const workspaceModule = await import('../workspace');
    
    // Get the chart path from workspace mapping
    const mapping = await workspaceModule.getWorkspaceMapping(workspaceId);
    
    if (!mapping || !mapping.localPath) {
      log.error(`[writeContentToFilesystem] Could not find chart path for workspace ${workspaceId}`);
      return;
    }
    
    // Import filesystem modules
    const fs = require('fs');
    
    // The localPath is the full path to the chart directory
    const chartBasePath = mapping.localPath;
    
    // IMPROVED PATH HANDLING:
    // Normalize both paths for consistent comparison
    const normalizedChartPath = path.normalize(chartBasePath);
    const normalizedFilePath = path.normalize(filePath);
    
    log.info(`[writeContentToFilesystem] Path analysis:
      normalizedChartPath: ${normalizedChartPath}
      normalizedFilePath: ${normalizedFilePath}
      isAbsoluteFilePath: ${path.isAbsolute(normalizedFilePath)}
    `);
    
    let relativePath;
    
    // Special case: if the file path contains both the chart path AND a duplicate of the chart path
    // For example: /path/to/chart/path/to/chart/file.yaml
    if (normalizedFilePath.includes(normalizedChartPath)) {
      // Extract all occurrences of the chart path
      const allMatches = [];
      let startIndex = 0;
      let foundIndex;
      
      while ((foundIndex = normalizedFilePath.indexOf(normalizedChartPath, startIndex)) !== -1) {
        allMatches.push(foundIndex);
        startIndex = foundIndex + normalizedChartPath.length;
      }
      
      log.info(`[writeContentToFilesystem] Found ${allMatches.length} occurrences of chartPath in filePath`);
      
      if (allMatches.length > 1) {
        // Multiple occurrences means we have duplication - take everything after the last match
        const lastMatchIndex = allMatches[allMatches.length - 1];
        relativePath = normalizedFilePath.substring(lastMatchIndex + normalizedChartPath.length);
        log.info(`[writeContentToFilesystem] Multiple occurrences detected - extracted path after last match: ${relativePath}`);
      } else if (allMatches.length === 1) {
        // Single occurrence - normal case, extract the path after the chart path
        relativePath = normalizedFilePath.substring(allMatches[0] + normalizedChartPath.length);
        log.info(`[writeContentToFilesystem] Single occurrence - extracted path: ${relativePath}`);
      }
    }
    
    // If no relative path extracted yet, use standard handling
    if (!relativePath) {
      if (normalizedFilePath.startsWith(normalizedChartPath)) {
        // Extract just the relative part by removing the chart base path
        relativePath = normalizedFilePath.substring(normalizedChartPath.length);
        log.info(`[writeContentToFilesystem] Path starts with chart base path, extracted relative part: ${relativePath}`);
      } else {
        // Treat as a relative path, just remove any leading slashes
        relativePath = normalizedFilePath.replace(/^\/+/, '');
        log.info(`[writeContentToFilesystem] Using as relative path: ${relativePath}`);
      }
    }
    
    // Ensure no leading slash for proper path joining
    relativePath = relativePath.replace(/^\/+/, '');
    
    // Join paths correctly to create the full absolute path
    const fullFilePath = path.join(normalizedChartPath, relativePath);

    // ADDED: Enhanced debugging info with path analysis
    log.info(`[writeContentToFilesystem] DETAILED PATH INFO:
      workspaceId: ${workspaceId}
      mapping.localPath: ${mapping.localPath}
      normalizedChartPath: ${normalizedChartPath}
      original filePath: ${filePath}
      normalizedFilePath: ${normalizedFilePath}
      isAbsolutePath: ${path.isAbsolute(filePath)}
      contains chartBasePath: ${normalizedFilePath.includes(normalizedChartPath)}
      relativePath: ${relativePath}
      NEW fullFilePath: ${fullFilePath}
      content length: ${content?.length || 0}
    `);
    
    // ADDED: Validate content before writing
    if (!content || content.length === 0) {
      log.error(`[writeContentToFilesystem] Empty content provided for file: ${filePath}`);
      vscode.window.showErrorMessage(`Cannot write empty content for file: ${path.basename(filePath)}`);
      return;
    }
    
    // ADDED: Explicit directory check & creation using synchronous methods
    const dirPath = path.dirname(fullFilePath);
    if (!fs.existsSync(dirPath)) {
      log.info(`[writeContentToFilesystem] Directory doesn't exist, creating: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Verify directory was created
    const dirExists = fs.existsSync(dirPath);
    log.info(`[writeContentToFilesystem] Directory created? ${dirExists ? 'Yes' : 'No'} - ${dirPath}`);
    
    if (!dirExists) {
      throw new Error(`Failed to create directory: ${dirPath}`);
    }
    
    // Write the content to the file
    await fs.promises.writeFile(fullFilePath, content);
    
    // Verify file was written
    const fileExists = fs.existsSync(fullFilePath);
    const fileSize = fileExists ? fs.statSync(fullFilePath).size : 0;
    log.info(`[writeContentToFilesystem] File written? ${fileExists ? 'Yes' : 'No'} - Size: ${fileSize} bytes - Path: ${fullFilePath}`);
    
    if (fileExists) {
      log.info(`[writeContentToFilesystem] Successfully wrote content to ${fullFilePath}`);
      
      // ADDED: Force VS Code to recognize the file
      try {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fullFilePath))
          .then(() => {
            log.info(`[writeContentToFilesystem] File opened in editor: ${fullFilePath}`);
          }, (openError: Error) => {
            log.warn(`[writeContentToFilesystem] Error opening file: ${openError}`);
          });
      } catch (openError) {
        log.warn(`[writeContentToFilesystem] Error opening file: ${openError}`);
      }
      
      // Optional: notify any listeners that the file has been written
      const globalState = (global as any).chartsmithGlobalState;
      if (globalState?.webviewGlobal) {
        globalState.webviewGlobal.postMessage({
          command: 'fileContentWritten',
          filePath: filePath,
          workspaceId: workspaceId,
          success: true
        });
      }
    } else {
      throw new Error(`File write appeared to succeed but file doesn't exist: ${fullFilePath}`);
    }
  } catch (error) {
    log.error(`[writeContentToFilesystem] Error writing content to filesystem: ${error}`);
    vscode.window.showErrorMessage(`Error writing file to disk: ${error}`);
    
    // Notify UI of failure
    const globalState = (global as any).chartsmithGlobalState;
    if (globalState?.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'fileContentWritten',
        filePath: filePath,
        workspaceId: workspaceId,
        success: false,
        error: `${error}`
      });
    }
  }
} 