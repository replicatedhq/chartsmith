"use server";

import { Session } from "@/lib/types/session";
import { logger } from "@/lib/utils/logger";
import { getFileByIdAndRevision, updateFileAfterPatchOperation } from "../patch";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";

export async function rejectPatchAction(session: Session, fileId: string, revision: number): Promise<void> {
  const { user } = session;
  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`Rejecting patch for file ${fileId} at revision ${revision}`);

  // Handle frontend-generated file IDs gracefully
  if (fileId.startsWith('file-')) {
    logger.warn(`Attempting to reject patch for client-side file ${fileId}. This is a UI-only operation.`);
    // For client-side files, we don't need to do anything on the server
    // The UI will handle clearing the pending patch
    return;
  }

  try {
    const file = await getFileByIdAndRevision(fileId, revision);

    // To reject a patch, we just clear the pending patch without applying it
    await updateFileAfterPatchOperation(fileId, revision, file.content, undefined);
  } catch (error) {
    logger.error(`Error rejecting patch for file ${fileId}:`, { error });

    // If we can't find the file in the database but it's not a frontend ID,
    // it's a real error that should bubble up
    if (!fileId.startsWith('file-')) {
      throw error;
    }
    // For frontend IDs, we've already logged the error but we won't throw
  }
}

export async function rejectAllPatchesAction(session: Session, workspaceId: string, revision: number): Promise<void> {
  const { user } = session;
  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`Rejecting all patches for workspace ${workspaceId} at revision ${revision}`);

  const db = getDB(await getParam("DB_URI"));

  // Find all files with pending patches
  const result = await db.query(
    `SELECT id, revision_number FROM workspace_file
     WHERE workspace_id = $1 AND revision_number = $2 AND pending_patches IS NOT NULL`,
    [workspaceId, revision]
  );

  // Reject each patch
  for (const row of result.rows) {
    await rejectPatchAction(session, row.id, row.revision_number);
  }
}
