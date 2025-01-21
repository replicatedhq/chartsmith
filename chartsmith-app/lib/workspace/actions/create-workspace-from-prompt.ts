"use server";

import { Session } from "@/lib/types/session";
import { createWorkspace } from "../workspace";
import { Plan } from "@/lib/types/workspace";

export async function createWorkspaceAction(session: Session, createdType: string, prompt: string): Promise<Plan> {
  const plan = await createWorkspace(createdType, prompt, session.user.id);
  return plan;
}
