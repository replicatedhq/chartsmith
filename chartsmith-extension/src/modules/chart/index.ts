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
    // Use the exact URL from the original implementation
    const uploadUrl = `${authData.apiEndpoint}/upload-chart`;
    console.log(`Uploading chart to: ${uploadUrl}`);
    
    // Upload the chart with the correct field name 'file'
    const result = await uploadFile(
      authData,
      'upload-chart', // Use the exact endpoint from the original
      chartTarball,
      'file'  // Field name for the file - must match server expectation
    );
    
    // Clean up the temporary tarball
    await deleteFile(chartTarball);
    
    // Set the workspace ID from the response
    if (result && result.workspaceId) {
      const workspace = await import('../workspace');
      await workspace.setActiveWorkspaceId(result.workspaceId);
    } else {
      console.error('No workspaceId received from server');
    }
    
    return result;
  } catch (error) {
    // Clean up even on error
    try {
      await deleteFile(chartTarball);
    } catch (cleanupError) {
      console.error('Error cleaning up temporary chart file:', cleanupError);
    }
    
    throw error;
  }
}