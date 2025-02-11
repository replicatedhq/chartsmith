"use server"

import { Session } from "@/lib/types/session";
import { FollowupAction } from "@/lib/types/workspace";
import { getChatMessage, getWorkspace, renderWorkspace } from "../workspace";

export async function performFollowupAction(session:Session, workspaceId:string, chatMessageId:string, action: string) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
      throw new Error("Workspace not found");
  }

  const chatMessage = await getChatMessage(chatMessageId);
  if (!chatMessage) {
    throw new Error("Chat message not found");
  }

  await renderWorkspace(workspaceId, workspace.currentRevisionNumber, workspace.charts[0].id);
}
