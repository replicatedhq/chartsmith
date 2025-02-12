"use server"

import { Session } from "../types/session";
import { RenderedFile } from "../types/workspace";
import { listRenderedFilesForWorkspace } from "./rendered";

export async function getWorkspaceRenderedFilesAction(session: Session, workspaceId: string, revisionNumber?: number): Promise<RenderedFile[]> {
  const renderedFiles = await listRenderedFilesForWorkspace(workspaceId, revisionNumber);

  return renderedFiles;
}
