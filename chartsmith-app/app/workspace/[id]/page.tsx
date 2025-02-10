import { WorkspaceContent } from "@/components/editor/workspace/WorkspaceContent";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { validateSession } from "@/lib/auth/actions/validate-session";
import { cookies } from "next/headers";

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WorkspacePage({
  params
}: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return null;
  }
  const session = await validateSession(sessionToken);
  if (!session) {
    return null;
  }
  const workspace = await getWorkspaceAction(session, id);
  if (!workspace) {
    return null; // This should never happen as layout redirects if no workspace
  }

  return <WorkspaceContent initialWorkspace={workspace} workspaceId={id} />;
}
