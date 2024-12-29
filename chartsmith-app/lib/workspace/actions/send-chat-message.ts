"use server"

import { Session } from "@/lib/types/session";

export async function sendChatMessageAction(session: Session, workspaceId: string, message: string): Promise<void> {
  console.log(`New chat message in workspace ${workspaceId}:`, message);
}
