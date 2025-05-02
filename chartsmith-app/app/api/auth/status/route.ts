import { NextResponse } from 'next/server';
import { findSession } from '@/lib/auth/session';

export async function GET(request: Request) {
  try {
    // Get token from authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Find session using the token
    const session = await findSession(token);
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Return complete user info and success status
    return NextResponse.json({ 
      user: session.user,
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error in auth status endpoint:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
} 