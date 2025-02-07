"use server";

import { Session } from "@/lib/types/session";
import { Workspace } from "@/lib/types/workspace";
import { getWorkspace } from "../workspace";

export async function getWorkspaceAction(session: Session, id: string): Promise<Workspace | undefined> {
  const workspace = await getWorkspace(id);
  
  console.log('getWorkspaceAction result:', {
    id,
    fileCount: workspace?.files.length,
    chartFileCount: workspace?.charts?.reduce((acc, chart) => acc + chart.files.length, 0),
    filesWithPatches: workspace?.files.filter(f => f.pendingPatch).length,
    chartFilesWithPatches: workspace?.charts?.reduce((acc, chart) => 
      acc + chart.files.filter(f => f.pendingPatch).length, 0
    )
  });
  
  return workspace;
}
