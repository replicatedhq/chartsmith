import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { RenderedChart } from "../types/workspace";
import { logger } from "../utils/logger";
import { getWorkspace } from "./workspace";


export async function listRenderedChartsForWorkspace(
  workspaceId: string,
  revisionNumber: number
): Promise<RenderedChart[]> {
  try {
    const workspace = await getWorkspace(workspaceId);

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const db = getDB(await getParam("DB_URI"));

    const rows = await db.query(
      `
        SELECT
          id,
          workspace_id,
          revision_number,
          chart_id,
          is_success,
          stdout,
          stderr,
          manifests,
          created_at,
          completed_at
        FROM workspace_rendered_chart
        WHERE workspace_id = $1
          AND revision_number = $2
      `,
      [workspaceId, revisionNumber]
    );

    const renderedCharts: RenderedChart[] = rows.rows.map((row) => ({
      id: row.id,
      name: workspace.charts.find((c) => c.id === row.chart_id)?.name ?? 'unknown chart',
      stdout: row.stdout,
      stderr: row.stderr,
      manifests: row.manifests,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));

    return renderedCharts;
  } catch (err) {
    logger.error("Failed to list rendered charts for workspace", { err });
    throw err;
  }
}
