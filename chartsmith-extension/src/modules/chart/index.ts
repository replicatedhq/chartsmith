import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import { AuthData } from '../../types';
import { isHelmChart, ensureDirectoryExists, deleteFile } from '../utils';
import { uploadFile } from '../api';

export async function findHelmChartDirectories(rootDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const helmChartDirs: string[] = [];
    
    fs.readdir(rootDir, { withFileTypes: true }, async (err, entries) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        // Process each directory entry
        for (const entry of entries) {
          const fullPath = path.join(rootDir, entry.name);
          
          // Skip node_modules, .git directories, etc.
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }
          
          if (entry.isDirectory()) {
            // Check if this directory is a Helm chart
            if (await isHelmChart(fullPath)) {
              helmChartDirs.push(fullPath);
            } else {
              // Recursively scan subdirectories
              const subDirs = await findHelmChartDirectories(fullPath);
              helmChartDirs.push(...subDirs);
            }
          }
        }
        
        resolve(helmChartDirs);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function createChartTarball(chartDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create a temporary directory
    const tempDir = path.join(os.tmpdir(), 'chartsmith-tmp');
    
    ensureDirectoryExists(tempDir)
      .then(() => {
        const chartName = path.basename(chartDir);
        const outputFile = path.join(tempDir, `${chartName}.tgz`);
        
        // Change to parent directory for proper relative paths in tar
        const parentDir = path.dirname(chartDir);
        const directoryToTar = path.basename(chartDir);
        
        // Use tar to create archive
        const tarProcess = child_process.spawn('tar', [
          '-czf',           // Create gzipped tar
          outputFile,       // Output file
          '-C', parentDir,  // Change to parent directory
          directoryToTar    // Directory to tar (now relative to parentDir)
        ]);
        
        let stderr = '';
        tarProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        tarProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Failed to create chart tarball: ${stderr}`));
            return;
          }
          
          resolve(outputFile);
        });
      })
      .catch(reject);
  });
}

export async function uploadChartToServer(
  authData: AuthData,
  chartTarball: string
): Promise<any> {
  try {
    // Debug log authentication state
    console.log(`[DEBUG] ===== CHART UPLOAD STARTED =====`);
    
    // Check if authentication data is valid before proceeding
    if (!authData || !authData.token || !authData.apiEndpoint) {
      console.error(`[DEBUG] Missing required authentication data:`);
      console.error(`[DEBUG] - API Endpoint: ${authData?.apiEndpoint ? 'Present' : 'Missing'}`);
      console.error(`[DEBUG] - Token: ${authData?.token ? 'Present' : 'Missing'}`);
      console.error(`[DEBUG] - User ID: ${authData?.userId ? 'Present' : 'Missing'}`);
      throw new Error('Authentication required: Please login before uploading a chart');
    }
    
    // Check token validity before upload (but don't let it block the upload if it fails)
    try {
      const auth = await import('../auth');
      
      // Verify session validity before proceeding
      console.log(`[DEBUG] Verifying session before upload...`);
      let sessionValid = await auth.verifySession();
      
      if (!sessionValid) {
        console.log(`[DEBUG] ⚠️ Session verification failed - attempting to refresh...`);
        
        // Try to refresh the session
        const refreshed = await auth.refreshSession();
        if (refreshed) {
          console.log(`[DEBUG] 🔄 Session refreshed successfully, verifying again...`);
          sessionValid = await auth.verifySession();
          if (sessionValid) {
            console.log(`[DEBUG] ✅ Session verified after refresh`);
          } else {
            console.log(`[DEBUG] ❌ Session still invalid after refresh`);
          }
        } else {
          console.log(`[DEBUG] ❌ Session refresh failed`);
        }
      } else {
        console.log(`[DEBUG] ✅ Session verified successfully`);
      }
      
      await auth.debugCheckTokenValidity();
    } catch (tokenError) {
      console.error(`[DEBUG] Token validation error, continuing anyway:`, tokenError);
      // Continue with upload attempt despite token validation error
    }
    
    console.log(`[DEBUG] Authentication data check:`, {
      apiEndpoint: authData.apiEndpoint,
      hasToken: !!authData.token,
      tokenLength: authData.token ? authData.token.length : 0,
      userId: authData.userId,
      chartTarballPath: chartTarball,
      chartTarballExists: await new Promise(resolve => {
        try {
          fs.access(chartTarball, fs.constants.F_OK, err => resolve(!err));
        } catch (error) {
          console.error(`[DEBUG] Error checking file existence:`, error);
          resolve(false);
        }
      })
    });

    // Test if the API endpoint is reachable with a simple HEAD request
    try {
      const testUrl = new URL(authData.apiEndpoint);
      const isHttps = testUrl.protocol === 'https:';
      const requestModule = isHttps ? require('https') : require('http');
      
      await new Promise((resolve, reject) => {
        const req = requestModule.request(
          authData.apiEndpoint,
          { method: 'HEAD' },
          (res: { statusCode: number }) => {
            console.log(`[DEBUG] API endpoint test result: status=${res.statusCode}`);
            resolve(res.statusCode);
          }
        );
        
        req.on('error', (error: Error) => {
          console.error(`[DEBUG] API endpoint test error:`, error);
          reject(error);
        });
        
        req.end();
      });
    } catch (error) {
      console.error(`[DEBUG] Failed to reach API endpoint:`, error);
      // Continue with upload attempt anyway
    }

    // Use the exact URL from the original implementation
    const uploadUrl = `${authData.apiEndpoint}/upload-chart`;
    console.log(`[DEBUG] Uploading chart to: ${uploadUrl}`);
    
    // Upload the chart with the correct field name 'file'
    const result = await uploadFile(
      authData,
      'upload-chart', // Use the exact endpoint from the original
      chartTarball,
      'file'  // Field name for the file - must match server expectation
    );
    
    console.log(`[DEBUG] Upload result:`, result);
    
    // Clean up the temporary tarball
    await deleteFile(chartTarball);
    console.log(`[DEBUG] Cleaned up temporary tarball: ${chartTarball}`);
    
    // Set the workspace ID from the response
    if (result && result.workspaceId) {
      console.log(`[DEBUG] Workspace ID from response: ${result.workspaceId}`);
      const workspace = await import('../workspace');
      await workspace.setActiveWorkspaceId(result.workspaceId);
      console.log(`[DEBUG] Set active workspace ID to: ${result.workspaceId}`);
    } else {
      console.error('[DEBUG] No workspaceId received from server');
    }
    
    console.log(`[DEBUG] ===== CHART UPLOAD COMPLETED =====`);
    return result;
  } catch (error) {
    console.error(`[DEBUG] ===== CHART UPLOAD FAILED =====`);
    console.error(`[DEBUG] Error during chart upload:`, error);
    
    // Clean up even on error
    try {
      await deleteFile(chartTarball);
      console.log(`[DEBUG] Cleaned up temporary chart file on error`);
    } catch (cleanupError) {
      console.error('[DEBUG] Error cleaning up temporary chart file:', cleanupError);
    }
    
    throw error;
  }
}

// Test function for debugging token issues
export async function testToken(): Promise<void> {
  console.log(`[DEBUG] ===== TOKEN TEST STARTED =====`);
  try {
    const auth = await import('../auth');
    
    // Get token from storage
    const token = await auth.getAuthToken();
    console.log(`[DEBUG] Token exists: ${!!token}`);
    
    if (token) {
      console.log(`[DEBUG] Token length: ${token.length}`);
      console.log(`[DEBUG] Token prefix: ${token.substring(0, Math.min(10, token.length))}...`);
      
      // Try to decode
      try {
        const decoded = auth.decodeJwt(token);
        console.log(`[DEBUG] Token decoded: ${!!decoded}`);
        
        if (decoded) {
          console.log(`[DEBUG] Decoded token contents:`, {
            sub: decoded.sub,
            exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'none',
            iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'none'
          });
        }
      } catch (decodeError) {
        console.error(`[DEBUG] Token decode failed:`, decodeError);
      }
    }
    
    // Test API endpoint
    const apiEndpoint = await auth.getApiEndpoint();
    console.log(`[DEBUG] API endpoint: ${apiEndpoint || 'none'}`);
    
    console.log(`[DEBUG] ===== TOKEN TEST COMPLETED =====`);
  } catch (error) {
    console.error(`[DEBUG] ===== TOKEN TEST FAILED =====`, error);
  }
}