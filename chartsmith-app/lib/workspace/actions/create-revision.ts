"use server"

import { Session } from "@/lib/types/session";
import { createRevision, getPlan, getWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";

export async function createRevisionAction(session: Session, planId: string, modelId?: string): Promise<Workspace | undefined> {
  const plan = await getPlan(planId);
  await createRevision(plan, session.user.id, modelId);
  const workspace = await getWorkspace(plan.workspaceId);
  return workspace;
}
