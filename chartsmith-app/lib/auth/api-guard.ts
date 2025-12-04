import { NextRequest } from 'next/server';
import { findSession } from '@/lib/auth/session';

// Validate INTERNAL_API_KEY is set in production at startup
// This prevents silent failures where internal API auth would never work
if (process.env.NODE_ENV === 'production' && !process.env.INTERNAL_API_KEY) {
  throw new Error(
    'INTERNAL_API_KEY environment variable is required in production. ' +
    'Generate one with: openssl rand -hex 32'
  );
}

export async function checkApiAuth(req: NextRequest) {
  const internalApiKey = req.headers.get('x-internal-api-key');
  
  // Validate internal API key if provided
  // Note: In production, process.env.INTERNAL_API_KEY is guaranteed to be set (checked at startup)
  if (internalApiKey && internalApiKey === process.env.INTERNAL_API_KEY) {
    return { isAuthorized: true, isInternal: true };
  }

  const token = req.cookies.get('token')?.value;
  if (token) {
    const session = await findSession(token);
    if (session && session.user) {
      return { isAuthorized: true, isInternal: false, user: session.user };
    }
  }

  return {
    isAuthorized: false,
    isInternal: false,
    errorResponse: new Response('Unauthorized', { status: 401 })
  };
}