"use server"

import { Session } from "@/lib/types/session";
import { createWorkspace } from "../workspace";

export async function createPlanAction(session: Session, workspaceId: string, superceedingPlanId?: string) {
  const plan = await createWorkspace("prompt", superceedingPlanId, session.user.id);
  return plan;
}
