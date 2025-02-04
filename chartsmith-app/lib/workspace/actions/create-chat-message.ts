"use server"

import { Session } from "@/lib/types/session";
import { createChatMessage } from "../workspace";
import { ChatMessage } from "@/lib/types/workspace";

export async function createChatMessageAction(session: Session, workspaceId: string, message: string): Promise<ChatMessage> {
  return await createChatMessage(session.user.id, workspaceId, { prompt: message });
}
