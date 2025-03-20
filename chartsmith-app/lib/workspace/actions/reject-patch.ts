"use server";

import { Session } from "@/lib/types/session";
import { logger } from "@/lib/utils/logger";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";

// These actions have been deprecated as part of the removal of the pendingPatches feature
// They are kept as stubs for backward compatibility

export async function rejectPatchAction(session: Session, fileId: string, revision: number): Promise<void> {
  const { user } = session;
  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`Rejecting patch for file ${fileId} at revision ${revision} is no longer supported`);
  throw new Error("Pending patches functionality has been removed");
}

export async function rejectAllPatchesAction(session: Session, workspaceId: string, revision: number): Promise<void> {
  const { user } = session;
  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`Rejecting all patches for workspace ${workspaceId} at revision ${revision} is no longer supported`);
  throw new Error("Pending patches functionality has been removed");
}