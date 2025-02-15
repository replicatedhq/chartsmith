"use server";

import { Message } from "@/components/types";
import { Session } from "@/lib/types/session";
import { listMessagesForWorkspace } from "../chat";

export async function getWorkspaceMessagesAction(session: Session, workspaceID: string): Promise<Message[]> {
  const messages = await listMessagesForWorkspace(workspaceID);
  return messages;
}
