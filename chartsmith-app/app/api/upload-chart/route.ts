import { NextRequest, NextResponse } from 'next/server';
import { createWorkspaceFromArchive } from '@/lib/workspace/actions/create-workspace-from-archive';
import { getSession } from '@/lib/auth/session';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, handle streaming manually
  },
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const archive = {
      name: file.name,
      content: new Uint8Array(bytes),
    };

    const workspace = await createWorkspaceFromArchive(session, archive);

    return NextResponse.json({ workspaceId: workspace.id });
  } catch (error) {
    console.error('Error processing upload:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}
