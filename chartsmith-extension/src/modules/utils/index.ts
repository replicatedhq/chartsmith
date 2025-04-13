import * as fs from 'fs';
import * as path from 'path';

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function deleteFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function constructApiUrl(basePath: string, endpoint: string): string {
  // Only enforce HTTPS for non-localhost URLs
  let base = basePath;
  try {
    const url = new URL(base);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    
    if (!isLocalhost && base.startsWith('http:')) {
      base = base.replace('http:', 'https:');
    }
  } catch (error) {
    // If URL parsing fails, keep the original base path
    console.error('Error parsing URL:', error);
  }
  
  if (base.endsWith('/')) {
    base = base.slice(0, -1);
  }
  
  let path = endpoint;
  if (path.startsWith('/')) {
    path = path.slice(1);
  }
  
  // Use exactly the path provided
  return `${base}/${path}`;
}

export function ensureDirectoryExists(dirPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdir(dirPath, { recursive: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function isHelmChart(dirPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const chartYamlPath = path.join(dirPath, 'Chart.yaml');
    fs.access(chartYamlPath, fs.constants.F_OK, (err) => {
      resolve(!err);
    });
  });
}