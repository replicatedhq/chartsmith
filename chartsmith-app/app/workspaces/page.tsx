import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth/actions/validate-session";
import { listWorkspacesAction } from "@/lib/workspace/actions/list-workspaces";
import { WorkspacesList } from "./WorkspacesList";

export default async function WorkspacesPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return null;
  }

  const workspaces = await listWorkspacesAction(session);

  return <WorkspacesList initialWorkspaces={workspaces} />;
}
