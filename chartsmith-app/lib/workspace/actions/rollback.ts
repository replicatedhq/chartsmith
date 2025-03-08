"use server"

import { Session } from "@/lib/types/session";
import { getWorkspace, rollbackToRevision } from "../workspace";
import { Workspace } from "@/lib/types/workspace";

export async function rollbackWorkspaceAction(session: Session, workspaceId: string, revisionNumber: number): Promise<Workspace> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  await rollbackToRevision(workspaceId, revisionNumber);

  const updatedWorkspace = await getWorkspace(workspaceId);
  if (!updatedWorkspace) {
    throw new Error("Workspace not found");
  }

  return updatedWorkspace;
}
