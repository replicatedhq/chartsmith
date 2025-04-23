import * as vscode from 'vscode';
import * as path from 'path';
import { log } from '../logging';
import { getAuthData } from '../auth';
import { AuthData } from '../../types';
import { API_BASE_URL } from '../../constants';
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
    log.info(`[fetchPendingFileContent] Fetching content for ${filePath}`);
    
    const response = await fetch(
      `${API_BASE_URL}/workspace/${workspaceId}/plan/${planId}/file?path=${encodeURIComponent(filePath)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        log.warn(`[fetchPendingFileContent] File not found: ${filePath}`);
        return null;
      }
      
      log.error(`[fetchPendingFileContent] Error fetching content: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (!data.content) {
      log.warn(`[fetchPendingFileContent] No content returned for ${filePath}`);
      return null;
    }

    log.info(`[fetchPendingFileContent] Successfully fetched content for ${filePath}`);
    
    // Store in cache for future use
    storeContentInCache(planId, filePath, data.content);
    
    return data.content;
  } catch (error) {
    log.error(`[fetchPendingFileContent] Failed to fetch content for ${filePath}: ${error}`);
    return null;
  }
}

/**
 * Fetches pending content with a progress indicator
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

      if (content) {
        progress.report({ message: "Content retrieved", increment: 50 });
        return content;
      }
      
      progress.report({ message: "Failed to fetch content", increment: 50 });
      return null;
    }
  );
}

/**
 * Generates demo content for a file (used in development mode)
 * @param filePath The file path
 * @returns The generated demo content
 */
export function generateDemoContent(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);
  
  // Generate content based on file type
  switch (extension) {
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
      return `// Demo content for ${basename}
// Generated in development mode
console.log('This is demo content for ${basename}');

function exampleFunction() {
  return 'Hello from ChartSmith demo content';
}

export default exampleFunction;
`;
    
    case '.html':
      return `<!DOCTYPE html>
<html>
<head>
  <title>Demo Content - ${basename}</title>
</head>
<body>
  <h1>ChartSmith Demo Content</h1>
  <p>This is demo content for ${basename}</p>
</body>
</html>
`;
    
    case '.css':
      return `/* Demo content for ${basename} */
.demo-content {
  color: #333;
  font-family: Arial, sans-serif;
  padding: 20px;
  border: 1px solid #ddd;
}
`;
    
    case '.json':
      return `{
  "name": "${basename}",
  "type": "demo-content",
  "description": "This is demo content generated by ChartSmith in development mode",
  "timestamp": "${new Date().toISOString()}"
}
`;
    
    case '.md':
      return `# Demo Content for ${basename}

This is demo content generated by ChartSmith in development mode.

## Features
- Demo content generation
- Development mode testing
- File type detection

> Note: This is not real content from the API.
`;
    
    default:
      return `# Demo content for ${basename}
# Generated in development mode by ChartSmith
# This is not real content from the API
`;
  }
}

/**
 * Gets file content, prioritizing provided content, then API content, and falling back to demo content in development mode
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
  
  // If in development mode, generate demo content
  if (isDevelopmentMode()) {
    log.info(`[getFileContent] Using demo content for ${filePath} (development mode)`);
    const demoContent = generateDemoContent(filePath);
    
    // Cache for future use
    storeContentInCache(planId, filePath, demoContent);
    
    // Write content to filesystem
    await writeContentToFilesystem(filePath, workspaceId, demoContent);
    
    return demoContent;
  }
  
  // No content available and not in development mode
  log.error(`[getFileContent] No content available for ${filePath} and development mode is disabled`);
  vscode.window.showErrorMessage(
    `Failed to get content for ${path.basename(filePath)}. To use demo content, enable development mode in settings.`
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

/**
 * Test function to directly verify file writing capability
 * This is a diagnostic tool to help identify issues with filesystem operations
 * @param workspaceId The workspace ID
 */
export async function testFileWrite(workspaceId: string): Promise<void> {
  try {
    log.info(`[testFileWrite] Starting file write test for workspace: ${workspaceId}`);
    
    // Get workspace module
    const workspaceModule = await import('../workspace');
    
    // Get the chart path from workspace mapping
    const mapping = await workspaceModule.getWorkspaceMapping(workspaceId);
    
    if (!mapping || !mapping.localPath) {
      const errorMsg = `Could not find chart path for workspace ${workspaceId}`;
      log.error(`[testFileWrite] ${errorMsg}`);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }
    
    // Import filesystem modules
    const fs = require('fs');
    
    // Create test files that will be used for mock diffs
    const mockFiles = [
      {
        path: path.join(mapping.localPath, 'mock-test-1.yaml'),
        content: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: test-service\nspec:\n  ports:\n  - port: 80\n    targetPort: 8080'
      },
      {
        path: path.join(mapping.localPath, 'mock-test-2.yaml'),
        content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: test-deployment\nspec:\n  replicas: 1\n  template:\n    spec:\n      containers:\n      - name: test\n        image: nginx:latest'
      },
      {
        path: path.join(mapping.localPath, 'mock-test-3.json'),
        content: '{\n  "name": "test-config",\n  "version": "1.0.0",\n  "description": "Test configuration"\n}'
      }
    ];
    
    // Write the mock files
    const results = [];
    for (const mockFile of mockFiles) {
      try {
        // Ensure directory exists
        const dirPath = path.dirname(mockFile.path);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Write the file
        fs.writeFileSync(mockFile.path, mockFile.content);
        
        // Verify file was written
        if (fs.existsSync(mockFile.path)) {
          const fileSize = fs.statSync(mockFile.path).size;
          const result = `Created mock file: ${path.basename(mockFile.path)} (${fileSize} bytes)`;
          log.info(`[testFileWrite] ${result}`);
          results.push(result);
        } else {
          throw new Error(`File was not created: ${mockFile.path}`);
        }
      } catch (error) {
        log.error(`[testFileWrite] Error creating mock file ${mockFile.path}: ${error}`);
        results.push(`Failed to create ${path.basename(mockFile.path)}: ${error}`);
      }
    }
    
    // Also create a standard test file to verify basic file writing
    const testFilePath = path.join(mapping.localPath, 'chartsmith-test.txt');
    const testContent = `ChartSmith file writing test
Timestamp: ${new Date().toISOString()}
Workspace ID: ${workspaceId}
Chart Path: ${mapping.localPath}
`;
    
    try {
      fs.writeFileSync(testFilePath, testContent);
      if (fs.existsSync(testFilePath)) {
        const fileSize = fs.statSync(testFilePath).size;
        results.push(`Created test file: chartsmith-test.txt (${fileSize} bytes)`);
      }
    } catch (error) {
      log.error(`[testFileWrite] Error creating test file: ${error}`);
      results.push(`Failed to create test file: ${error}`);
    }
    
    // Show success message with list of created files
    vscode.window.showInformationMessage(
      `Created ${results.length} files for testing. Run "Create Mock Diffs" to see changes.`,
      { detail: results.join('\n'), modal: false }
    );
    
  } catch (error) {
    log.error(`[testFileWrite] Test file write failed: ${error}`);
    vscode.window.showErrorMessage(`Test file writing failed: ${error}`);
  }
}

/**
 * Test function to verify path handling logic
 * @param chartBasePath The chart base path
 * @param filePath The file path to process
 * @returns The resolved file path
 */
export function testPathHandling(chartBasePath: string, filePath: string): string {
  try {
    // IMPROVED PATH HANDLING:
    // Normalize both paths for consistent comparison
    const normalizedChartPath = path.normalize(chartBasePath);
    const normalizedFilePath = path.normalize(filePath);
    
    log.info(`[testPathHandling] Path analysis:
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
      
      log.info(`[testPathHandling] Found ${allMatches.length} occurrences of chartPath in filePath`);
      
      if (allMatches.length > 1) {
        // Multiple occurrences means we have duplication - take everything after the last match
        const lastMatchIndex = allMatches[allMatches.length - 1];
        relativePath = normalizedFilePath.substring(lastMatchIndex + normalizedChartPath.length);
        log.info(`[testPathHandling] Multiple occurrences detected - extracted path after last match: ${relativePath}`);
      } else if (allMatches.length === 1) {
        // Single occurrence - normal case, extract the path after the chart path
        relativePath = normalizedFilePath.substring(allMatches[0] + normalizedChartPath.length);
        log.info(`[testPathHandling] Single occurrence - extracted path: ${relativePath}`);
      }
    }
    
    // If no relative path extracted yet, use standard handling
    if (!relativePath) {
      if (normalizedFilePath.startsWith(normalizedChartPath)) {
        // Extract just the relative part by removing the chart base path
        relativePath = normalizedFilePath.substring(normalizedChartPath.length);
        log.info(`[testPathHandling] Path starts with chart base path, extracted relative part: ${relativePath}`);
      } else {
        // Treat as a relative path, just remove any leading slashes
        relativePath = normalizedFilePath.replace(/^\/+/, '');
        log.info(`[testPathHandling] Using as relative path: ${relativePath}`);
      }
    }
    
    // Ensure no leading slash for proper path joining
    relativePath = relativePath.replace(/^\/+/, '');
    
    // Join paths correctly to create the full absolute path
    const fullFilePath = path.join(normalizedChartPath, relativePath);
    
    log.info(`[testPathHandling] RESULT:
      chartBasePath: ${chartBasePath}
      filePath: ${filePath}
      relativePath: ${relativePath}
      fullFilePath: ${fullFilePath}
    `);
    
    return fullFilePath;
  } catch (error) {
    log.error(`[testPathHandling] Error testing path handling: ${error}`);
    throw error;
  }
}

/**
 * Command handler to test path handling logic
 * @param workspaceId The workspace ID
 */
export async function testPathResolution(workspaceId: string): Promise<void> {
  try {
    log.info(`[testPathResolution] Testing path resolution for workspace: ${workspaceId}`);
    
    // Get workspace module
    const workspaceModule = await import('../workspace');
    
    // Get the chart path from workspace mapping
    const mapping = await workspaceModule.getWorkspaceMapping(workspaceId);
    
    if (!mapping || !mapping.localPath) {
      const errorMsg = `Could not find chart path for workspace ${workspaceId}`;
      log.error(`[testPathResolution] ${errorMsg}`);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }
    
    // The chart base path
    const chartBasePath = mapping.localPath;
    
    // Test different path scenarios
    const testPaths = [
      // Normal case
      `${chartBasePath}/test-file.yaml`,
      
      // Duplicated path case
      `${chartBasePath}/${chartBasePath}/test-file.yaml`,
      
      // Multiple duplications
      `${chartBasePath}/${chartBasePath}/${chartBasePath}/test-file.yaml`,
      
      // Relative path
      'test-file.yaml',
      
      // Path with leading slash
      '/test-file.yaml',
      
      // The problematic path from the user's example
      `/Users/diamonwiggins/go/src/github.com/replicatedhq/platform-examples/applications/mlflow/charts/mlflow/Users/diamonwiggins/go/src/github.com/replicatedhq/platform-examples/mock-test-1.yaml`
    ];
    
    // Run the tests
    const results = [];
    
    for (const testPath of testPaths) {
      try {
        const result = testPathHandling(chartBasePath, testPath);
        results.push({
          input: testPath,
          output: result,
          success: true
        });
      } catch (error) {
        results.push({
          input: testPath,
          error: `${error}`,
          success: false
        });
      }
    }
    
    // Log the results
    log.info(`[testPathResolution] Test results:\n${JSON.stringify(results, null, 2)}`);
    
    // Show results to user
    vscode.window.showInformationMessage(
      `Path resolution tests completed. Check the output in the extension log.`,
      { detail: results.map(r => `${r.input} => ${r.success ? r.output : r.error}`).join('\n'), modal: false }
    );
    
  } catch (error) {
    log.error(`[testPathResolution] Error testing path resolution: ${error}`);
    vscode.window.showErrorMessage(`Error testing path resolution: ${error}`);
  }
} 