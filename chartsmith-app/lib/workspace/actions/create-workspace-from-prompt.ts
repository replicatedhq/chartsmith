"use server";

import { Session } from "@/lib/types/session";
import { createWorkspace } from "../workspace";

export async function createWorkspaceAction(session: Session | undefined, createdType: string, prompt: string): Promise<string> {
  const userId = session?.user?.id || "anonymous";
  const workspace = await createWorkspace("new workspace", createdType, prompt, userId);
  return workspace.id;
}
