"use server";

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { getWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";

export async function commitPendingChangesAction(
  session: Session,
  workspaceId: string
): Promise<Workspace> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const db = getDB(await getParam("DB_URI"));
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Get current revision number
    const currentRevResult = await client.query(
      `SELECT current_revision_number FROM workspace WHERE id = $1`,
      [workspaceId]
    );
    if (currentRevResult.rows.length === 0) {
      throw new Error("Workspace not found");
    }
    const prevRevNum = currentRevResult.rows[0].current_revision_number;
    const newRevNum = prevRevNum + 1;

    // 2. Create new revision row
    await client.query(
      `INSERT INTO workspace_revision (workspace_id, revision_number, created_at, created_by_user_id, created_type, is_complete, is_rendered)
       VALUES ($1, $2, NOW(), $3, 'ai_sdk_commit', true, false)`,
      [workspaceId, newRevNum, session.user.id]
    );

    // 3. Copy charts to new revision
    await client.query(
      `INSERT INTO workspace_chart (id, revision_number, workspace_id, name)
       SELECT id, $2, workspace_id, name
       FROM workspace_chart
       WHERE workspace_id = $1 AND revision_number = $3`,
      [workspaceId, newRevNum, prevRevNum]
    );

    // 4. Copy files to new revision WITH content_pending → content
    await client.query(
      `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, embeddings)
       SELECT id, $2, chart_id, workspace_id, file_path,
              COALESCE(NULLIF(content_pending, ''), content),
              embeddings
       FROM workspace_file
       WHERE workspace_id = $1 AND revision_number = $3`,
      [workspaceId, newRevNum, prevRevNum]
    );

    // 5. Clear content_pending on old revision (cleanup)
    await client.query(
      `UPDATE workspace_file SET content_pending = NULL
       WHERE workspace_id = $1 AND revision_number = $2`,
      [workspaceId, prevRevNum]
    );

    // 6. Update workspace current revision
    await client.query(
      `UPDATE workspace SET current_revision_number = $1, last_updated_at = NOW() WHERE id = $2`,
      [newRevNum, workspaceId]
    );

    await client.query("COMMIT");

    // Return updated workspace
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error("Failed to fetch updated workspace");
    }
    return workspace;

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
