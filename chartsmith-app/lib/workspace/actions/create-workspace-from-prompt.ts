"use server";

import { Session } from "@/lib/types/session";
import { ChatMessageFromPersona, CreateChatMessageParams, createWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

export async function createWorkspaceFromPromptAction(session: Session, prompt: string, modelId?: string): Promise<Workspace> {
  logger.info("Creating workspace from prompt", { prompt, userId: session.user.id, modelId });

  const createChartMessageParams: CreateChatMessageParams = {
    prompt: prompt,
    messageFromPersona: ChatMessageFromPersona.AUTO,
    modelId,
  }
  const w = await createWorkspace("prompt", session.user.id, createChartMessageParams);

  return w;
}
