"use server"

import { Session } from "@/lib/types/session";
import { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { applyPatch, getFileByIdAndRevision, updateFileAfterPatchOperation } from "../patch";

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
