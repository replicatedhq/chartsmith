"use server";

import { Session } from "@/lib/types/session";
import { RenderedWorkspace } from "@/lib/types/workspace";
import { listWorkspaceRenders } from "../rendered";

export async function listWorkspaceRendersAction(session: Session, workspaceId: string): Promise<RenderedWorkspace[]> {
  return listWorkspaceRenders(session, workspaceId);
}
