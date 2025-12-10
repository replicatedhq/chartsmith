import { NextRequest, NextResponse } from 'next/server';
import { findSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/prompt-type
 *
 * Proxies prompt type classification requests to the Go backend.
 * Classifies a user message as either "plan" or "chat".
 *
 * @param req - Next.js request object
 * @returns JSON response with classification result
 */
export async function POST(req: NextRequest) {
  // Authenticate - try cookies first (for web), then authorization header (for extension)
  let userId: string | undefined;
  
  try {
    // Try to get session from cookies (web-based auth)
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (sessionToken) {
      const session = await findSession(sessionToken);
      if (session?.user?.id) {
        userId = session.user.id;
      }
    }
    
    // Fall back to authorization header (extension-based auth)
    if (!userId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const session = await findSession(token);
        if (session?.user?.id) {
          userId = session.user.id;
        }
      }
    }
  } catch (error) {
    console.error('Auth error:', error);
    // Continue to check userId below
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { message } = body;

  if (!message || typeof message !== 'string') {
    return NextResponse.json(
      { error: 'Message is required' },
      { status: 400 }
    );
  }

  // Get Go worker URL
  const goWorkerUrl = await getGoWorkerUrl();

  // Forward to Go backend
  try {
    const response = await fetch(`${goWorkerUrl}/api/prompt-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Go backend error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to classify prompt type' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in prompt-type API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Gets the Go worker URL from environment variable, database param, or defaults to localhost.
 */
async function getGoWorkerUrl(): Promise<string> {
  // Try environment variable first
  if (process.env.GO_WORKER_URL) {
    return process.env.GO_WORKER_URL;
  }

  // Fall back to database param (if helper exists)
  try {
    const { getParam } = await import('@/lib/data/param');
    const paramUrl = await getParam('GO_WORKER_URL');
    if (paramUrl) {
      return paramUrl;
    }
  } catch (e) {
    // Ignore if param helper doesn't exist or fails
  }

  // Default for local development
  return 'http://localhost:8080';
}
