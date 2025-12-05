import { WorkspaceContent } from "@/components/WorkspaceContent";

export const dynamic = 'force-dynamic';
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { validateSession } from "@/lib/auth/actions/validate-session";
import { cookies } from "next/headers";

import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { getWorkspacePlansAction } from "@/lib/workspace/actions/get-workspace-plans";
import { listWorkspaceRendersAction } from "@/lib/workspace/actions/list-workspace-renders";
import { listWorkspaceConversionsAction } from "@/lib/workspace/actions/list-workspace-conversations";

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
    return null;
  }

  // Fetch all initial data
  const [messages, plans, renders, conversions] = await Promise.all([
    getWorkspaceMessagesAction(session, workspace.id),
    getWorkspacePlansAction(session, workspace.id),
    listWorkspaceRendersAction(session, workspace.id),
    listWorkspaceConversionsAction(session, workspace.id)
  ])

  // Pass the initial data as props
  return (
    <WorkspaceContent
      initialWorkspace={workspace}
      initialMessages={messages}
      initialPlans={plans}
      initialRenders={renders}
      initialConversions={conversions}
    />
  );
}
