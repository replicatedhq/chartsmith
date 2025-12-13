import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public paths that don't require authentication
const publicPaths = [
  '/login',
  '/login-with-test-auth',
  '/auth/google',
  '/api/auth/callback/google',
  '/api/auth/status',
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
  '/api/chat/conversational' // Allow worker to call conversational chat API
];

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
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
  
  // For all other paths, check for session cookie
  const session = request.cookies.get('session');
  
  // If no session, redirect to login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Continue with the request
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