import { WorkspaceContent } from "@/components/editor/workspace/WorkspaceContent";
import { getWorkspace } from "@/lib/workspace/workspace";

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WorkspacePage({
  params
}: PageProps) {
  const { id } = await params;
  const workspace = await getWorkspace(id);
  if (!workspace) {
    return null; // This should never happen as layout redirects if no workspace
  }

  return <WorkspaceContent initialWorkspace={workspace} workspaceId={id} />;
}
