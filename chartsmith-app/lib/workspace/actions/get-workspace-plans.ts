"use server"

import { Session } from "@/lib/types/session";
import { listPlans } from "../workspace";
import { Plan } from "@/lib/types/workspace";

export async function getWorkspacePlansAction(session: Session, workspaceId: string): Promise<Plan[]> {
  const plans = await listPlans(workspaceId);
  return plans;
}
