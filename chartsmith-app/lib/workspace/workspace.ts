import { getDB } from "../data/db";
import { getParam } from "../data/param";

import { Chart, WorkspaceFile, Workspace, Plan, ActionFile, ChatMessage, FollowupAction, Conversion, ConversionStatus, ConversionFileStatus, ConversionFile } from "../types/workspace";
import * as srs from "secure-random-string";
import { logger } from "../utils/logger";
import { enqueueWork } from "../utils/queue";

/**
 * Creates a new workspace with initialized files, charts, and content
 */
export async function createWorkspace(createdType: string, userId: string, createChartMessageParams: CreateChatMessageParams, baseChart?: Chart, looseFiles?: WorkspaceFile[]): Promise<Workspace> {
  logger.info("Creating new workspace", { createdType, userId });
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

      // Determine initial revision number based on baseChart presence
      const initialRevisionNumber = baseChart ? 1 : 0;

      await client.query(
        `INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, current_revision_number)
        VALUES ($1, now(), now(), $2, $3, $4, $5)`,
        [id, boostrapWorkspaceRow.rows[0].name, userId, createdType, initialRevisionNumber],
      );

      await client.query(`INSERT INTO workspace_revision (workspace_id, revision_number, created_at, created_by_user_id, created_type, is_complete, is_rendered) VALUES ($1, $2, now(), $3, $4, true, false)`, [
        id, initialRevisionNumber, userId, createdType]);

      // We'll enqueue rendering after the commit completes
      const shouldEnqueueRender = true;

      if (baseChart) {
        // Use the provided baseChart
        const chartId = srs.default({ length: 12, alphanumeric: true });
        await client.query(
          `INSERT INTO workspace_chart (id, workspace_id, name, revision_number)
          VALUES ($1, $2, $3, $4)`,
          [chartId, id, baseChart.name, initialRevisionNumber],
        );

        for (const file of baseChart.files) {
          // TODO we need to add summary and embeddings here since we don't have a bootstrap_file
          const fileId = srs.default({ length: 12, alphanumeric: true });

          try {
          await client.query(
            `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, embeddings)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [fileId, initialRevisionNumber, chartId, id, file.filePath, file.content, null],
            );
          } catch (err) {
            logger.error("Failed to insert workspace file", { err });
            throw err;
          }
        }
      } else if (createdType !== "archive") {
        // Fallback to bootstrap charts if baseChart is not provided
        const bootstrapCharts = await client.query(`SELECT id, name FROM bootstrap_chart`);
        for (const chart of bootstrapCharts.rows) {
          const chartId = srs.default({ length: 12, alphanumeric: true });
          await client.query(
            `INSERT INTO workspace_chart (id, workspace_id, name, revision_number)
            VALUES ($1, $2, $3, $4)`,
            [chartId, id, chart.name, initialRevisionNumber],
          );

          const boostrapChartFiles = await client.query(`SELECT file_path, content, embeddings FROM bootstrap_file WHERE chart_id = $1`, [chart.id]);
          for (const file of boostrapChartFiles.rows) {
            const fileId = srs.default({ length: 12, alphanumeric: true });
            await client.query(
              `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, embeddings)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [fileId, initialRevisionNumber, chartId, id, file.file_path, file.content, file.embeddings],
            );
          }

          // if we have loose files, add them to the workspace
          if (looseFiles) {
            for (const file of looseFiles) {
              const fileId = srs.default({ length: 12, alphanumeric: true });
              await client.query(
                `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, embeddings)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [fileId, initialRevisionNumber, null, id, file.filePath, file.content, null],
              );
            }
          }
        }
      }

      await client.query("COMMIT");

      // create the chat message
      const chatMessage = await createChatMessage(userId, id, createChartMessageParams);

      // now that that's commited, let's get all of the file ids, and notify the worker so that we capture embeddings
      const files = await listFilesForWorkspace(id, initialRevisionNumber);
      for (const file of files) {
        await enqueueWork("new_summarize", {
          fileId: file.id,
          revision: initialRevisionNumber,
        });
      }

      // Enqueue a render job for the initial revision
      if (shouldEnqueueRender) {
        // Enqueue the render and associate it with the system chat message
        await renderWorkspace(id, chatMessage.id, initialRevisionNumber);
      }
    } catch (err) {
      // Rollback transaction on error
      await client.query("ROLLBACK");
      throw err;
    } finally {
      // Release the client back to the pool
      client.release();
    }

    const w = await getWorkspace(id);
    if (!w) {
      throw new Error("Failed to create workspace");
    }

    return w;
  } catch (err) {
    logger.error("Failed to create workspace", { err });
    throw err;
  }
}

export enum ChatMessageIntent {
  PLAN = "plan",
  NON_PLAN = "non-plan",
  RENDER = "render",
  CONVERT_K8S_TO_HELM = "convert-k8s-to-helm",
}

export enum ChatMessageFromPersona {
  AUTO = "auto",
  DEVELOPER = "developer",
  OPERATOR = "operator",
}

export interface CreateChatMessageParams {
  prompt?: string;
  response?: string;
  knownIntent?: ChatMessageIntent;
  followupActions?: FollowupAction[];
  additionalFiles?: WorkspaceFile[];
  responseRollbackToRevisionNumber?: number;
  messageFromPersona?: ChatMessageFromPersona;
}

export async function createChatMessage(userId: string, workspaceId: string, params: CreateChatMessageParams): Promise<ChatMessage> {
  logger.info("Creating chat message", { userId, workspaceId, params });
  try {
    const client = getDB(await getParam("DB_URI"));
    const chatMessageId = srs.default({ length: 12, alphanumeric: true });

    // Get the current revision number for this workspace
    const workspaceResult = await client.query(
      `SELECT current_revision_number FROM workspace WHERE id = $1`,
      [workspaceId]
    );

    if (workspaceResult.rows.length === 0) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const currentRevisionNumber = workspaceResult.rows[0].current_revision_number;

    const query = `
      INSERT INTO workspace_chat (
        id,
        workspace_id,
        created_at,
        sent_by,
        prompt,
        response,
        revision_number,
        is_canceled,
        is_intent_complete,
        is_intent_conversational,
        is_intent_plan,
        is_intent_off_topic,
        is_intent_chart_developer,
        is_intent_chart_operator,
        is_intent_render,
        followup_actions,
        response_render_id,
        response_plan_id,
        response_conversion_id,
        response_rollback_to_revision_number,
        message_from_persona
      )
      VALUES (
        $1, $2, now(), $3, $4, $5, $6, false,
        $7, $8, $9, false, false, false, $10, $11, null, null, null, $12, $13
      )`;

    const values = [
      chatMessageId,
      workspaceId,
      userId,
      params.prompt,
      params.response,
      currentRevisionNumber, // Use the current revision number instead of hardcoded 0
      params.knownIntent ? true : false,
      params.knownIntent === ChatMessageIntent.NON_PLAN,
      params.knownIntent === ChatMessageIntent.PLAN,
      params.knownIntent === ChatMessageIntent.RENDER,
      params.followupActions ? JSON.stringify(params.followupActions) : null,
      params.responseRollbackToRevisionNumber,
      params.messageFromPersona,
    ];

    await client.query(query, values);

    if (!params.knownIntent) {
      await enqueueWork("new_intent", {
        chatMessageId,
        workspaceId,
      });
    } else if (params.knownIntent === ChatMessageIntent.PLAN) {
      // we need to create the plan record and then notify the worker so that it can start processing the plan
      const plan = await createPlan(userId, workspaceId, chatMessageId);
      await enqueueWork("new_plan", {
        planId: plan.id,
        additionalFiles: params.additionalFiles,
      });
    } else if (params.knownIntent === ChatMessageIntent.NON_PLAN) {
      // Enqueue work for Next.js API route to handle conversational chat with Vercel AI SDK
      await enqueueWork("new_ai_sdk_chat", {
        chatMessageId,
        workspaceId,
      });
    } else if (params.knownIntent === ChatMessageIntent.RENDER) {
      await renderWorkspace(workspaceId, chatMessageId);
    } else if (params.knownIntent === ChatMessageIntent.CONVERT_K8S_TO_HELM) {
      // this is a special type of a plan
      const conversion = await createConversion(userId, workspaceId, chatMessageId, params.additionalFiles || []);
      await enqueueWork("new_conversion", {
        conversionId: conversion.id,
      });
    }

    return getChatMessage(chatMessageId);
  } catch (err) {
    logger.error("Failed to create chat message", { err });
    throw err;
  }
}

export async function createConversion(userId: string, workspaceId: string, chatMessageId: string, sourceFiles: WorkspaceFile[]): Promise<Conversion> {
  logger.info("Creating conversion", { userId, workspaceId, chatMessageId });
  try {
    const client = getDB(await getParam("DB_URI"));

    try {
      await client.query("BEGIN");

      const conversionId: string = srs.default({ length: 12, alphanumeric: true });

      await client.query(`INSERT INTO workspace_conversion (id, workspace_id, chat_message_ids, created_at, updated_at, source_type, status) VALUES ($1, $2, $3, now(), now(), $4, $5)`, [conversionId, workspaceId, [chatMessageId], "k8s", ConversionStatus.Pending]);

      for (const file of sourceFiles) {
        const fileId: string = srs.default({ length: 12, alphanumeric: true });
        await client.query(`INSERT INTO workspace_conversion_file (id, conversion_id, file_path, file_content, file_status) VALUES ($1, $2, $3, $4, $5)`, [fileId, conversionId, file.filePath, file.content, ConversionFileStatus.Pending]);
      }

      await client.query("COMMIT");

      // update the chat message with the conversion id
      await client.query("UPDATE workspace_chat SET response_conversion_id = $1 WHERE id = $2", [conversionId, chatMessageId]);

      return getConversion(conversionId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    logger.error("Failed to create conversion", { err });
    throw err;
  }
}

export async function getConversion(conversionId: string): Promise<Conversion> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`SELECT id, workspace_id, chat_message_ids, created_at, updated_at, source_type, status FROM workspace_conversion WHERE id = $1`, [conversionId]);

    const conversion: Conversion = {
      id: result.rows[0].id,
      workspaceId: result.rows[0].workspace_id,
      chatMessageIds: result.rows[0].chat_message_ids,
      createdAt: result.rows[0].created_at,
      sourceType: result.rows[0].source_type,
      status: result.rows[0].status,
      sourceFiles: [],
    }

    // get the source files
    const sourceFiles = await db.query(`SELECT id, file_path, file_content, file_status FROM workspace_conversion_file WHERE conversion_id = $1 AND file_path IS NOT NULL AND file_content IS NOT NULL`, [conversionId]);
    for (const file of sourceFiles.rows) {
      const conversionFile: ConversionFile = {
        id: file.id,
        filePath: file.file_path,
        content: file.file_content,
        status: file.file_status,
      }

      conversion.sourceFiles.push(conversionFile);
    }

    // sort the conversion files by GVK, same as we do in go
    // this just makes sure that the list is returned in the same order we will process them
    // which polishes the UI a little
    conversion.sourceFiles = sortByConversionOrder(conversion.sourceFiles);

    return conversion;
  } catch (err) {
    logger.error("Failed to get conversion", { err });
    throw err;
  }
}

// Helper function to sort conversion files by GVK priority
function sortByConversionOrder(files: ConversionFile[]): ConversionFile[] {
  return [...files].sort((a, b) => {
    // Extract GVK and name from file content
    const [aGVK, aName] = extractGVKAndName(a.content);
    const [bGVK, bName] = extractGVKAndName(b.content);

    // Get GVK priority
    const aPriority = getGVKPriority(aGVK);
    const bPriority = getGVKPriority(bGVK);

    // If priorities are different, sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // If GVKs are different, sort alphabetically by GVK
    if (aGVK !== bGVK) {
      return aGVK.localeCompare(bGVK);
    }

    // If GVKs are the same, sort by name
    return aName.localeCompare(bName);
  });
}

// Extract GVK and name from YAML content
function extractGVKAndName(content: string): [string, string] {
  try {
    // Simple YAML parsing to extract apiVersion, kind, and metadata.name
    const lines = content.split('\n');
    let apiVersion = '';
    let kind = '';
    let name = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('apiVersion:')) {
        apiVersion = trimmedLine.substring('apiVersion:'.length).trim();
      } else if (trimmedLine.startsWith('kind:')) {
        kind = trimmedLine.substring('kind:'.length).trim();
      } else if (trimmedLine.startsWith('name:') && name === '') {
        // Only capture the first name we find (should be in metadata)
        name = trimmedLine.substring('name:'.length).trim();
      }

      // If we have all the information, break early
      if (apiVersion && kind && name) {
        break;
      }
    }

    return [`${apiVersion}/${kind}`, name];
  } catch (error) {
    logger.debug("Failed to parse YAML content", { error });
    return ['', ''];
  }
}

// Get priority value for a GVK, matching the Go implementation
function getGVKPriority(gvk: string): number {
  switch (gvk) {
    case 'v1/ConfigMap':
      return 0;
    case 'v1/Secret':
      return 1;
    case 'v1/PersistentVolumeClaim':
      return 2;
    case 'v1/ServiceAccount':
      return 3;
    case 'v1/Role':
      return 4;
    case 'v1/RoleBinding':
      return 5;
    case 'v1/ClusterRole':
      return 6;
    case 'v1/ClusterRoleBinding':
      return 7;
    case 'apps/v1/Deployment':
      return 8;
    case 'v1/StatefulSet':
      return 9;
    case 'v1/Service':
      return 10;
    default:
      return 11;
  }
}

export async function createPlan(userId: string, workspaceId: string, chatMessageId: string, superceedingPlanId?: string): Promise<Plan> {
  logger.info("Creating plan", { userId, workspaceId, chatMessageId, superceedingPlanId });
  try {
    const client = getDB(await getParam("DB_URI"));

    try {
      await client.query("BEGIN");

      if (superceedingPlanId) {
        await client.query(`UPDATE workspace_plan SET status = 'ignored' WHERE id = $1`, [superceedingPlanId]);
      }

      const planId: string = srs.default({ length: 12, alphanumeric: true });

      const newPlanChatIds = [];

      // if there was a superceeding plan, we need to get the previous chat messages since they are relevent
      if (superceedingPlanId) {
        const previousPlan = await getPlan(superceedingPlanId);

        for (const chatId of previousPlan.chatMessageIds) {
          newPlanChatIds.push(chatId);
        }
      }

      newPlanChatIds.push(chatMessageId);

      await client.query(
        `INSERT INTO workspace_plan (id, workspace_id, chat_message_ids, created_at, updated_at, version, status, proceed_at)
        VALUES ($1, $2, $3, now(), now(), 0, 'pending', null)`,
        [planId, workspaceId, newPlanChatIds],
      );

      // set the response_plan_id in the chat message
      await client.query("UPDATE workspace_chat SET response_plan_id = $1 WHERE id = $2", [planId, chatMessageId]);

      await client.query("COMMIT");

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

export async function getChatMessage(chatMessageId: string): Promise<ChatMessage> {
  try {
    const db = getDB(await getParam("DB_URI"));

    const query = `
      SELECT
        id,
        prompt,
        response,
        created_at,
        is_canceled,
        is_intent_complete,
        followup_actions,
        response_render_id,
        response_plan_id,
        response_conversion_id,
        response_rollback_to_revision_number,
        revision_number,
        sent_by,
        message_from_persona
      FROM workspace_chat
      WHERE id = $1`;

    const result = await db.query(query, [chatMessageId]);

    const chatMessage: ChatMessage = {
      id: result.rows[0].id,
      prompt: result.rows[0].prompt,
      response: result.rows[0].response,
      createdAt: result.rows[0].created_at,
      isIntentComplete: result.rows[0].is_intent_complete,
      isCanceled: result.rows[0].is_canceled,
      followupActions: result.rows[0].followup_actions,
      responseRenderId: result.rows[0].response_render_id,
      responsePlanId: result.rows[0].response_plan_id,
      responseConversionId: result.rows[0].response_conversion_id,
      responseRollbackToRevisionNumber: result.rows[0].response_rollback_to_revision_number,
      revisionNumber: result.rows[0].revision_number,
      isComplete: true,
      messageFromPersona: result.rows[0].message_from_persona,
      userId: result.rows[0].sent_by,
    };

    return chatMessage;
  } catch (err) {
    logger.error("Failed to get chat message", { err });
    throw err;
  }
}

export async function getPlan(planId: string): Promise<Plan> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`SELECT id, description, status, workspace_id, chat_message_ids, created_at, proceed_at FROM workspace_plan WHERE id = $1`, [planId]);

    const plan: Plan = {
      id: result.rows[0].id,
      description: result.rows[0].description,
      status: result.rows[0].status,
      workspaceId: result.rows[0].workspace_id,
      chatMessageIds: result.rows[0].chat_message_ids,
      createdAt: result.rows[0].created_at,
      actionFiles: [],
      proceedAt: result.rows[0].proceed_at,
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
          content_pending
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

    const files: WorkspaceFile[] = result.rows.map((row: { id: string; revision_number: number; file_path: string; content: string; summary: string, content_pending?: string }) => {
      return {
        id: row.id,
        revisionNumber: row.revision_number,
        filePath: row.file_path,
        content: row.content,
        contentPending: row.content_pending,
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

      workspaces.push(w);
    }

    return workspaces;
  } catch (err) {
    logger.error("Failed to list workspaces", { err });
    throw err;
  }
}

export async function renderWorkspace(workspaceId: string, chatMessageId: string, revisionNumber?: number, chartId?: string) {
  try {
    const db = getDB(await getParam("DB_URI"));

    if (!revisionNumber || !chartId) {
      const workspace = await getWorkspace(workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      if (!revisionNumber) {
        revisionNumber = workspace.currentRevisionNumber;
      }

      if (!chartId && workspace.charts.length === 0) {
        return;
      }

      if (!chartId) {
        chartId = workspace.charts[0].id;
      }
    }

    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const id = srs.default({ length: 12, alphanumeric: true });

    const client = await db.connect()
    try {
      await client.query("BEGIN");

      await client.query(`INSERT INTO workspace_rendered (id, workspace_id, revision_number, created_at, is_autorender)
        VALUES ($1, $2, $3, now(), false)`, [id, workspaceId, revisionNumber]);

      for (const chart of workspace.charts) {
        const chartRenderId = srs.default({ length: 12, alphanumeric: true });
        await client.query(`INSERT INTO workspace_rendered_chart (id, workspace_render_id, chart_id, is_success, created_at)
          VALUES ($1, $2, $3, $4, now())`, [chartRenderId, id, chart.id, false]);
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }


    const query = `UPDATE workspace_chat SET response_render_id = $1 WHERE id = $2`;
    await db.query(query, [id, chatMessageId]);

    await enqueueWork("render_workspace", { id });
  } catch (err) {
    logger.error("Failed to render workspace", { err });
    throw err;
  }
}

export async function countFilesWithPendingContent(workspaceId: string, revisionNumber: number): Promise<number> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`SELECT count(1) FROM workspace_file WHERE workspace_id = $1 AND revision_number = $2 AND content_pending IS NOT NULL`, [workspaceId, revisionNumber]);
    return result.rows[0].count;
  } catch (err) {
    logger.error("Failed to count files with pending content", { err });
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
      isCurrentVersionComplete: true,
    };

    // get the charts and their files, only if revision number is > 0
    if (result.rows[0].current_revision_number > 0) {
      const charts = await listChartsForWorkspace(id, result.rows[0].current_revision_number);
      w.charts = charts;

      // Get non-chart files
      const files = await listFilesWithoutChartsForWorkspace(id, result.rows[0].current_revision_number);
      w.files = files;
    }

    // check if the current revision is complete
    const result3 = await db.query(
      `
        SELECT is_complete FROM workspace_revision WHERE workspace_id = $1 AND revision_number = $2
      `,
      [id, w.currentRevisionNumber],
    );

    if (result3.rows.length > 0) {
      w.isCurrentVersionComplete = result3.rows[0].is_complete;
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

    return w;
  } catch (err) {
    logger.error("Failed to get workspace", { err });
    throw err;
  }
}

export async function listPlans(workspaceId: string): Promise<Plan[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`SELECT
      id, created_at, description, status, workspace_id, chat_message_ids, proceed_at
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
        proceedAt: row.proceed_at,
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

export async function rollbackToRevision(workspaceId: string, revisionNumber: number) {
  logger.info("Rolling back to revision", { workspaceId, revisionNumber });

  const db = getDB(await getParam("DB_URI"));

  try {
    await db.query('BEGIN');

    await db.query(`update workspace set current_revision_number = $1 where id = $2`, [revisionNumber, workspaceId]);
    await db.query(`delete from workspace_revision where workspace_id = $1 and revision_number > $2`, [workspaceId, revisionNumber]);

    // get the render ids
    const result = await db.query(`select id from workspace_rendered where workspace_id = $1 and revision_number > $2`, [workspaceId, revisionNumber]);
    const renderIds = result.rows.map((row: { id: string }) => row.id);

    await db.query(`delete from workspace_rendered where workspace_id = $1 and revision_number > $2`, [workspaceId, revisionNumber]);

    // Only run the delete queries if there are render IDs to delete
    if (renderIds.length > 0) {
      // Properly escape render IDs as prepared statement parameters
      const placeholders = renderIds.map((_, idx) => `$${idx + 1}`).join(',');
      await db.query(`delete from workspace_rendered_chart where workspace_render_id in (${placeholders})`, renderIds);
      await db.query(`delete from workspace_rendered_file where workspace_render_id in (${placeholders})`, renderIds);
    }

    // get the chat message ids for later revisions
    const chatMessageResult = await db.query(`select id from workspace_chat where workspace_id = $1 and revision_number > $2`, [workspaceId, revisionNumber]);
    const chatMessageIds = chatMessageResult.rows.map((row: { id: string }) => row.id);

    await db.query(`delete from workspace_chat where workspace_id = $1 and revision_number > $2`, [workspaceId, revisionNumber]);

    // get the plan ids for later revisions
    const planResult = await db.query(`select id from workspace_plan where workspace_id = $1 and chat_message_ids @> $2`, [workspaceId, chatMessageIds]);
    const planIds = planResult.rows.map((row: { id: string }) => row.id);

    const planIdPlaceholders = planIds.map((_, idx) => `$${idx + 1}`).join(',');
    await db.query(`delete from workspace_plan_action_file where plan_id in (${planIdPlaceholders})`, planIds);

    await db.query(`delete from workspace_plan where id in (${planIdPlaceholders})`, planIds);


    await db.query(`delete from workspace_file where workspace_id = $1 and revision_number > $2`, [workspaceId, revisionNumber]);

    await db.query(`delete from workspace_chart where workspace_id = $1 and revision_number > $2`, [workspaceId, revisionNumber]);


    await db.query('COMMIT');

    // Find the chat message that initiated the rollback to associate it with the render
    const chatMessages = await db.query(`
      SELECT id FROM workspace_chat
      WHERE workspace_id = $1 AND response_rollback_to_revision_number = $2
      ORDER BY created_at DESC LIMIT 1`,
      [workspaceId, revisionNumber]
    );

    let chatMessageId = "";
    if (chatMessages?.rowCount && chatMessages.rowCount > 0) {
      chatMessageId = chatMessages.rows[0].id;
    }

    // After successful rollback, enqueue a render job for the revision we rolled back to
    await enqueueWork("render_workspace", {
      workspaceId: workspaceId,
      revisionNumber: revisionNumber,
      chatMessageId: chatMessageId // Associate with the rollback chat message
    });
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

export async function createRevision(plan: Plan, userID: string): Promise<number> {
  logger.info("Creating revision", { planId: plan.id, userID });
  const db = getDB(await getParam("DB_URI"));

  try {
    // Start transaction
    await db.query('BEGIN');

    // set the plan as proceed_at now
    await db.query(`UPDATE workspace_plan SET proceed_at = now() WHERE id = $1`, [plan.id]);

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
          created_by_user_id, created_type, is_complete, is_rendered
        )
        SELECT
          $1,
          next_num,
          NOW(),
          $2,
          COALESCE(lr.created_type, 'manual'),
          false,
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
            content, embeddings
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          file.id,  // Keep the same ID
          newRevisionNumber,
          file.chart_id,
          file.workspace_id,
          file.file_path,
          file.content,
          file.embeddings
        ]
      );
    }

    // update the workspace to make this the current revision
    await db.query(`UPDATE workspace SET current_revision_number = $1 WHERE id = $2`, [newRevisionNumber, plan.workspaceId]);

    // Commit transaction
    await db.query('COMMIT');

    await enqueueWork("execute_plan", { planId: plan.id });

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
          content_pending
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

    const files: WorkspaceFile[] = result.rows.map((row: { id: string; revision_number: number; file_path: string; content: string; summary: string, content_pending?: string }) => {
      return {
        id: row.id,
        revisionNumber: row.revision_number,
        filePath: row.file_path,
        content: row.content,
        contentPending: row.content_pending,
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
          content_pending
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

    const files: WorkspaceFile[] = result.rows.map((row: { id: string; revision_number: number; file_path: string; content: string; summary: string, content_pending?: string }) => {
      return {
        id: row.id,
        revisionNumber: row.revision_number,
        filePath: row.file_path,
        content: row.content,
        contentPending: row.content_pending,
      };
    });

    return files;
  } catch (err) {
    logger.error("Failed to list files without charts for workspace", { err });
    throw err;
  }
}

export async function deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
  logger.info("Deleting workspace", { workspaceId, userId });
  const db = getDB(await getParam("DB_URI"));

  try {
    // Verify the workspace belongs to the user
    const workspaceResult = await db.query(
      `SELECT created_by_user_id FROM workspace WHERE id = $1`,
      [workspaceId]
    );

    if (workspaceResult.rows.length === 0) {
      throw new Error("Workspace not found");
    }

    if (workspaceResult.rows[0].created_by_user_id !== userId) {
      throw new Error("Unauthorized");
    }

    // Delete the workspace (cascade will handle related records)
    await db.query(`DELETE FROM workspace WHERE id = $1`, [workspaceId]);

    logger.info("Workspace deleted successfully", { workspaceId });
  } catch (err) {
    logger.error("Failed to delete workspace", { err });
    throw err;
  }
}
