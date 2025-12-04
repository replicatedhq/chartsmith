/**
 * Shared utilities for AI SDK tools
 * 
 * Provides the callGoEndpoint function used by tools that need to communicate
 * with the Go HTTP backend for tool execution.
 */

// Default Go backend URL (can be overridden via environment variable)
const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';

/**
 * Error response from Go backend
 */
export interface GoErrorResponse {
  success: false;
  message: string;
  code?: string;
}

/**
 * Generic success response from Go backend
 */
export interface GoSuccessResponse<T = unknown> {
  success: true;
  [key: string]: T | boolean;
}

/**
 * Call a Go HTTP endpoint for tool execution
 * 
 * @param endpoint - The API endpoint path (e.g., '/api/tools/editor')
 * @param body - The request body to send
 * @param authHeader - Optional authorization header to forward
 * @returns The parsed JSON response from the Go backend
 * @throws Error if the request fails or returns an error response
 */
export async function callGoEndpoint<T>(
  endpoint: string,
  body: Record<string, unknown>,
  authHeader?: string
): Promise<T> {
  const url = `${GO_BACKEND_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    // Check if response indicates an error
    if (!response.ok) {
      const errorData = data as GoErrorResponse;
      throw new Error(errorData.message || `HTTP ${response.status}: Request failed`);
    }
    
    return data as T;
  } catch (error) {
    // Re-throw if it's already our error
    if (error instanceof Error) {
      throw error;
    }
    
    // Wrap unexpected errors
    throw new Error(`Failed to call Go endpoint ${endpoint}: ${String(error)}`);
  }
}

/**
 * Type guard to check if a response indicates success
 */
export function isSuccessResponse<T>(
  response: GoSuccessResponse<T> | GoErrorResponse
): response is GoSuccessResponse<T> {
  return response.success === true;
}

