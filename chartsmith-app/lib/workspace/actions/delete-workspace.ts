"use server"

import { Session } from "@/lib/types/session";
import { AppError } from "@/lib/utils/error";

export async function deleteWorkspaceAction(session: Session, workspaceId: string): Promise<void> {
  if (!session?.user?.id) {
    throw new AppError("Unauthorized", "UNAUTHORIZED");
  }
}
