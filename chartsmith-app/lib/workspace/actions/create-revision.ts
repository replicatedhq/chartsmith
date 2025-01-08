"use server"

import { Session } from "@/lib/types/session";
import { listMessagesForWorkspace } from "../chat";
import { createRevision, getWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";

export async function createRevisionAction(session: Session, workspaceId: string, chatMessageId?: string): Promise<Workspace | undefined> {
  const chatMessages = await listMessagesForWorkspace(workspaceId);

  if (!chatMessageId) {
    const lastChatMessage = chatMessages[chatMessages.length - 1];
    chatMessageId = lastChatMessage.id;
  }

  await createRevision(workspaceId, chatMessageId, session.user.id);
  const workspace = await getWorkspace(workspaceId);
  return workspace;
}
