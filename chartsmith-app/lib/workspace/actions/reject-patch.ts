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

  const file = await getFileByIdAndRevision(fileId, revision);
  
  // To reject a patch, we just clear the pending patch without applying it
  await updateFileAfterPatchOperation(fileId, revision, file.content, undefined);
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
     WHERE workspace_id = $1 AND revision_number = $2 AND pending_patch IS NOT NULL`,
    [workspaceId, revision]
  );

  // Reject each patch
  for (const row of result.rows) {
    await rejectPatchAction(session, row.id, row.revision_number);
  }
}
