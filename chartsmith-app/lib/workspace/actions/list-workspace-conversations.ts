"use server"

import { Session } from "@/lib/types/session";
import { Conversion } from "@/lib/types/workspace";

export async function listWorkspaceConversionsAction(session: Session, workspaceId: string): Promise<Conversion[]> {
  return [];
}
