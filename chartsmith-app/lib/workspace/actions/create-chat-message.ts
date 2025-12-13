"use server"

import { Session } from "@/lib/types/session";
import { ChatMessageFromPersona, ChatMessageIntent, createChatMessage, getWorkspace } from "../workspace";
import { ChatMessage } from "@/lib/types/workspace";

export async function createChatMessageAction(session: Session, workspaceId: string, message: string, messageFromPersona: string): Promise<ChatMessage> {
  // For workspaces with existing files (currentRevisionNumber > 0), default to NON_PLAN intent
  // This ensures conversational messages use the Vercel AI SDK immediately without waiting for intent classification
  const workspace = await getWorkspace(workspaceId);
  const knownIntent = workspace && workspace.currentRevisionNumber > 0 ? ChatMessageIntent.NON_PLAN : undefined;

  return await createChatMessage(session.user.id, workspaceId, {
    prompt: message,
    messageFromPersona: messageFromPersona as ChatMessageFromPersona,
    knownIntent
  });
}
