import { getDB } from "../data/db";
import { getParam } from "../data/param";

import { Chart, WorkspaceFile, Workspace, Plan, ActionFile, RenderedChart } from "../types/workspace";
import * as srs from "secure-random-string";
import { logger } from "../utils/logger";

/**
 * Creates a new workspace with initialized files, charts, and content
 *
 * @param createdType - The creation method (currently only "prompt" is supported)
 * @param prompt - Optional initial chat message prompt. Required if createdType is "prompt"
 * @param userId - ID of the user creating the workspace
 * @returns A Workspace object containing the new workspace's basic info
 * @throws Will throw an error if database operations fail
 */
export async function createWorkspace(createdType: string, prompt: string | undefined, userId: string): Promise<Plan> {
  logger.info("Creating new workspace", { createdType, prompt, userId });
  try {
    const id = srs.default({ length: 12, alphanumeric: true });
    const db = getDB(await getParam("DB_URI"));

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const boostrapWorkspaceRow = await client.query(`select id, name, current_revision from bootstrap_workspace where name = $1`, ['default-workspace']);
      if (boostrapWorkspaceRow.rowCount === 0) {
        throw new Error("No default-workspace found in bootstrap_workspace table");
      }

      await client.query(
        `INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, current_revision_number)
        VALUES ($1, now(), now(), $2, $3, $4, $5)`,
        [id, boostrapWorkspaceRow.rows[0].name, userId, createdType, boostrapWorkspaceRow.rows[0].current_revision],
      );

      await client.query(`INSERT INTO workspace_revision (workspace_id, revision_number, created_at, created_by_user_id, created_type, is_complete) VALUES ($1, 0, now(), $2, $3, true)`, [id, userId, createdType]);

      const bootstrapCharts = await client.query(`SELECT id, name FROM bootstrap_chart`);
      for (const chart of bootstrapCharts.rows) {
        const chartId = srs.default({ length: 12, alphanumeric: true });
        await client.query(
          `INSERT INTO workspace_chart (id, workspace_id, name, revision_number)
          VALUES ($1, $2, $3, 0)`,
          [chartId, id, chart.name],
        );

        const boostrapChartFiles = await client.query(`SELECT file_path, content, summary, embeddings FROM bootstrap_file WHERE chart_id = $1`, [chart.id]);
        for (const file of boostrapChartFiles.rows) {
          const fileId = srs.default({ length: 12, alphanumeric: true });
          await client.query(
            `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, summary, embeddings)
            VALUES ($1, 0, $2, $3, $4, $5, $6, $7)`,
            [fileId, chartId, id, file.file_path, file.content, file.summary, file.embeddings],
          );
        }

        // create the default scenario for this chart too
        const scenarioId = srs.default({ length: 12, alphanumeric: true });
        await client.query(
          `INSERT INTO workspace_scenario (id, workspace_id, chart_id, name, description, is_read_only)
          VALUES ($1, $2, $3, 'Default', 'Apply the default values.yaml', true)`,
          [scenarioId, id, chartId],
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      // Rollback transaction on error
      await client.query("ROLLBACK");
      throw err;
    } finally {
      // Release the client back to the pool
      client.release();
    }

    const chatId: string = srs.default({ length: 12, alphanumeric: true });
    const chatClient = await db.connect();
    if (createdType === "prompt") {
      await chatClient.query(
        `INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response, revision_number)
        VALUES ($1, $2, now(), $3, $4, null, 0)`,
        [chatId, id, userId, prompt],
      );
    }

    const planId: string = srs.default({ length: 12, alphanumeric: true });
    await chatClient.query(
      `INSERT INTO workspace_plan (id, workspace_id, chat_message_ids, created_at, updated_at, version, status, is_complete)
      VALUES ($1, $2, $3, now(), now(), 0, 'pending', false)`,
      [planId, id, [chatId]],
    );

    await chatClient.query(`SELECT pg_notify('new_plan', $1)`, [planId]);

    const slackNottificationId = srs.default({ length: 12, alphanumeric: true });
    await chatClient.query(
      `INSERT INTO slack_notification (id, created_at, user_id, workspace_id, notification_type, additional_data)
      VALUES ($1, now(), $2, $3, 'new_workspace', $4)`,
      [slackNottificationId, userId, id, JSON.stringify({ createdType: createdType, prompt: prompt })],
    );
    await chatClient.query(`SELECT pg_notify('new_slack_notification', $1)`, [slackNottificationId]);

    // we have a workspace, we need to return the plan
    return getPlan(planId);

  } catch (err) {
    logger.error("Failed to create workspace", { err });
    throw err;
  }
}

export async function createPlan(userId: string, prompt: string, workspaceId: string, superceedingPlanId?: string): Promise<Plan> {
  logger.info("Creating plan", { userId, prompt, workspaceId, superceedingPlanId });
  try {
    const client = getDB(await getParam("DB_URI"));

    try {
      await client.query("BEGIN");

      if (superceedingPlanId) {
        await client.query(`UPDATE workspace_plan SET status = 'ignored' WHERE id = $1`, [superceedingPlanId]);
      }

      const workspaceRow = await client.query(`SELECT current_revision_number FROM workspace WHERE id = $1`, [workspaceId]);

      const currentRevisionNumber = workspaceRow.rows[0].current_revision_number;
      const chatId: string = srs.default({ length: 12, alphanumeric: true });
      await client.query(
        `INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response, revision_number)
        VALUES ($1, $2, now(), $3, $4, null, $5)`,
        [chatId, workspaceId, userId, prompt, currentRevisionNumber],
      );

      const planId: string = srs.default({ length: 12, alphanumeric: true });

      const newPlanChatIds = [];

      // if there was a superceeding plan, we need to get the previous chat messages since they are relevent
      if (superceedingPlanId) {
        const previousPlan = await getPlan(superceedingPlanId);

        for (const chatId of previousPlan.chatMessageIds) {
          newPlanChatIds.push(chatId);
        }
      }

      newPlanChatIds.push(chatId);

      await client.query(
        `INSERT INTO workspace_plan (id, workspace_id, chat_message_ids, created_at, updated_at, version, status, is_complete)
        VALUES ($1, $2, $3, now(), now(), 0, 'pending', false)`,
        [planId, workspaceId, newPlanChatIds],
      );

      await client.query("COMMIT");

      // notify
      await client.query(`SELECT pg_notify('new_plan', $1)`, [planId]);

      return getPlan(planId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    logger.error("Failed to create plan", { err });
    throw err;
  }
}

export async function getPlan(planId: string): Promise<Plan> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`SELECT id, description, status, workspace_id, chat_message_ids, created_at, is_complete FROM workspace_plan WHERE id = $1`, [planId]);

    const plan: Plan = {
      id: result.rows[0].id,
      description: result.rows[0].description,
      status: result.rows[0].status,
      workspaceId: result.rows[0].workspace_id,
      chatMessageIds: result.rows[0].chat_message_ids,
      createdAt: result.rows[0].created_at,
      actionFiles: [],
      isComplete: result.rows[0].is_complete,
    };

    const actionFiles = await listActionFiles(planId);
    plan.actionFiles = actionFiles;

    return plan;
  } catch (err) {
    logger.error("Failed to get plan", { err });
    throw err;
  }
}

async function listActionFiles(planId: string): Promise<ActionFile[]> {
  const db = getDB(await getParam("DB_URI"));
  const result = await db.query(`SELECT action, path, status FROM workspace_plan_action_file WHERE plan_id = $1`, [planId]);
  const actionFiles: ActionFile[] = [];

  for (const row of result.rows) {
    actionFiles.push({
      action: row.action,
      path: row.path,
      status: row.status,
    });
  }

  return actionFiles;
}

async function listFilesForWorkspace(workspaceID: string, revisionNumber: number): Promise<WorkspaceFile[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
        SELECT
          id,
          revision_number,
          chart_id,
          workspace_id,
          file_path,
          content,
          summary
        FROM
          workspace_file
        WHERE
          revision_number = $1 AND
          workspace_id = $2
      `,
      [revisionNumber, workspaceID],
    );

    if (result.rows.length === 0) {
      return [];
    }

    const files: WorkspaceFile[] = result.rows.map((row: { id: string; file_path: string; content: string; summary: string }) => {
      return {
        id: row.id,
        filePath: row.file_path,
        content: row.content,
      };
    });

    return files;
  } catch (err) {
    logger.error("Failed to list files for workspace", { err });
    throw err;
  }
}

export async function listWorkspaces(userId: string): Promise<Workspace[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                workspace.id,
                workspace.created_at,
                workspace.last_updated_at,
                workspace.name,
                workspace.created_by_user_id,
                workspace.created_type,
                workspace.current_revision_number
            FROM
                workspace
            WHERE
                workspace.created_by_user_id = $1
            ORDER BY
                workspace.last_updated_at DESC
        `,
      [userId],
    );

    const workspaces: Workspace[] = [];

    for (const row of result.rows) {
      const w: Workspace = {
        id: row.id,
        createdAt: row.created_at,
        lastUpdatedAt: row.last_updated_at,
        name: row.name,
        currentRevisionNumber: row.current_revision_number,
        files: [],
        charts: [],
        currentPlans: [],
        previousPlans: [],
        renderedCharts: [],
      };

      // get the files, only if revision number is > 0
      if (row.current_revision_number > 0) {
        const files = await listFilesForWorkspace(row.id, row.current_revision_number);
        w.files = files;
      }

      // look for an incomplete revision
      const result2 = await db.query(
        `
          SELECT
            workspace_revision.revision_number
          FROM
            workspace_revision
          WHERE
            workspace_revision.workspace_id = $1 AND
            workspace_revision.is_complete = false AND
            workspace_revision.revision_number > $2
          ORDER BY
            workspace_revision.revision_number DESC
          LIMIT 1
        `,
        [row.id, w.currentRevisionNumber],
      );

      if (result2.rows.length > 0) {
        w.incompleteRevisionNumber = result2.rows[0].revision_number;
      }

      // finally, get the rendered charts for this workspace revision
      const renderedCharts = await listRenderedChartsForWorkspace(id, w.currentRevisionNumber);
      w.renderedCharts = renderedCharts;

      workspaces.push(w);
    }

    return workspaces;
  } catch (err) {
    logger.error("Failed to list workspaces", { err });
    throw err;
  }
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                workspace.id,
                workspace.created_at,
                workspace.last_updated_at,
                workspace.name,
                workspace.created_by_user_id,
                workspace.created_type,
                workspace.current_revision_number
            FROM
                workspace
            WHERE
                workspace.id = $1
        `,
      [id],
    );

    if (result.rows.length === 0) {
      return;
    }

    const row = result.rows[0];

    const w: Workspace = {
      id: row.id,
      createdAt: row.created_at,
      lastUpdatedAt: row.last_updated_at,
      name: row.name,
      currentRevisionNumber: row.current_revision_number,
      files: [],
      charts: [],
      currentPlans: [],
      previousPlans: [],
      renderedCharts: [],
    };

    // get the charts and their files, only if revision number is > 0
    if (result.rows[0].current_revision_number > 0) {
      const charts = await listChartsForWorkspace(id, result.rows[0].current_revision_number);
      w.charts = charts;

      // Get non-chart files
      const files = await listFilesWithoutChartsForWorkspace(id, result.rows[0].current_revision_number);
      w.files = files;
    }

    // look for an incomplete revision
    const result2 = await db.query(
      `
        SELECT
          workspace_revision.revision_number
        FROM
          workspace_revision
        WHERE
          workspace_revision.workspace_id = $1 AND
          workspace_revision.is_complete = false AND
          workspace_revision.revision_number > $2
        ORDER BY
          workspace_revision.revision_number DESC
        LIMIT 1
      `,
      [id, w.currentRevisionNumber],
    );

    if (result2.rows.length > 0) {
      w.incompleteRevisionNumber = result2.rows[0].revision_number;
    }

    // get the current plan id
    const result3 = await db.query(
      `SELECT plan_id FROM workspace_revision WHERE workspace_id = $1 AND revision_number = $2`,
      [id, w.currentRevisionNumber]
    );
    const currentPlanId: string | undefined = result3.rows[0].plan_id;

    // list all plans
    const plans = await listPlans(id);

    const currentPlanCreatedAt: Date | undefined = currentPlanId ? plans.find(plan => plan.id === currentPlanId)?.createdAt : undefined;

    // iterate through them, if the plan is created before the current plan, add it to the previous plans
    for (const plan of plans) {
      if (!currentPlanCreatedAt || plan.createdAt > currentPlanCreatedAt) {
        w.currentPlans.push(plan);
      } else {
        w.previousPlans.push(plan);
      }
    }

    // finally, get the rendered charts for this workspace revision
    const renderedCharts = await listRenderedChartsForWorkspace(id, w.currentRevisionNumber);
    w.renderedCharts = renderedCharts;

    return w;
  } catch (err) {
    logger.error("Failed to get workspace", { err });
    throw err;
  }
}

async function listRenderedChartsForWorkspace(workspaceId: string, revisionNumber: number): Promise<RenderedChart[]> {
  return [];
}

async function listPlans(workspaceId: string): Promise<Plan[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`SELECT
      id, created_at, description, status, workspace_id, chat_message_ids, is_complete
      FROM workspace_plan WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]);

    const plans: Plan[] = [];

    for (const row of result.rows) {
      plans.push({
        id: row.id,
        createdAt: row.created_at,
        description: row.description,
        status: row.status,
        workspaceId: row.workspace_id,
        chatMessageIds: row.chat_message_ids,
        actionFiles: [],
        isComplete: row.is_complete,
      });
    }

    for (const plan of plans) {
      const actionFiles = await listActionFiles(plan.id);
      plan.actionFiles = actionFiles;
    }

    return plans;
  } catch (err) {
    logger.error("Failed to list plans", { err });
    throw err;
  }
}

export async function createRevision(plan: Plan, userID: string): Promise<number> {
  logger.info("Creating revision", { planId: plan.id, userID });
  const db = getDB(await getParam("DB_URI"));

  try {
    // Start transaction
    await db.query('BEGIN');


    // Create new revision and get its number
    const revisionResult = await db.query(
      `
        WITH latest_revision AS (
          SELECT * FROM workspace_revision
          WHERE workspace_id = $1
          ORDER BY revision_number DESC
          LIMIT 1
        ),
        next_revision AS (
          SELECT COALESCE(MAX(revision_number), 0) + 1 as next_num
          FROM workspace_revision
          WHERE workspace_id = $1
        )
        INSERT INTO workspace_revision (
          workspace_id, revision_number, created_at,
          created_by_user_id, created_type, is_complete
        )
        SELECT
          $1,
          next_num,
          NOW(),
          $2,
          COALESCE(lr.created_type, 'manual'),
          false
        FROM next_revision
        LEFT JOIN latest_revision lr ON true
        RETURNING revision_number
      `,
      [plan.workspaceId, userID]
    );

    const newRevisionNumber = revisionResult.rows[0].revision_number;
    const previousRevisionNumber = newRevisionNumber - 1;

    // Copy workspace_chart records from previous revision
    const previousCharts = await db.query(
      `
        SELECT
          id,
          name
        FROM workspace_chart
        WHERE workspace_id = $1 AND revision_number = $2
      `,
      [plan.workspaceId, previousRevisionNumber]
    );

    // insert workspace_chart records with same IDs but new revision number
    for (const chart of previousCharts.rows) {
      await db.query(
        `INSERT INTO workspace_chart (id, revision_number, workspace_id, name) VALUES ($1, $2, $3, $4)`,
        [chart.id, newRevisionNumber, plan.workspaceId, chart.name]
      );
    }

    // Copy workspace_file records from previous revision
    const previousFiles = await db.query(
      `
        SELECT
          id,
          chart_id,
          workspace_id,
          file_path,
          content,
          summary,
          embeddings
        FROM workspace_file
        WHERE workspace_id = $1
        AND revision_number = $2
      `,
      [plan.workspaceId, previousRevisionNumber]
    );

    // Insert workspace_file records with same IDs but new revision number
    for (const file of previousFiles.rows) {
      await db.query(
        `
          INSERT INTO workspace_file (
            id, revision_number, chart_id, workspace_id, file_path,
            content, summary, embeddings
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          file.id,  // Keep the same ID
          newRevisionNumber,
          file.chart_id,
          file.workspace_id,
          file.file_path,
          file.content,
          file.summary,
          file.embeddings
        ]
      );
    }

    // update the workspace to make this the current revision
    await db.query(`UPDATE workspace SET current_revision_number = $1 WHERE id = $2`, [newRevisionNumber, plan.workspaceId]);

    // Commit transaction
    await db.query('COMMIT');

    // Notify about new revision, after the commit
    await db.query(
      `SELECT pg_notify('execute_plan', $1)`,
      [plan.id]
    );

    return newRevisionNumber;

  } catch (err) {
    // Rollback transaction on error
    await db.query('ROLLBACK');
    logger.error("Failed to create revision", { err });
    throw err;
  }
}

async function listChartsForWorkspace(workspaceID: string, revisionNumber: number): Promise<Chart[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
        SELECT
          id,
          name
        FROM
          workspace_chart
        WHERE
          workspace_id = $1 AND revision_number = $2
      `,
      [workspaceID, revisionNumber]
    );

    if (result.rows.length === 0) {
      return [];
    }

    const charts: Chart[] = result.rows.map((row: { id: string; name: string }) => {
      return {
        id: row.id,
        name: row.name,
        files: [],
       };
    });

    // get the files for each chart
    for (const chart of charts) {
      const files = await listFilesForChart(workspaceID, chart.id, revisionNumber);
      chart.files = files;
    }

    return charts;

  } catch (err) {
    logger.error("Failed to list charts for workspace", { err });
    throw err;
  }
}

async function listFilesForChart(workspaceID: string, chartID: string, revisionNumber: number): Promise<WorkspaceFile[]> {
  logger.debug(`listFilesForChart`, { workspaceID, chartID, revisionNumber });
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
        SELECT
          id,
          revision_number,
          chart_id,
          workspace_id,
          file_path,
          content,
          summary
        FROM
          workspace_file
        WHERE
          workspace_file.chart_id = $1 AND workspace_file.revision_number = $2
      `,
      [chartID, revisionNumber]
    );

    if (result.rows.length === 0) {
      return [];
    }

    const files: WorkspaceFile[] = result.rows.map((row: { id: string; file_path: string; content: string; summary: string }) => {
      return {
        id: row.id,
        filePath: row.file_path,
        content: row.content,
      };
    });

    return files;
  } catch (err){
    logger.error("Failed to list files for chart", { err });
    throw err;
  }
}

async function listFilesWithoutChartsForWorkspace(workspaceID: string, revisionNumber: number): Promise<WorkspaceFile[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
        SELECT
          id,
          revision_number,
          chart_id,
          workspace_id,
          file_path,
          content,
          summary
        FROM
          workspace_file
        WHERE
          revision_number = $1 AND
          workspace_id = $2 AND
          chart_id IS NULL
      `,
      [revisionNumber, workspaceID],
    );

    if (result.rows.length === 0) {
      return [];
    }

    const files: WorkspaceFile[] = result.rows.map((row: { id: string; file_path: string; content: string; summary: string }) => {
      return {
        id: row.id,
        filePath: row.file_path,
        content: row.content,
      };
    });

    return files;
  } catch (err) {
    logger.error("Failed to list files without charts for workspace", { err });
    throw err;
  }
}
