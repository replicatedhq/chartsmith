"use server"

import { Session } from "@/lib/types/session";
import { createWorkspace } from "../workspace";

export async function createWorkspaceFromPrompt(session: Session, createdType: string, prompt: string): Promise<string> {
  const workspace = await createWorkspace("new workspace", createdType, prompt, session.user.id);
  return workspace.id
}
