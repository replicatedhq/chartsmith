import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Inline test auth bypass functions to avoid Edge Runtime issues with database imports
const TEST_AUTH_HEADER = 'X-Test-Auth-Token';

function isTestAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (process.env.ENABLE_TEST_AUTH === 'true' || process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true')
  );
}

function getTestAuthTokenFromHeaders(headers: Headers): string | null {
  return headers.get(TEST_AUTH_HEADER);
}

// Define public paths that don't require authentication
const publicPaths = [
  '/login',
  '/login-with-test-auth',
  '/auth/google',
  '/api/auth/callback/google',
  '/api/auth/status',
  '/api/auth/test-auth', // Allow test auth endpoint
  '/api/config',
  '/signup',
  '/_next',
  '/favicon.ico',
  '/assets',
  '/images',
];

// API paths that can use token-based auth 
// (these will be handled in their respective routes)
const tokenAuthPaths = [
  '/api/auth/status',
  '/api/upload-chart',
  '/api/workspace',
  '/api/push',
  '/api/chat'  // Chat API handles its own auth
];

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is public
  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
  
  // Allow access to public paths without authentication
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  // Check if this is an API path that supports token auth
  const isTokenAuthPath = tokenAuthPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
  
  // For token auth paths, we'll let the route handle authentication
  if (isTokenAuthPath && request.headers.get('Authorization')?.startsWith('Bearer ')) {
    return NextResponse.next();
  }
  
  // TEST AUTH BYPASS: Check for test auth header (only in test mode)
  // Note: Middleware runs in Edge Runtime, so we can't access database here
  // Route handlers will validate the token - we just allow the request through
  if (isTestAuthBypassEnabled()) {
    const testAuthToken = getTestAuthTokenFromHeaders(request.headers);
    if (testAuthToken && testAuthToken !== 'auto') {
      // Allow request through - route handlers will validate the token
      const response = NextResponse.next();
      
      // Set cookie in response so client-side code can access it
      // (Only if token is provided, not "auto" - "auto" needs database access)
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      response.cookies.set('session', testAuthToken, {
        expires,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
      });
      
      return response;
    } else if (testAuthToken === 'auto') {
      // For "auto", just allow through - API route will generate token
      return NextResponse.next();
    }
  }
  
  // For all other paths, check for session cookie
  const session = request.cookies.get('session');
  
  // If no session, redirect to login
  // Preserve test-auth parameter if present in the request
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    const testAuth = request.nextUrl.searchParams.get('test-auth');
    // In test mode, always add test-auth parameter to redirects
    if (process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true' || testAuth === 'true') {
      loginUrl.searchParams.set('test-auth', 'true');
    }
    return NextResponse.redirect(loginUrl);
  }
  
  // If we have a session cookie (even if it's a test token), allow the request
  // The actual validation will happen in the route handlers via findSession()
  return NextResponse.next();
}

// See: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 