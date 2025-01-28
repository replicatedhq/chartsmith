"use server"

import { Session } from "@/lib/types/session";
import { ChatMessage } from "@/lib/types/workspace"
import { createNonPlanMessage } from "../workspace";

export async function createNonPlanMessageAction(session: Session, prompt: string, workspaceId: string, planId: string): Promise<ChatMessage> {
  const chatMessage = await createNonPlanMessage(session.user.id, prompt, workspaceId, planId);
  return chatMessage;
}
