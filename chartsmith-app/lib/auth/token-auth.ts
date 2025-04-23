import { userIdFromExtensionToken } from './extension-token';

/**
 * Extracts and validates a bearer token from the request
 * @param request The request object
 * @returns The user ID if valid, null otherwise
 */
export async function validateBearerToken(request: Request): Promise<string | null> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token auth: No valid Authorization header found');
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate token and get user ID
    const userId = await userIdFromExtensionToken(token);
    if (!userId) {
      console.log('Token auth: Invalid or expired token');
      return null;
    }

    return userId;
  } catch (error) {
    console.error('Error validating bearer token:', error);
    return null;
  }
} 