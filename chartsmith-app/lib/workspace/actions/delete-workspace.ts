"use server"

import { Session } from "@/lib/types/session";
import { AppError } from "@/lib/utils/error";
import { deleteWorkspace } from "@/lib/workspace/workspace";

export async function deleteWorkspaceAction(session: Session, workspaceId: string): Promise<void> {
  if (!session?.user?.id) {
    throw new AppError("Unauthorized", "UNAUTHORIZED");
  }

  await deleteWorkspace(workspaceId, session.user.id, !!session.user.isAdmin);
}
