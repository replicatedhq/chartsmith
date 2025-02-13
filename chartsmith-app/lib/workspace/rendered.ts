import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { Session } from "../types/session";
import { RenderedChart, RenderedFile, RenderedWorkspace } from "../types/workspace";
import { logger } from "../utils/logger";
import { getWorkspace } from "./workspace";

export async function listWorkspaceRenders(session: Session, workspaceId: string): Promise<RenderedWorkspace[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const query = `
      SELECT
        id,
        workspace_id,
        revision_number,
        created_at,
        completed_at
      FROM workspace_rendered
      WHERE workspace_id = $1
    `;

    const result = await db.query(query, [workspaceId]);
    const renderedWorkspaces: RenderedWorkspace[] = [];

    for (const row of result.rows) {
      const renderedWorkspace: RenderedWorkspace = {
        id: row.id,
        workspaceId: row.workspace_id,
        revisionNumber: row.revision_number,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        charts: [],
      };

      const renderedCharts = await listRenderedChartsForWorkspaceRender(row.id, row.workspace_id, row.revision_number);
      renderedWorkspace.charts = renderedCharts;

      renderedWorkspaces.push(renderedWorkspace);
    }

    return renderedWorkspaces;
  } catch (err) {
    logger.error("Failed to list workspace renders", { err });
    throw err;
  }
}

export async function getRenderedWorkspace(renderId: string): Promise<RenderedWorkspace> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const query = `
      SELECT
        id,
        workspace_id,
        revision_number,
        created_at,
        completed_at
      FROM workspace_rendered
      WHERE id = $1
    `;

    const result = await db.query(query, [renderId]);
    const renderedWorkspace: RenderedWorkspace = {
      id: result.rows[0].id,
      workspaceId: result.rows[0].workspace_id,
      revisionNumber: result.rows[0].revision_number,
      createdAt: result.rows[0].created_at,
      completedAt: result.rows[0].completed_at,
      charts: [],
    };

    const renderedCharts = await listRenderedChartsForWorkspaceRender(renderId, renderedWorkspace.workspaceId, renderedWorkspace.revisionNumber);
    renderedWorkspace.charts = renderedCharts;

    return renderedWorkspace;
  } catch (err) {
    logger.error("Failed to get rendered workspace", { err });
    throw err;
  }
}

export async function listRenderedChartsForWorkspaceRender(renderId: string, workspaceId: string, revisionNumber: number): Promise<RenderedChart[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const query = `
      SELECT
        workspace_rendered_chart.id,
        chart_id,
        workspace_chart.name,
        is_success,
        dep_update_command,
        dep_update_stdout,
        dep_update_stderr,
        helm_template_command,
        helm_template_stdout,
        helm_template_stderr,
        created_at,
        completed_at
      FROM workspace_rendered_chart
      JOIN workspace_chart ON workspace_rendered_chart.chart_id = workspace_chart.id
      WHERE workspace_render_id = $1
    `;

    const result = await db.query(query, [renderId]);
    const renderedCharts: RenderedChart[] = [];
    for (const row of result.rows) {
      const renderedChart: RenderedChart = {
        id: row.id,
        chartId: row.chart_id,
        chartName: row.name,
        isSuccess: row.is_success,
        depUpdateCommand: row.dep_update_command,
        depUpdateStdout: row.dep_update_stdout,
        depUpdateStderr: row.dep_update_stderr,
        helmTemplateCommand: row.helm_template_command,
        helmTemplateStdout: row.helm_template_stdout,
        helmTemplateStderr: row.helm_template_stderr,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        renderedFiles: [],
      };

      const renderedFiles = await listRenderedFilesForChartRender(renderedChart.chartId, workspaceId, revisionNumber);
      renderedChart.renderedFiles = renderedFiles;

      renderedCharts.push(renderedChart);
    }

    return renderedCharts;
  } catch (err) {
    logger.error("Failed to list rendered charts for workspace render", { err });
    throw err;
  }
}

export async function listRenderedFilesForChartRender(chartId: string, workspaceId: string, revisionNumber: number): Promise<RenderedFile[]> {
  try {
    logger.debug("Listing rendered files for chart render", { chartId, workspaceId, revisionNumber });
    const db = getDB(await getParam("DB_URI"));

    const query = `
      SELECT
        workspace_rendered_file.file_id,
        workspace_rendered_file.workspace_id,
        workspace_rendered_file.revision_number,
        workspace_file.file_path,
        workspace_rendered_file.content
      FROM workspace_rendered_file
      INNER JOIN workspace_file ON workspace_rendered_file.file_id = workspace_file.id
      INNER JOIN workspace_chart ON workspace_file.chart_id = workspace_chart.id
      WHERE workspace_chart.id = $1
        AND workspace_rendered_file.workspace_id = $2
        AND workspace_rendered_file.revision_number = $3
    `;

    const result = await db.query(query, [chartId, workspaceId, revisionNumber]);
    const renderedFiles: RenderedFile[] = [];
    for (const row of result.rows) {
      const renderedFile: RenderedFile = {
        id: row.id,
        filePath: row.file_path,
        renderedContent: row.content,
      };

      renderedFiles.push(renderedFile);
    }

    return renderedFiles;
  } catch (err) {
    logger.error("Failed to list rendered files for chart render", { err });
    throw err;
  }
}

export async function listRenderedFilesForWorkspace(
  workspaceId: string,
  revisionNumber?: number
): Promise<RenderedFile[]> {
  try {
    logger.debug("Listing rendered files for workspace", { workspaceId, revisionNumber });
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
