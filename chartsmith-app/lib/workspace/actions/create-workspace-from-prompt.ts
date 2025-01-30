"use server";

import { Session } from "@/lib/types/session";
import { createPlan, createWorkspace } from "../workspace";
import { Plan } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

export async function createWorkspaceFromPromptAction(session: Session, prompt: string): Promise<Plan> {
  logger.info("Creating workspace from prompt", { prompt, userId: session.user.id });
  const w = await createWorkspace("prompt", session.user.id);
  const p = await createPlan(session.user.id, prompt, w.id);
  return p;
}
