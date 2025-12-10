import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import { findSession } from "@/lib/auth/session";
import { listMessagesForWorkspace } from "@/lib/workspace/chat";
import { createChatMessage } from "@/lib/workspace/workspace";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Extract workspaceId from the request URL
 */
function getWorkspaceId(req: NextRequest): string | null {
  const pathSegments = req.nextUrl.pathname.split('/');
  pathSegments.pop(); // Remove the last segment (e.g., 'messages')
  return pathSegments.pop() || null;
}

/**
 * Get userId from request - supports both cookie-based and extension token auth
 */
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  // Try cookie-based auth first (for web)
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (sessionToken) {
      const session = await findSession(sessionToken);
      if (session?.user?.id) {
        return session.user.id;
      }
    }
  } catch (error) {
    // Continue to try extension token
  }

  // Fall back to extension token auth
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const userId = await userIdFromExtensionToken(token);
      return userId || null;
    } catch (error) {
      // Ignore
    }
  }

  return null;
}

/**
 * GET /api/workspace/[workspaceId]/messages
 * Load chat history for a workspace
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const messages = await listMessagesForWorkspace(workspaceId);
    return NextResponse.json(messages);

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Failed to list messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspace/[workspaceId]/messages
 * Save a new chat message
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { prompt, response } = body;

    // Create the message using the existing function
    const chatMessage = await createChatMessage(userId, workspaceId, {
      prompt: prompt || undefined,
      response: response || undefined,
    });

    return NextResponse.json({ id: chatMessage.id });

  } catch (error) {
    console.error('Failed to save message:', error);
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}