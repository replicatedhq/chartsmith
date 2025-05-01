import { AuthData } from '../types';

/**
 * Pass-through function that returns the API endpoint unchanged
 * 
 * @param apiEndpoint The API endpoint
 * @returns The API endpoint unchanged
 */
export function deriveApiEndpoint(apiEndpoint: string): string {
  return apiEndpoint || '';
}

/**
 * Derives the WWW endpoint from the API endpoint
 * 
 * @param apiEndpoint The API endpoint (e.g., https://chartsmith.ai/api)
 * @returns The WWW endpoint (same as API endpoint but without /api path)
 */
export function deriveWwwEndpoint(apiEndpoint: string): string {
  if (!apiEndpoint) {
    return '';
  }
  
  try {
    const url = new URL(apiEndpoint);
    
    // If the path ends with /api or is /api, remove it
    if (url.pathname === '/api' || url.pathname.endsWith('/api')) {
      url.pathname = url.pathname.replace(/\/api\/?$/, '/');
    }
    
    // Ensure pathname ends with a slash if it's just the root
    if (url.pathname === '') {
      url.pathname = '/';
    }
    
    return url.toString();
  } catch (error) {
    console.error(`Error deriving WWW endpoint from ${apiEndpoint}:`, error);
    return apiEndpoint; // Return original as fallback
  }
}

/**
 * Derives the Push endpoint from the WWW endpoint
 * 
 * @param apiEndpoint The API endpoint
 * @returns The Push endpoint with appropriate WebSocket protocol
 */
export function derivePushEndpoint(apiEndpoint: string): string {
  if (!apiEndpoint) {
    return '';
  }

  try {
    // First derive WWW endpoint from API endpoint
    const wwwEndpoint = deriveWwwEndpoint(apiEndpoint);
    const url = new URL(wwwEndpoint);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    
    // Port handling logic for Centrifugo
    if (isLocalhost) {
      // For localhost development:
      // 1. If port is 3000 (standard API port), use 8000 for Centrifugo
      // 2. If no port specified, default to 8000 for Centrifugo
      // 3. If any other port explicitly specified, keep it (allows custom port configurations)
      if (!url.port || url.port === '3000') {
        url.port = '8000';  // Default Centrifugo port for local dev
      }
      // Otherwise, keep the explicitly specified port
    }
    
    // Convert http: to ws: and https: to wss:
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Ensure the correct path for WebSocket connection
    // For Centrifugo, we need /connection/websocket
    url.pathname = '/connection/websocket';
    
    return url.toString();
  } catch (error) {
    console.error(`Error deriving push endpoint from ${apiEndpoint}:`, error);
    return '';
  }
}

/**
 * Creates a complete AuthData object with derived endpoints
 * 
 * @param token The auth token
 * @param userId The user ID
 * @param apiEndpoint The API endpoint (primary)
 * @returns A complete AuthData object with derived endpoints
 */
export function createAuthDataWithDerivedEndpoints(
  token: string,
  userId: string,
  apiEndpoint: string
): AuthData {
  return {
    token,
    userId,
    apiEndpoint,
    wwwEndpoint: deriveWwwEndpoint(apiEndpoint),
    pushEndpoint: derivePushEndpoint(apiEndpoint)
  };
}

/**
 * Updates an existing AuthData object with derived endpoints
 * 
 * @param authData Existing AuthData object
 * @returns Updated AuthData with derived endpoints or null if input is null
 */
export function updateWithDerivedEndpoints(authData: AuthData | null): AuthData | null {
  if (!authData) {
    return null;
  }
  
  return {
    ...authData,
    wwwEndpoint: deriveWwwEndpoint(authData.apiEndpoint),
    pushEndpoint: derivePushEndpoint(authData.apiEndpoint)
  };
}

/**
 * Processes an API endpoint for security (enforces HTTPS for non-localhost)
 * 
 * @param apiEndpoint The original API endpoint
 * @returns The processed API endpoint with HTTPS enforced for non-localhost
 */
export function processApiEndpoint(apiEndpoint: string): string {
  if (!apiEndpoint) {
    return apiEndpoint;
  }
  
  try {
    const url = new URL(apiEndpoint);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    
    // Enforce HTTPS for non-localhost
    if (!isLocalhost && url.protocol === 'http:') {
      url.protocol = 'https:';
      return url.toString();
    }
    
    // Return the original if no changes needed
    return apiEndpoint;
  } catch (error) {
    console.error(`Error processing API endpoint ${apiEndpoint}:`, error);
    return apiEndpoint;
  }
}

/**
 * @deprecated Use processApiEndpoint instead.
 */
export function processBaseEndpoint(baseEndpoint: string): string {
  return processApiEndpoint(baseEndpoint);
} 