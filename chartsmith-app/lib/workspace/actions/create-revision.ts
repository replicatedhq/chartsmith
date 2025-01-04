"use server"

import { Session } from "@/lib/types/session";
import { listMessagesForWorkspace } from "../chat";
import { createRevision, getWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";

export async function createRevisionAction(session: Session, workspaceId: string): Promise<Workspace | undefined> {
  const chatMessages = await listMessagesForWorkspace(workspaceId);
  const lastChatMessage = chatMessages[chatMessages.length - 1];

  await createRevision(workspaceId, lastChatMessage.id, session.user.id);
  const workspace = await getWorkspace(workspaceId);
  return workspace;
}
