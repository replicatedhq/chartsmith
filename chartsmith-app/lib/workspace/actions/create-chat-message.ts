"use server"

import { Session } from "@/lib/types/session";
import { ChatMessageFromPersona, createChatMessage } from "../workspace";
import { ChatMessage } from "@/lib/types/workspace";

export async function createChatMessageAction(session: Session, workspaceId: string, message: string, messageFromPersona: string, skipWorker?: boolean): Promise<ChatMessage> {
  return await createChatMessage(session.user.id, workspaceId, { prompt: message, messageFromPersona: messageFromPersona as ChatMessageFromPersona, skipWorker });
}
