import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import { findSession } from "@/lib/auth/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Extract workspaceId and messageId from the request URL
 */
function getIdsFromRequest(req: NextRequest): { workspaceId: string | null; messageId: string | null } {
  const pathSegments = req.nextUrl.pathname.split('/');
  const messageId = pathSegments.pop() || null;
  pathSegments.pop(); // Remove 'messages'
  const workspaceId = pathSegments.pop() || null;
  return { workspaceId, messageId };
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
 * PATCH /api/workspace/[workspaceId]/messages/[messageId]
 * Update an existing chat message (typically to add/update the response)
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, messageId } = getIdsFromRequest(req);
    if (!workspaceId || !messageId) {
      return NextResponse.json(
        { error: 'Workspace ID and Message ID are required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { response } = body;

    if (response === undefined) {
      return NextResponse.json(
        { error: 'Response field is required' },
        { status: 400 }
      );
    }

    // Update the message in the database
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `UPDATE workspace_chat SET response = $1 WHERE id = $2 AND workspace_id = $3`,
      [response, messageId, workspaceId]
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to update message:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}
