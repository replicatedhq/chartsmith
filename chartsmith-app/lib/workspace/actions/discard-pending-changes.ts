"use server";

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { getWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";

export async function discardPendingChangesAction(
  session: Session,
  workspaceId: string
): Promise<Workspace> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const db = getDB(await getParam("DB_URI"));

  // Get current revision
  const revResult = await db.query(
    `SELECT current_revision_number FROM workspace WHERE id = $1`,
    [workspaceId]
  );
  if (revResult.rows.length === 0) {
    throw new Error("Workspace not found");
  }
  const currentRevNum = revResult.rows[0].current_revision_number;

  // Clear all content_pending for current revision
  await db.query(
    `UPDATE workspace_file SET content_pending = NULL
     WHERE workspace_id = $1 AND revision_number = $2 AND content_pending IS NOT NULL`,
    [workspaceId, currentRevNum]
  );

  // Delete files that only have content_pending (created but not committed)
  await db.query(
    `DELETE FROM workspace_file
     WHERE workspace_id = $1 AND revision_number = $2 AND (content IS NULL OR content = '')`,
    [workspaceId, currentRevNum]
  );

  // Return updated workspace
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error("Failed to fetch updated workspace");
  }
  return workspace;
}
