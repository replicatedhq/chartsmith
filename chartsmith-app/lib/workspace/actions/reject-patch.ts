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

}

export async function rejectAllPatchesAction(session: Session, workspaceId: string, revision: number): Promise<void> {
  const { user } = session;
  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`Rejecting all patches for workspace ${workspaceId} at revision ${revision}`);
}
