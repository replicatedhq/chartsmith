import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { RenderedFile } from "../types/workspace";
import { logger } from "../utils/logger";
import { getWorkspace } from "./workspace";


export async function listRenderedFilesForWorkspace(
  workspaceId: string,
  revisionNumber?: number
): Promise<RenderedFile[]> {
  try {
    const workspace = await getWorkspace(workspaceId);

    if (!revisionNumber) {
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      revisionNumber = workspace.currentRevisionNumber;
    }

    const db = getDB(await getParam("DB_URI"));

    const rows = await db.query(
      `
        SELECT
          file_id,
          workspace_id,
          revision_number,
          file_path,
          content
        FROM workspace_rendered_file
        WHERE workspace_id = $1
          AND revision_number = $2
      `,
      [workspaceId, revisionNumber]
    );

    const renderedFiles: RenderedFile[] = [];
    for (const row of rows.rows) {
      const renderedFile: RenderedFile = {
        id: row.file_id,
        filePath: row.file_path,
        renderedContent: row.content,
      };

      renderedFiles.push(renderedFile);
    }

    logger.debug("Retrieved rendered files", { 
      workspaceId, 
      revisionNumber,
      fileCount: renderedFiles.length,
      filePaths: renderedFiles.map(f => f.filePath)
    });

    return renderedFiles;
  } catch (err) {
    logger.error("Failed to list rendered files for workspace", { err });
    throw err;
  }
}
