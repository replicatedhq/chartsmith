"use server"

import { Session } from "@/lib/types/session";
import { ChatMessage } from "@/lib/types/workspace";
import { cancelChatMessage } from "../chat";

export async function cancelMessageAction(session: Session, chatMessageId: string): Promise<ChatMessage | undefined> {
  const updatedChatMessage = await cancelChatMessage(chatMessageId);

  return updatedChatMessage;
}
