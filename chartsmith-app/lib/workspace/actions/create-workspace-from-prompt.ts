"use server";

import { Session } from "@/lib/types/session";
import { ChatMessageFromPersona, ChatMessageIntent, CreateChatMessageParams, createWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

export async function createWorkspaceFromPromptAction(session: Session, prompt: string): Promise<Workspace> {
  logger.info("Creating workspace from prompt", { prompt, userId: session.user.id });

  const createChartMessageParams: CreateChatMessageParams = {
    prompt: prompt,
    messageFromPersona: ChatMessageFromPersona.AUTO,
    knownIntent: ChatMessageIntent.NON_PLAN,
  }
  const w = await createWorkspace("prompt", session.user.id, createChartMessageParams);

  return w;
}
