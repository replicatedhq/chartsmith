"use server";

import { Session } from "@/lib/types/session";
import { createChatMessage, createWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

export async function createWorkspaceFromPromptAction(session: Session, prompt: string): Promise<Workspace> {
  logger.info("Creating workspace from prompt", { prompt, userId: session.user.id });

  const w = await createWorkspace("prompt", session.user.id);

  // not every initial prompt is a plan, so we need to create a chat message with the prompt
  await createChatMessage(session.user.id, w.id, { prompt });

  return w;
}
