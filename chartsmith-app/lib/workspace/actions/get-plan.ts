"use server"

import { Plan } from "@/lib/types/workspace";
import { getPlan } from "../workspace";
import { Session } from "@/lib/types/session";

export async function getPlanAction(session: Session, planId: string): Promise<Plan> {
  const plan = await getPlan(planId);
  return plan;
}
