"use server"

import { Session } from "@/lib/types/session";
import { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { rejectAllPatches, rejectPatch } from "../patch";


export async function rejectPatchAction(session: Session, fileId: string, revision: number): Promise<WorkspaceFile> {
  try {
    const { user } = session;
    if (!user) {
      throw new Error("User not found");
    }

    const updatedFile = await rejectPatch(fileId, revision);
    return updatedFile;
  } catch (error) {
    // If we can't get the original file, re-throw
    throw error;
  }
}

export async function rejectAllPatchesAction(session: Session, workspaceId: string, revision: number): Promise<WorkspaceFile[]> {
  try {
    const { user } = session;
    if (!user) {
      throw new Error("User not found");
    }

    const updatedFiles = await rejectAllPatches(workspaceId, revision);
    return updatedFiles;
  } catch (error) {
    throw error;
  }
}