import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import { listWorkspaceRenders } from "@/lib/workspace/rendered";
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

    const renders = await listWorkspaceRenders(workspaceId);
    return NextResponse.json(renders);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to get renders' }, { status: 500 });
  }
}
