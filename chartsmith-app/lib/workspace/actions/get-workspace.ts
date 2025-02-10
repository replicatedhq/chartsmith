"use server";

import { Session } from "@/lib/types/session";
import { Workspace } from "@/lib/types/workspace";
import { getWorkspace } from "../workspace";

export async function getWorkspaceAction(session: Session, id: string): Promise<Workspace | undefined> {
  const workspace = await getWorkspace(id);
  return workspace;
}
