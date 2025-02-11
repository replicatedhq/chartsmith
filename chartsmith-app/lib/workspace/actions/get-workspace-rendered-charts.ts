"use server"

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { RenderedChart } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

export async function getWorkspaceRenderedChartsAction(session: Session, workspaceId: string): Promise<RenderedChart[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`
      SELECT 
        id,
        chart_id,
        stdout,
        stderr,
        manifests,
        created_at,
        completed_at
      FROM workspace_rendered_chart 
      WHERE workspace_id = $1 
      ORDER BY created_at DESC
    `, [workspaceId]);

    return result.rows.map(row => ({
      id: row.id,
      name: row.chart_id, // Using chart_id as name for now
      stdout: row.stdout || '',
      stderr: row.stderr || '',
      manifests: row.manifests || '',
      createdAt: row.created_at,
      completedAt: row.completed_at
    }));
  } catch (err) {
    logger.error("Failed to get rendered charts", { err });
    return [];
  }
}
