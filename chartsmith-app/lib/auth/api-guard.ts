import { NextRequest } from 'next/server';
import { findSession } from '@/lib/auth/session';

export async function checkApiAuth(req: NextRequest) {
  const internalApiKey = req.headers.get('x-internal-api-key');
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