import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import { getWorkspace } from "@/lib/workspace/workspace";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // if there's an auth header, use that to find the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await userIdFromExtensionToken(authHeader.split(' ')[1])

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use URLPattern to extract workspaceId
    const pathSegments = req.nextUrl.pathname.split('/');
    pathSegments.pop(); // Remove the last segment (e.g., 'messages')
    const workspaceId = pathSegments.pop(); // Get the workspaceId
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json(workspace);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}