"use server"

import { Session } from "@/lib/types/session";
import { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { acceptAllPatches, acceptPatch } from "../patch";
import { enqueueWork } from "@/lib/utils/queue";
import { countFilesWithPendingContent, getWorkspace } from "../workspace";

export async function acceptPatchAction(session: Session, workspaceId: string, fileId: string, revision: number): Promise<WorkspaceFile> {
  try {
    const { user } = session;
    if (!user) {
      throw new Error("User not found");
    }

    const updatedFile = await acceptPatch(fileId, revision);

    // if there are no more files with contentPending, trigger embeddings for the files in this workspace
    const workspace = await getWorkspace(workspaceId);
    const fileCountWithPendingContent = await countFilesWithPendingContent(workspaceId, workspace?.currentRevisionNumber ?? 0);
      if (fileCountWithPendingContent === 0) {

      for (const chart of workspace?.charts ?? []) {
        for (const file of chart.files) {
          await enqueueWork("new_summarize", {
            fileId: file.id,
            revision: workspace?.currentRevisionNumber
          });
        }
      }
      for (const file of workspace?.files ?? []) {
        await enqueueWork("new_summarize", {
          fileId: file.id,
          revision: workspace?.currentRevisionNumber
        });
      }
    }

    return updatedFile;
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

    const updatedFiles = await acceptAllPatches(workspaceId, revision);

    const workspace = await getWorkspace(workspaceId);
    for (const chart of workspace?.charts ?? []) {
      for (const file of chart.files) {
        await enqueueWork("new_summarize", {
          fileId: file.id,
          revision: workspace?.currentRevisionNumber
        });
      }
    }
    for (const file of workspace?.files ?? []) {
      await enqueueWork("new_summarize", {
        fileId: file.id,
        revision: workspace?.currentRevisionNumber
      });
    }

    return updatedFiles;
  } catch (error) {
    throw error;
  }
}