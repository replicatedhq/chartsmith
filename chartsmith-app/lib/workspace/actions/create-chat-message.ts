"use server"

import { Session } from "@/lib/types/session";
import { ChatMessageFromPersona, createChatMessage } from "../workspace";
import { ChatMessage } from "@/lib/types/workspace";

export async function createChatMessageAction(session: Session, workspaceId: string, message: string, messageFromPersona: string): Promise<ChatMessage> {
  // Let intent classification determine whether this is a plan or conversational message
  // Don't force NON_PLAN intent - the worker will classify appropriately
  return await createChatMessage(session.user.id, workspaceId, {
    prompt: message,
    messageFromPersona: messageFromPersona as ChatMessageFromPersona,
    knownIntent: undefined
  });
}
