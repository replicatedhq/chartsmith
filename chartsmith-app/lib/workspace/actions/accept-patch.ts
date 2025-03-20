"use server"

import { Session } from "@/lib/types/session";
import { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

// These actions have been deprecated as part of the removal of the pendingPatches feature
// They are kept as stubs for backward compatibility

export async function acceptPatchAction(session: Session, fileId: string, revision: number): Promise<WorkspaceFile> {
  try {
    const { user } = session;
    if (!user) {
      throw new Error("User not found");
    }

    logger.info(`Accepting patch for file ${fileId} at revision ${revision} is no longer supported`);
    throw new Error("Pending patches functionality has been removed");
  } catch (error) {
    // If we can't get the original file, re-throw
    throw error;
  }
}

export async function acceptAllPatchesAction(session: Session, workspaceId: string, revision: number): Promise<WorkspaceFile[]> {
  try {
    const { user } = session;
    if (!user) {
      throw new Error("User not found");
    }

    logger.info(`Accepting all patches for workspace ${workspaceId} at revision ${revision} is no longer supported`);
    throw new Error("Pending patches functionality has been removed");
  } catch (error) {
    logger.error(`Error in acceptAllPatchesAction:`, { error, workspaceId, revision });
    throw error;
  }
}