import { NextRequest, NextResponse } from 'next/server';
import { validateTestAuth } from '@/lib/auth/actions/test-auth';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  // Only allow in development/test mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Test auth not allowed in production' }, { status: 403 });
  }

  if (process.env.ENABLE_TEST_AUTH !== 'true' && process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
    return NextResponse.json({ error: 'Test auth not enabled' }, { status: 403 });
  }

  try {
    logger.debug('Test auth API called');
    const jwt = await validateTestAuth();
    
    if (!jwt) {
      return NextResponse.json({ error: 'Failed to generate test token' }, { status: 500 });
    }

    logger.debug('Test auth successful, setting cookie via API', { jwtLength: jwt.length });

    // Check if this is a programmatic request (e.g., from Playwright) that wants the JWT
    const wantsJson = request.headers.get('accept')?.includes('application/json') || 
                      request.nextUrl.searchParams.get('format') === 'json';

    if (wantsJson) {
      // Return JWT in JSON for programmatic access (e.g., Playwright tests)
      return NextResponse.json({ 
        token: jwt,
        redirect: '/'
      });
    }

    // Set cookie expiration
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    
    // Create redirect response
    const redirectUrl = new URL('/', request.url);
    const response = NextResponse.redirect(redirectUrl);
    
    // Try both methods: cookies API and manual header
    // Method 1: Use cookies() API
    response.cookies.set('session', jwt, {
      expires,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
    });
    
    // Method 2: Also manually set header as backup
    const cookieValue = `session=${jwt}; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}`;
    const existingSetCookie = response.headers.get('Set-Cookie');
    if (existingSetCookie) {
      // Append if header already exists
      response.headers.set('Set-Cookie', `${existingSetCookie}, ${cookieValue}`);
    } else {
      response.headers.set('Set-Cookie', cookieValue);
    }

    logger.debug('Cookie set via both methods', { 
      jwtLength: jwt.length,
      jwtPrefix: jwt.substring(0, 30) + '...',
      setCookieHeader: response.headers.get('Set-Cookie')?.substring(0, 150) || 'none'
    });

    return response;
  } catch (error) {
    logger.error('Test auth API failed', { error });
    return NextResponse.json({ 
      error: 'Test authentication failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
