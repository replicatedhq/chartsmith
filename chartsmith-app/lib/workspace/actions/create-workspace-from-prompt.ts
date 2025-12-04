"use server";

import { Session } from "@/lib/types/session";
import { ChatMessageFromPersona, CreateChatMessageParams, createWorkspace, createWorkspaceWithoutMessage } from "../workspace";
import { Workspace } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

/**
 * Create a workspace with an initial chat message that goes through the work queue
 */
export async function createWorkspaceFromPromptAction(session: Session, prompt: string): Promise<Workspace> {
  logger.info("Creating workspace from prompt", { prompt, userId: session.user.id });

  const createChartMessageParams: CreateChatMessageParams = {
    prompt: prompt,
    messageFromPersona: ChatMessageFromPersona.AUTO,
  }
  const w = await createWorkspace("prompt", session.user.id, createChartMessageParams);

  return w;
}

/**
 * Create a workspace without an initial chat message
 * Used when the client will handle the chat via AI SDK streaming
 */
export async function createWorkspaceForAiSdkAction(session: Session): Promise<Workspace> {
  logger.info("Creating workspace for AI SDK (no initial message)", { userId: session.user.id });

  const w = await createWorkspaceWithoutMessage("prompt", session.user.id);

  return w;
}
