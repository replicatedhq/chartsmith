"use server"

import { Session } from "@/lib/types/session";

export async function createPlanAction(session: Session, workspaceId: string, superceedingPlanId?: string) {
  const prompt = await createPlan(session, workspaceId, superceedingPlanId);
  return prompt;
}
