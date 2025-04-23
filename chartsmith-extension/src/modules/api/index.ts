import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { AuthData } from '../../types';
import { constructApiUrl } from '../utils';
import * as vscode from 'vscode';
import * as path from 'path';

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
        console.error('fetchApi: authData is null or undefined');
        return reject(new Error('Invalid auth data: authData is null or undefined'));
      }
      
      if (!authData.apiEndpoint) {
        console.error('fetchApi: authData.apiEndpoint is null or undefined');
        return reject(new Error('Invalid auth data: apiEndpoint is missing'));
      }
      
      if (!authData.token && endpoint !== '/auth/status') {
        console.error('fetchApi: authData.token is null or undefined for non-auth endpoint');
        return reject(new Error('Invalid auth data: token is missing'));
      }
      
      // Construct the API URL
      const url = constructApiUrl(authData.apiEndpoint, endpoint);
      console.log(`API Request [${endpoint}]: ${method} ${url}`);
      console.log(`Auth token available for [${endpoint}]:`, !!authData.token);
      
      // Parse the URL to determine whether to use http or https module
      const parsedUrl = new URL(url);
      console.log(`Parsed URL for [${endpoint}]:`, {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        pathname: parsedUrl.pathname
      });
      
      const isHttps = parsedUrl.protocol === 'https:';
      const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      
      // Allow HTTP for localhost, require HTTPS for everything else
      if (!isHttps && !isLocalhost) {
        console.error(`Protocol "${parsedUrl.protocol}" not supported for non-localhost [${endpoint}]`);
        return reject(new Error(`Protocol "${parsedUrl.protocol}" not supported for non-localhost. Expected "https:"`));
      }
      
      // Use the appropriate module based on the protocol
      const requestModule = isHttps ? https : http;
      console.log(`Using ${isHttps ? 'HTTPS' : 'HTTP'} module for [${endpoint}]`);
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`,
          ...headers
        }
      };
      
      console.log(`API Request options for [${endpoint}]:`, { 
        method, 
        url,
        headers: Object.keys(options.headers) 
      });
      
      // Actually make the request
      console.log(`Creating request object for [${endpoint}]...`);
      const req = requestModule.request(url, options, (res) => {
        let data = '';
        console.log(`API Response started with status for [${endpoint}]: ${res.statusCode}`);
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`API Response completed for [${endpoint}] with status: ${res.statusCode}`);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsedData = data ? JSON.parse(data) : {};
              console.log(`API Response success for [${endpoint}], data received:`, typeof parsedData);
              resolve(parsedData);
            } catch (error) {
              console.error(`Invalid JSON response for [${endpoint}]:`, error);
              console.error(`Response data for [${endpoint}]:`, data);
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          } else {
            console.error(`HTTP error ${res.statusCode} for [${endpoint}]:`, data);
            reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Request error for [${endpoint}]:`, error);
        reject(error);
      });
      
      if (body) {
        console.log(`Request has body for [${endpoint}]`);
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      
      console.log(`Ending request for [${endpoint}]...`);
      req.end();
      console.log(`Request ended for [${endpoint}]`);
    } catch (error) {
      console.error(`Unexpected error in fetchApi for [${endpoint}]:`, error);
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
      // Debug log all auth data (except token)
      console.log(`[DEBUG] Upload file to endpoint: ${endpoint}`);
      console.log(`[DEBUG] Auth data available:`, {
        apiEndpoint: authData.apiEndpoint,
        pushEndpoint: authData.pushEndpoint || '(none)',
        wwwEndpoint: authData.wwwEndpoint || '(none)',
        userId: authData.userId,
        hasToken: !!authData.token,
        tokenLength: authData.token ? authData.token.length : 0
      });

      const url = constructApiUrl(authData.apiEndpoint, endpoint);
      console.log(`[DEBUG] Constructed upload URL: ${url}`);
      
      // Parse the URL to determine whether to use http or https module
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      
      console.log(`[DEBUG] URL parsing result:`, {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? '443' : '80'),
        pathname: parsedUrl.pathname,
        isLocalhost: isLocalhost
      });
      
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
      
      console.log(`[DEBUG] Request headers:`, {
        contentType: headers['Content-Type'],
        authorizationPresent: !!headers['Authorization'],
        authorizationPrefix: authData.token ? authData.token.substring(0, 10) + '...' : 'none'
      });
      
      const options = {
        method: 'POST',
        headers
      };
      
      console.log(`[DEBUG] Creating request with options:`, {
        method: options.method,
        url: url,
        headerKeys: Object.keys(options.headers)
      });

      const req = requestModule.request(url, options, (res) => {
        let data = '';
        
        console.log(`[DEBUG] Response status code: ${res.statusCode}`);
        console.log(`[DEBUG] Response headers:`, res.headers);
        
        // Check for redirects specifically
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          console.log(`[DEBUG] Detected redirect to: ${res.headers.location}`);
          if (res.headers.location?.includes('/login')) {
            console.log(`[DEBUG] AUTHENTICATION ERROR: Redirected to login page. Token may be invalid or expired.`);
          }
        }
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`[DEBUG] Response data length: ${data.length} bytes`);
          if (data.length < 1000) {
            console.log(`[DEBUG] Response data: ${data}`);
          } else {
            console.log(`[DEBUG] Response data truncated: ${data.substring(0, 500)}...`);
          }
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsedData = data ? JSON.parse(data) : {};
              console.log(`[DEBUG] Successfully parsed JSON response`);
              resolve(parsedData);
            } catch (error) {
              console.error(`[DEBUG] Invalid JSON response:`, error);
              console.error(`[DEBUG] Raw response data:`, data);
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          } else {
            console.error(`[DEBUG] HTTP error ${res.statusCode}`);
            reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`[DEBUG] Request error:`, error);
        reject(error);
      });
      
      // Add form fields
      Object.entries(additionalFields).forEach(([name, value]) => {
        console.log(`[DEBUG] Adding form field: ${name}`);
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
      console.log(`[DEBUG] Adding file: ${fileName} from ${filePath}`);
      
      req.write(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\n` +
        `Content-Type: application/octet-stream\r\n` +
        `\r\n`
      );
      
      fileStream.on('end', () => {
        console.log(`[DEBUG] File stream ended, completing request`);
        req.write(`\r\n--${boundary}--\r\n`);
        req.end();
      });
      
      fileStream.on('error', (error) => {
        console.error(`[DEBUG] File stream error:`, error);
        reject(error);
      });
      
      fileStream.pipe(req, { end: false });
    } catch (error) {
      console.error(`[DEBUG] Unexpected error in uploadFile:`, error);
      reject(error);
    }
  });
}

/**
 * Fetches the pending content for a specific file in a plan
 * 
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
      console.error('Cannot fetch file content: No auth data available');
      return null;
    }

    // Log the request details
    console.log(`Fetching pending content for file: ${filePath}`);
    console.log(`Workspace ID: ${workspaceId}, Plan ID: ${planId}`);
    
    // Encode the file path for URL safety
    const encodedFilePath = encodeURIComponent(filePath);
    
    // Make the API request to get file content
    const endpoint = `/workspace/${workspaceId}/plans/${planId}/file/${encodedFilePath}`;
    console.log(`API endpoint: ${endpoint}`);
    
    const response = await fetchApi(
      authData,
      endpoint,
      'GET'
    );
    
    // Extract and return the content
    if (response && response.content) {
      console.log(`Content retrieved successfully for ${filePath}`);
      return response.content;
    }
    
    console.error('File content response did not contain expected data:', response);
    return null;
  } catch (error) {
    console.error(`Error fetching file content for ${filePath}:`, error);
    return null;
  }
}

/**
 * Fetches the pending content for a file with a progress indicator
 * 
 * @param authData Authentication data
 * @param workspaceId The workspace ID
 * @param planId The plan ID
 * @param filePath The file path
 * @returns The pending content for the file or null if not found/cancelled
 */
export async function fetchPendingFileContentWithProgress(
  authData: AuthData,
  workspaceId: string,
  planId: string,
  filePath: string
): Promise<string | null> {
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Retrieving content for ${path.basename(filePath)}`,
    cancellable: true
  }, async (progress, token) => {
    progress.report({ increment: 0, message: 'Connecting to ChartSmith API...' });
    
    // Set up cancellation
    let cancelled = false;
    token.onCancellationRequested(() => {
      cancelled = true;
      console.log('Content retrieval was cancelled by user');
    });
    
    try {
      progress.report({ increment: 30, message: 'Fetching file content...' });
      
      if (cancelled) {
        return null;
      }
      
      const content = await fetchPendingFileContent(authData, workspaceId, planId, filePath);
      
      if (cancelled) {
        return null;
      }
      
      progress.report({ increment: 70, message: 'Content retrieved' });
      return content;
    } catch (error: any) {
      console.error(`Error fetching content with progress: ${error}`);
      
      // Create error message
      let message = `Could not retrieve content for ${filePath}`;
      
      if (error?.message?.includes('401')) {
        message += ': Authentication failed. Please log in again.';
      } else if (error?.message?.includes('404')) {
        message += ': File not found in the plan.';
      } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
        message += ': Cannot connect to ChartSmith API. Please check your network connection.';
      } else {
        message += `: ${error?.message || 'Unknown error'}`;
      }
      
      vscode.window.showErrorMessage(message);
      return null;
    }
  });
}