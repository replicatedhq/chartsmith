import { findSession } from "./session";
import { validateTestAuth } from "./actions/test-auth";
import { logger } from "../utils/logger";

/**
 * Test Auth Bypass - Only works when ENABLE_TEST_AUTH is true
 * 
 * This allows Playwright tests to authenticate without dealing with cookies.
 * Uses a special header: X-Test-Auth-Token
 * 
 * NEVER works in production - multiple safety checks ensure this.
 */

const TEST_AUTH_HEADER = 'X-Test-Auth-Token';

/**
 * Check if test auth bypass is enabled
 */
export function isTestAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (process.env.ENABLE_TEST_AUTH === 'true' || process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true')
  );
}

/**
 * Validate a test auth token from header
 * Returns session if valid, undefined otherwise
 */
export async function validateTestAuthToken(token: string | null): Promise<{ sessionId: string; token: string } | null> {
  // Safety check: Never work in production
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Test auth bypass attempted in production - rejected');
    return null;
  }

  // Safety check: Must have test auth enabled
  if (!isTestAuthBypassEnabled()) {
    logger.warn('Test auth bypass attempted but not enabled - rejected');
    return null;
  }

  if (!token) {
    return null;
  }

  // If token is "auto", generate a new test session
  if (token === 'auto') {
    try {
      const jwt = await validateTestAuth();
      // Extract session ID from token (test-token-{sessionId}-{timestamp})
      const match = jwt.match(/^test-token-([^-]+)-/);
      if (match) {
        return {
          sessionId: match[1],
          token: jwt,
        };
      }
    } catch (error) {
      logger.error('Failed to generate test auth token', { error });
      return null;
    }
  }

  // Otherwise, validate the provided token
  const session = await findSession(token);
  if (session) {
    // Extract session ID from token
    const match = token.match(/^test-token-([^-]+)-/);
    if (match) {
      return {
        sessionId: match[1],
        token: token,
      };
    }
  }

  return null;
}

/**
 * Get test auth token from request headers
 * Supports: Headers, ReadonlyHeaders (from next/headers), and plain objects
 */
export function getTestAuthTokenFromHeaders(headers: Headers | Record<string, string | string[] | undefined> | { get: (name: string) => string | null }): string | null {
  // Handle Headers object (Web API) or ReadonlyHeaders (Next.js) - both have .get() method
  if (headers && typeof headers === 'object' && 'get' in headers && typeof headers.get === 'function') {
    return headers.get(TEST_AUTH_HEADER);
  }
  
  // Handle plain object
  const headerValue = (headers as Record<string, string | string[] | undefined>)[TEST_AUTH_HEADER] || 
                      (headers as Record<string, string | string[] | undefined>)[TEST_AUTH_HEADER.toLowerCase()];
  if (Array.isArray(headerValue)) {
    return headerValue[0] || null;
  }
  return headerValue || null;
}

export { TEST_AUTH_HEADER };
