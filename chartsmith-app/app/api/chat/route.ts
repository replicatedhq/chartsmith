import { NextRequest, NextResponse } from 'next/server';
import { findSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { getTestAuthTokenFromHeaders, validateTestAuthToken, isTestAuthBypassEnabled } from '@/lib/auth/test-auth-bypass';
import { getGoWorkerUrl } from '@/lib/utils/go-worker';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Zod schema for validating chat request body.
 * Provides strict validation for security and data integrity.
 */
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(100000, 'Message content too large'), // 100KB limit per message
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1, 'At least one message is required').max(100, 'Too many messages'),
  workspaceId: z.string().uuid('Invalid workspace ID format'),
  role: z.enum(['auto', 'developer', 'operator']).optional(),
});

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
  // Authenticate: try test auth bypass first (test mode only), then cookies (web), then authorization header (extension)
  let userId: string | undefined;

  try {
    // TEST AUTH BYPASS: Check for test auth header first (only in non-production test mode)
    // Double-check NODE_ENV here as defense-in-depth
    if (process.env.NODE_ENV !== 'production' && isTestAuthBypassEnabled()) {
      const testAuthToken = getTestAuthTokenFromHeaders(req.headers);
      if (testAuthToken) {
        const authResult = await validateTestAuthToken(testAuthToken);
        if (authResult) {
          const session = await findSession(authResult.token);
          if (session?.user?.id) {
            userId = session.user.id;
          }
        }
      }
    }

    // Try to get session from cookies (web-based auth)
    if (!userId) {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get('session')?.value;

      if (sessionToken) {
        const session = await findSession(sessionToken);
        if (session?.user?.id) {
          userId = session.user.id;
        }
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
  } catch {
    // Auth error - continue to check userId below
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse and validate request body with Zod
  let validatedBody: z.infer<typeof ChatRequestSchema>;
  try {
    const rawBody = await req.json();
    validatedBody = ChatRequestSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues.map(issue => issue.message) },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { messages, workspaceId, role } = validatedBody;

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
        role: role || 'auto',
      }),
    });

    if (!response.ok) {
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
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
