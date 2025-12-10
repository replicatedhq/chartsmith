import { NextRequest, NextResponse } from 'next/server';
import { findSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * @fileoverview Next.js API route that proxies chat requests to Go backend.
 * 
 * This route acts as a bridge between the frontend useChat hook and
 * the Go backend. It handles authentication, request validation, and
 * streams responses in AI SDK Data Stream Protocol format (HTTP SSE).
 * 
 * Authentication supports both:
 * - Cookie-based auth (web): Reads session cookie
 * - Bearer token auth (extension): Reads Authorization header
 * 
 * @see https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
 */

/**
 * POST /api/chat
 *
 * Proxies chat requests to the Go backend and streams the response.
 * Used by the useChat hook from @ai-sdk/react.
 *
 * Request body:
 * ```json
 * {
 *   "messages": [...],  // AI SDK message format
 *   "workspaceId": "string",
 *   "role": "auto" | "developer" | "operator"
 * }
 * ```
 *
 * Response: Streaming Server-Sent Events (SSE) with AI SDK Data Stream Protocol
 * 
 * @param req - Next.js request object with chat messages
 * @returns Streaming response with AI SDK Data Stream Protocol (text/event-stream)
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/chat', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *     workspaceId: 'workspace-123',
 *   }),
 * });
 * ```
 */
export async function POST(req: NextRequest) {
  // Authenticate: try cookies first (web), then authorization header (extension)
  // This dual-auth approach supports both web app and VS Code extension
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

  const { messages, workspaceId } = body;

  // Validate required fields
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'Messages array is required' },
      { status: 400 }
    );
  }

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 }
    );
  }

  // Get Go worker URL (from env var, database param, or localhost default)
  const goWorkerUrl = await getGoWorkerUrl();

  // Forward request to Go backend and stream response back
  try {
    const response = await fetch(`${goWorkerUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        workspaceId,
        userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Go backend error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Backend error' },
        { status: response.status }
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { error: 'No response body from backend' },
        { status: 500 }
      );
    }

    // Stream the response back as Server-Sent Events (SSE)
    // The Go backend outputs AI SDK Data Stream Protocol format
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Gets the Go worker URL from environment variable, database param, or defaults to localhost.
 * 
 * Priority order:
 * 1. GO_WORKER_URL environment variable
 * 2. Database parameter (if available)
 * 3. http://localhost:8080 (local development default)
 * 
 * @returns Go worker URL string
 */
async function getGoWorkerUrl(): Promise<string> {
  // Try environment variable first (highest priority)
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

