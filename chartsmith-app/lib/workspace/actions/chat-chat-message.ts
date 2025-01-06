"use server"

import { Session } from "@/lib/types/session";
import { getChatMessage } from "../chat";
import { Prompt } from "@/components/editor/types";

export async function getChatMessageForFeedback(session: Session, workspaceId: string, chatId: string): Promise<Prompt> {
  const chatMessage = await getChatMessage(workspaceId, chatId);

  return {
    message: chatMessage,
    filesSent: []
  };
}
