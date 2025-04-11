import { NextRequest, NextResponse } from 'next/server';
import { createWorkspaceFromArchiveAction } from '@/lib/workspace/actions/create-workspace-from-archive';
import { findSession } from '@/lib/auth/session';
import { Archive } from '@/lib/types/archive';
import { userIdFromExtensionToken } from '@/lib/auth/extension-token';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, handle streaming manually
  },
};

export async function POST(req: NextRequest) {
  try {
    // if there's an auth header, use that to find the user
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    if (authHeader) {
      userId = await userIdFromExtensionToken(authHeader.split(' ')[1])
    } else {
      const session = await findSession(req.cookies.get('token')?.value || '');
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = session.user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();

    const archive: Archive = {
      name: file.name,
      content: new Uint8Array(bytes),
    };

    const workspace = await createWorkspaceFromArchiveAction(userId, formData, "helm");

    return NextResponse.json({ workspaceId: workspace.id });
  } catch (error) {
    console.error('Error processing upload:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}
