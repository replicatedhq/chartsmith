"use server";

import { cookies } from 'next/headers';
import { findSession } from './session';
import { getTestAuthTokenFromHeaders, validateTestAuthToken, isTestAuthBypassEnabled } from './test-auth-bypass';
import { Session } from '../types/session';

/**
 * Get session from request - supports multiple auth methods:
 * 1. Test auth bypass header (test mode only)
 * 2. Session cookie (web)
 * 3. Authorization Bearer token (extension)
 * 
 * Use this in server actions and API routes that need authentication.
 * 
 * @param headers Optional headers object. Supports Headers, ReadonlyHeaders (from next/headers), or plain objects.
 */
export async function getSessionFromRequest(headers?: { get: (name: string) => string | null } | Record<string, string | string[] | undefined>): Promise<Session | undefined> {
  // TEST AUTH BYPASS: Check for test auth header first (only in test mode)
  if (isTestAuthBypassEnabled() && headers) {
    const testAuthToken = getTestAuthTokenFromHeaders(headers);
    if (testAuthToken) {
      const authResult = await validateTestAuthToken(testAuthToken);
      if (authResult) {
        const session = await findSession(authResult.token);
        if (session) {
          return session;
        }
      }
    }
  }
  
  // Try session cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (sessionToken) {
    const session = await findSession(sessionToken);
    if (session) {
      return session;
    }
  }
  
  // Try Authorization header (if headers provided)
  if (headers) {
    // Handle Headers/ReadonlyHeaders (both have .get() method) or plain object
    let authHeader: string | null | undefined;
    if (headers && typeof headers === 'object' && 'get' in headers && typeof headers.get === 'function') {
      authHeader = headers.get('authorization');
    } else {
      const authHeaderValue = (headers as Record<string, string | string[] | undefined>)['authorization'];
      authHeader = Array.isArray(authHeaderValue) ? authHeaderValue[0] : authHeaderValue;
    }
    
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = await findSession(token);
      if (session) {
        return session;
      }
    }
  }
  
  return undefined;
}
