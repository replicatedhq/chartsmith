"use server"

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";

export async function deleteWorkspaceFileAction(session: Session, workspaceId: string, filePath: string): Promise<void> {
  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }
  if (!filePath) {
    throw new Error("File path is required");
  }

  try {
    const db = getDB(await getParam("DB_URI"));
    
    // First verify the file exists
    const fileCheck = await db.query(
      `SELECT id FROM workspace_file 
       WHERE workspace_id = $1 
       AND file_path = $2`,
      [workspaceId, filePath]
    );

    if (fileCheck.rowCount === 0) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Then delete it
    await db.query(
      `DELETE FROM workspace_file 
       WHERE workspace_id = $1 
       AND file_path = $2`,
      [workspaceId, filePath]
    );
  } catch (err) {
    logger.error("Failed to delete file", { 
      error: err instanceof Error ? err.message : "Unknown error"
    });
    throw err;
  }
}
