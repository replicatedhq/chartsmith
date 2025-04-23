import { NextResponse } from 'next/server';
import { validateBearerToken } from '@/lib/auth/token-auth';

export async function GET(request: Request) {
  try {
    // Validate the bearer token
    const userId = await validateBearerToken(request);
    if (!userId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Return user info and success status
    return NextResponse.json({ 
      userId: userId,
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error in auth status endpoint:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
} 