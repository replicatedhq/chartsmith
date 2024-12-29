"use server";

import { Session } from "@/lib/types/session";
import { addChatMessage } from "../chat";
import { Message } from "@/components/editor/types";

export async function sendChatMessageAction(session: Session, workspaceId: string, message: string): Promise<Message> {
  console.log(`New chat message in workspace ${workspaceId}:`, message);

  const m = await addChatMessage(workspaceId, session.user.id, message);
  return m;
}
