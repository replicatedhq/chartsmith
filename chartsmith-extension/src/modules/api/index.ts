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