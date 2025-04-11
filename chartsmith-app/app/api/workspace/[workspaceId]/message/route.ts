import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import { createChatMessage, CreateChatMessageParams } from "@/lib/workspace/workspace";
import { NextRequest, NextResponse } from "next/server";


export async function POST(req: NextRequest) {
  console.log("GET /api/workspace/[workspaceId]/messages");
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

    const body = await req.json();
    const { prompt } = body;

    const createChatMessageParams: CreateChatMessageParams = {
      prompt,
    };

    const chatMessage = await createChatMessage(userId, workspaceId, createChatMessageParams);

    return NextResponse.json(chatMessage);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}