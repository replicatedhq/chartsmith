"use server"

import { Session } from "@/lib/types/session";
import { Workspace } from "@/lib/types/workspace";
import { listWorkspaces } from "../workspace";

export async function listWorkspacesAction(session: Session): Promise<Workspace[]> {
  const workspaces = await listWorkspaces(session.user.id);
  return workspaces;
}
