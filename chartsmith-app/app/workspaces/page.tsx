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

  // Don't allow waitlisted users to access workspaces
  const session = await validateSession(sessionToken, false);
  if (!session) {
    // This will redirect to login page or show access denied
    // Client-side code will redirect waitlisted users to /waitlist
    return null;
  }

  const workspaces = await listWorkspacesAction(session);

  return <WorkspacesList initialWorkspaces={workspaces} />;
}
