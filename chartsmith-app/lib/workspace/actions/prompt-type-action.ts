"use server"

import { Session } from "@/lib/types/session";
import { PromptType, promptType } from "@/lib/llm/prompt-type";

// promptTypeAction synchrnously evals the prompt and determines what type is response the user is looking for
export async function promptTypeAction(session: Session, workspaceId: string, message: string): Promise<PromptType> {
  return await promptType(message);
}
