import { c } from "tar";
import { WorkspaceFile } from "../types/workspace";
import { logger } from "../utils/logger";
import { getDB } from "../data/db";
import { getParam } from "../data/param";


export async function getFile(fileID: string, revisionNumber: number): Promise<WorkspaceFile> {
  logger.info(`Getting file ${fileID} at revision ${revisionNumber}`);

  try {
    const db = getDB(await getParam("DB_URI"))
    const rows = await db.query(`
        SELECT
          id,
          revision_number,
          chart_id,
          workspace_id,
          file_path,
          content,
          content_pending
        FROM
          workspace_file
        WHERE
          revision_number = $1 AND
          id = $2
    `, [revisionNumber, fileID]);

    if (rows.rows.length === 0) {
      throw new Error(`File ${fileID} not found at revision ${revisionNumber}`);
    }

    const file: WorkspaceFile = {
      id: rows.rows[0].id,
      revisionNumber: rows.rows[0].revision_number,
      filePath: rows.rows[0].file_path,
      content: rows.rows[0].content,
      contentPending: rows.rows[0].content_pending,
    }

    return file;
  } catch (error) {
    logger.error(`Error getting file ${fileID} at revision ${revisionNumber}: ${error}`);
    throw error;
  }
}

export async function rejectPatch(fileID: string, revisionNumber: number): Promise<WorkspaceFile> {
  logger.info(`Rejecting patch for file ${fileID} at revision ${revisionNumber}`);

  try {
    const db = getDB(await getParam("DB_URI"))
    const rows = await db.query(`SELECT content_pending FROM workspace_file WHERE id = $1 AND revision_number = $2`, [fileID, revisionNumber]);
    const row = rows.rows[0];

    if (!row) {
      throw new Error(`File ${fileID} not found at revision ${revisionNumber}`);
    }

    // update the file content to the pending content
    await db.query(`UPDATE workspace_file SET content_pending = NULL WHERE id = $1 AND revision_number = $2`, [fileID, revisionNumber]);

    return getFile(fileID, revisionNumber);
  } catch (error) {
    logger.error(`Error rejecting patch for file ${fileID} at revision ${revisionNumber}: ${error}`);
    throw error;
  }
}

export async function acceptPatch(fileID: string, revisionNumber: number): Promise<WorkspaceFile> {
  logger.info(`Accepting patch for file ${fileID} at revision ${revisionNumber}`);

  try {
    const db = getDB(await getParam("DB_URI"))
    const rows = await db.query(`SELECT content_pending FROM workspace_file WHERE id = $1 AND revision_number = $2`, [fileID, revisionNumber]);
    const row = rows.rows[0];

    if (!row) {
      throw new Error(`File ${fileID} not found at revision ${revisionNumber}`);
    }

    if (!row.content_pending) {
      throw new Error(`File ${fileID} has no pending content at revision ${revisionNumber}`);
    }

    // update the file content to the pending content
    await db.query(`UPDATE workspace_file SET content = $1, content_pending = NULL WHERE id = $2 AND revision_number = $3`, [row.content_pending, fileID, revisionNumber]);

    return getFile(fileID, revisionNumber);
  } catch (error) {
    logger.error(`Error accepting patch for file ${fileID} at revision ${revisionNumber}: ${error}`);
    throw error;
  }
}