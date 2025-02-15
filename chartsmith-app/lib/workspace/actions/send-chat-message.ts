"use server";

import { Session } from "@/lib/types/session";
import { addChatMessage } from "../chat";
import { Message } from "@/components/types";

export async function sendChatMessageAction(session: Session, workspaceId: string, message: string): Promise<Message> {
  const m = await addChatMessage(workspaceId, session.user.id, message);
  return m;
}
