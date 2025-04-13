import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { AuthData } from '../../types';
import { constructApiUrl } from '../utils';

export async function fetchApi(
  authData: AuthData,
  endpoint: string,
  method: string = 'GET',
  body?: any,
  headers: Record<string, string> = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = constructApiUrl(authData.apiEndpoint, endpoint);
    console.log(`API Request: ${method} ${url}`);
    console.log('Auth token available:', !!authData.token);
    
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
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.token}`,
        ...headers
      }
    };
    
    console.log('API Request options:', { method, url });
    
    const req = requestModule.request(url, options, (res) => {
      let data = '';
      console.log(`API Response started with status: ${res.statusCode}`);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        } else {
          reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    
    req.end();
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
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        } else {
          reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
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
      reject(error);
    });
    
    fileStream.pipe(req, { end: false });
  });
}