"use server"

import { Session } from "@/lib/types/session";
import { createPlan } from "../workspace";

export async function createPlanAction(session: Session, prompt: string, workspaceId: string, superceedingPlanId?: string) {
  const plan = await createPlan(session.user.id, prompt, workspaceId, superceedingPlanId);
  return plan;
}
