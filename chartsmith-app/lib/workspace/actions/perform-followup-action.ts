"use server"

import { Session } from "@/lib/types/session";
import { ChatMessage } from "@/lib/types/workspace";
import { ChatMessageFromPersona, ChatMessageIntent, createChatMessage, getChatMessage, getWorkspace, renderWorkspace } from "../workspace";

export async function performFollowupAction(session:Session, workspaceId:string, chatMessageId:string, action: string): Promise<ChatMessage|undefined> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
      throw new Error("Workspace not found");
  }

  const chatMessage = await getChatMessage(chatMessageId);
  if (!chatMessage) {
    throw new Error("Chat message not found");
  }

  if (action === "render") {
    const newChatMessage = await createChatMessage(session.user.id, workspaceId, {
      prompt: "Render the chart",
      knownIntent: ChatMessageIntent.RENDER,
      messageFromPersona: ChatMessageFromPersona.AUTO,
    });

    return newChatMessage;
  }

  // Handle all other followup actions as plan messages
  // The action text is the prompt to send
  const newChatMessage = await createChatMessage(session.user.id, workspaceId, {
    prompt: action,
    messageFromPersona: ChatMessageFromPersona.AUTO,
  });

  return newChatMessage;
}
