import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { AuthData } from '../../types';
import { constructApiUrl } from '../utils';
import * as vscode from 'vscode';
import * as path from 'path';
import { log } from '../logging';

export async function fetchApi(
  authData: AuthData,
  endpoint: string,
  method: string = 'GET',
  body?: any,
  headers: Record<string, string> = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Validate auth data
      if (!authData) {
        log.error('fetchApi: authData is null or undefined');
        return reject(new Error('Invalid auth data: authData is null or undefined'));
      }
      
      if (!authData.apiEndpoint) {
        log.error('fetchApi: authData.apiEndpoint is null or undefined');
        return reject(new Error('Invalid auth data: apiEndpoint is missing'));
      }
      
      if (!authData.token && endpoint !== '/auth/status') {
        log.error('fetchApi: authData.token is null or undefined for non-auth endpoint');
        return reject(new Error('Invalid auth data: token is missing'));
      }
      
      // Construct the API URL with the endpoint path directly
      // The API endpoint already includes the /api suffix as per standardization
      const url = constructApiUrl(authData.apiEndpoint, endpoint);
      
      log.debug(`Making API request to: ${url}`);
      
      // Parse the URL to determine whether to use http or https module
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      
      // Allow HTTP for localhost, require HTTPS for everything else
      if (!isHttps && !isLocalhost) {
        log.error(`Protocol "${parsedUrl.protocol}" not supported for non-localhost [${endpoint}]`);
        return reject(new Error(`Protocol "${parsedUrl.protocol}" not supported for non-localhost. Expected "https:"`));
      }
      
      // Use the appropriate module based on the protocol
      const requestModule = isHttps ? https : http;
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`,
          ...headers
        }
      };
      
      // Actually make the request
      const req = requestModule.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsedData = data ? JSON.parse(data) : {};
              resolve(parsedData);
            } catch (error) {
              log.error(`Invalid JSON response for [${endpoint}]: ${error}`);
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          } else if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
            // Handle redirects specifically
            if (res.headers.location?.includes('/login')) {
              log.error(`Authentication error: Redirected to login page. Token may be invalid or expired.`);
              reject(new Error(`HTTP error ${res.statusCode}: ${res.headers.location}`));
            } else {
              log.error(`Redirect error ${res.statusCode} for [${endpoint}] to ${res.headers.location}`);
              reject(new Error(`HTTP error ${res.statusCode}: Redirected to ${res.headers.location}`));
            }
          } else {
            log.error(`HTTP error ${res.statusCode} for [${endpoint}]: ${data}`);
            reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        log.error(`Request error for [${endpoint}]: ${error}`);
        reject(error);
      });
      
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      
      req.end();
    } catch (error) {
      log.error(`Unexpected error in fetchApi for [${endpoint}]: ${error}`);
      reject(error);
    }
  });
}

export async function uploadFile(
  authData: AuthData,
  endpoint: string,
  filePath: string,
  fileFieldName: string = 'file',
  additionalFields: Record<string, string> = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const url = constructApiUrl(authData.apiEndpoint, endpoint);
      
      // Parse the URL to determine whether to use http or https module
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      
      // Allow HTTP for localhost, require HTTPS for everything else
      if (!isHttps && !isLocalhost) {
        return reject(new Error(`Protocol "${parsedUrl.protocol}" not supported for non-localhost. Expected "https:"`));
      }
      
      // Use the appropriate module based on the protocol
      const requestModule = isHttps ? https : http;
      
      const boundary = `----WebKitFormBoundary${Math.random().toString(16).substr(2)}`;
      const headers = {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': `Bearer ${authData.token}`
      };
      
      const options = {
        method: 'POST',
        headers
      };

      const req = requestModule.request(url, options, (res) => {
        let data = '';
        
        // Check for redirects specifically
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          if (res.headers.location?.includes('/login')) {
            log.error(`Authentication error: Redirected to login page. Token may be invalid or expired.`);
            reject(new Error(`HTTP error ${res.statusCode}: Redirected to login page. Token may be invalid or expired.`));
            return;
          } else {
            log.error(`Redirect error ${res.statusCode} to ${res.headers.location}`);
            reject(new Error(`HTTP error ${res.statusCode}: Redirected to ${res.headers.location}`));
            return;
          }
        }
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsedData = data ? JSON.parse(data) : {};
              resolve(parsedData);
            } catch (error) {
              console.error(`Invalid JSON response:`, error);
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          } else {
            console.error(`HTTP error ${res.statusCode}`);
            reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Request error:`, error);
        reject(error);
      });
      
      // Add form fields
      Object.entries(additionalFields).forEach(([name, value]) => {
        req.write(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${name}"\r\n` +
          `\r\n` +
          `${value}\r\n`
        );
      });
      
      // Add file
      const fileStream = fs.createReadStream(filePath);
      const fileName = filePath.split('/').pop() || 'file';
      
      req.write(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\n` +
        `Content-Type: application/octet-stream\r\n` +
        `\r\n`
      );
      
      fileStream.on('end', () => {
        req.write(`\r\n--${boundary}--\r\n`);
        req.end();
      });
      
      fileStream.on('error', (error) => {
        console.error(`File stream error:`, error);
        reject(error);
      });
      
      fileStream.pipe(req, { end: false });
    } catch (error) {
      console.error(`Unexpected error in uploadFile:`, error);
      reject(error);
    }
  });
}

/**
 * Fetches the pending content for a specific file in a plan
 * 
 * @deprecated This function will be removed in a future version. Use the workspace module's getPendingFileContent instead.
 * @param authData Authentication data
 * @param workspaceId The workspace ID
 * @param planId The plan ID
 * @param filePath The file path
 * @returns The pending content for the file or null if not found
 */
export async function fetchPendingFileContent(
  authData: AuthData,
  workspaceId: string, 
  planId: string, 
  filePath: string
): Promise<string | null> {
  try {
    if (!authData) {
      console.error('[fetchPendingFileContent] Cannot fetch file content: No auth data available');
      return null;
    }
    
    if (!workspaceId || !filePath) {
      console.error(`[fetchPendingFileContent] Invalid parameters: workspaceId=${workspaceId}, filePath=${filePath}`);
      return null;
    }

    console.log(`[fetchPendingFileContent] Fetching content for ${filePath} via workspace endpoint`);

    // Make the API request to get workspace data
    const endpoint = `/workspace/${workspaceId}`;
    
    let workspace;
    try {
      workspace = await fetchApi(
        authData,
        endpoint,
        'GET'
      );
      
      console.log(`[fetchPendingFileContent] Workspace data received: ${workspace ? 'yes' : 'no'}`);
    } catch (error) {
      console.error(`[fetchPendingFileContent] Error fetching workspace data: ${error}`);
      return null;
    }
    
    if (!workspace) {
      console.error('[fetchPendingFileContent] Failed to fetch workspace data');
      return null;
    }

    // Check if the file exists in workspace charts
    if (workspace.charts && Array.isArray(workspace.charts) && workspace.charts.length > 0) {
      console.log(`[fetchPendingFileContent] Searching in ${workspace.charts.length} charts`);
      
      for (const chart of workspace.charts) {
        if (chart.files && Array.isArray(chart.files)) {
          const file = chart.files.find((f: { filePath: string; contentPending: string | null }) => f.filePath === filePath);
          if (file && file.contentPending !== null) {
            console.log(`[fetchPendingFileContent] Found content in workspace charts for ${filePath}`);
            return file.contentPending;
          }
        }
      }
    } else {
      console.log('[fetchPendingFileContent] No charts found in workspace data');
    }
    
    // Check if the file exists in loose files
    if (workspace.files && Array.isArray(workspace.files) && workspace.files.length > 0) {
      console.log(`[fetchPendingFileContent] Searching in ${workspace.files.length} loose files`);
      
      const file = workspace.files.find((f: { filePath: string; contentPending: string | null }) => f.filePath === filePath);
      if (file && file.contentPending !== null) {
        console.log(`[fetchPendingFileContent] Found content in workspace loose files for ${filePath}`);
        return file.contentPending;
      }
    } else {
      console.log('[fetchPendingFileContent] No loose files found in workspace data');
    }
    
    console.log(`[fetchPendingFileContent] No pending content found for ${filePath} in workspace`);
    return null;
  } catch (error) {
    console.error(`[fetchPendingFileContent] Error fetching workspace data for file ${filePath}:`, error);
    return null;
  }
}

// Export any other functions that might be needed (not currently shown in this section)