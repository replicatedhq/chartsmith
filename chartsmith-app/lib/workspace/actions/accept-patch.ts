"use server"

import { Session } from "@/lib/types/session";
import { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { applyPatch, getFileByIdAndRevision, updateFileAfterPatchOperation } from "../patch";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";

export async function acceptPatchAction(session: Session, fileId: string, revision: number): Promise<WorkspaceFile> {
  const { user } = session;
  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`Accepting patch for file ${fileId} at revision ${revision}`);

  const file = await getFileByIdAndRevision(fileId, revision);
  const updatedFile = await applyPatch(file);

  await updateFileAfterPatchOperation(fileId, revision, updatedFile.content, updatedFile.pendingPatch);

  return updatedFile;
}

export async function acceptAllPatchesAction(session: Session, workspaceId: string, revision: number): Promise<WorkspaceFile[]> {
  const { user } = session;
  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`Accepting all patches for workspace ${workspaceId} at revision ${revision}`);

  const db = getDB(await getParam("DB_URI"));

  // Find all files with pending patches
  const result = await db.query(
    `SELECT id, revision_number FROM workspace_file 
     WHERE workspace_id = $1 AND revision_number = $2 AND pending_patch IS NOT NULL`,
    [workspaceId, revision]
  );

  // Accept each patch
  const updatedFiles: WorkspaceFile[] = [];
  for (const row of result.rows) {
    const updatedFile = await acceptPatchAction(session, row.id, row.revision_number);
    updatedFiles.push(updatedFile);
  }

  return updatedFiles;
}
