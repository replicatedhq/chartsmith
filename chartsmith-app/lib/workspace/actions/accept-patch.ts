"use server"

import { Session } from "@/lib/types/session";
import { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { applyPatch, getFileByIdAndRevision, updateFileAfterPatchOperation } from "../patch";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";

function preprocessPatch(patch: string): string {
  const lines = patch.split('\n')
  let formattedPatch = ''
  let hunkStarted = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Handle file headers
    if (line.startsWith('---') || line.startsWith('+++')) {
      formattedPatch += line + '\n'
      continue
    }

    // Handle hunk headers
    if (line.startsWith('@@')) {
      // Ensure proper hunk header format
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
      if (!match) {
        // If malformed, try to reconstruct a valid hunk header
        const nextLines = lines.slice(i + 1)
        const hunkInfo = calculateHunkInfo(nextLines)
        formattedPatch += `@@ -${hunkInfo.oldStart},${hunkInfo.oldLines} +${hunkInfo.newStart},${hunkInfo.newLines} @@\n`
      } else {
        formattedPatch += line + '\n'
      }
      hunkStarted = true
      continue
    }

    // Handle content lines
    if (hunkStarted) {
      // Ensure each line starts with proper prefix
      if (!line.startsWith('+') && !line.startsWith('-') && !line.startsWith(' ')) {
        formattedPatch += ' ' + line + '\n' // Add context prefix
      } else {
        formattedPatch += line + '\n'
      }
    }
  }

  return formattedPatch.trim()
}

function calculateHunkInfo(lines: string[]) {
  let oldStart = 1
  let newStart = 1
  let oldLines = 0
  let newLines = 0

  lines.forEach(line => {
    if (line.startsWith('+')) newLines++
    else if (line.startsWith('-')) oldLines++
    else {
      oldLines++
      newLines++
    }
  })

  return {
    oldStart,
    oldLines,
    newStart,
    newLines
  }
}

export async function acceptPatchAction(session: Session, fileId: string, revision: number): Promise<WorkspaceFile> {
  const { user } = session;
  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`Accepting patch for file ${fileId} at revision ${revision}`);

  const file = await getFileByIdAndRevision(fileId, revision);

  // Preprocess the patch before applying it
  if (file.pendingPatch) {
    file.pendingPatch = preprocessPatch(file.pendingPatch);
  }

  const updatedFile = await applyPatch(file);

  // Clear all patch-related metadata when accepting the patch
  const clearedFile = {
    ...updatedFile,
    pendingPatch: undefined,
    diffStats: undefined,
    addedLines: 0,
    removedLines: 0
  };

  await updateFileAfterPatchOperation(fileId, revision, clearedFile.content, undefined);

  return clearedFile;
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
