"use server";

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { callGoEndpoint } from "@/lib/ai/tools/utils";

/**
 * Buffered tool call structure matching Go backend
 */
interface BufferedToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

/**
 * Response from textEditor Go endpoint
 */
interface TextEditorResponse {
  success: boolean;
  content?: string;
  message?: string;
}

/**
 * Publishes a plan update event via Go backend to notify frontend of status changes
 */
async function publishPlanUpdate(
  workspaceId: string,
  planId: string,
  authHeader?: string
): Promise<void> {
  try {
    await callGoEndpoint<{ success: boolean }>(
      "/api/plan/publish-update",
      { workspaceId, planId },
      authHeader
    );
  } catch (error) {
    console.error("[proceedPlanAction] Failed to publish plan update:", error);
    // Don't throw - this is a best-effort notification
  }
}

/**
 * Updates the status of a single action file and publishes the plan update.
 * This enables file-by-file progress updates in the UI during plan execution.
 */
async function updateActionFileStatus(
  workspaceId: string,
  planId: string,
  path: string,
  status: "pending" | "creating" | "created",
  authHeader?: string
): Promise<void> {
  try {
    await callGoEndpoint<{ success: boolean }>(
      "/api/plan/update-action-file-status",
      { workspaceId, planId, path, status },
      authHeader
    );
  } catch (error) {
    console.error(
      `[proceedPlanAction] Failed to update action file status for ${path}:`,
      error
    );
    // Don't throw - this is a best-effort notification
  }
}

/**
 * Executes buffered tool calls for a plan when user clicks Proceed
 *
 * This action:
 * 1. Fetches the plan and its buffered tool calls
 * 2. Updates the plan status to "applying"
 * 3. Executes each buffered tool call via Go backend
 * 4. Updates the plan status to "applied" on success
 *
 * @param session - User session for authorization
 * @param planId - The plan ID to proceed with
 * @param workspaceId - The workspace ID
 * @param revisionNumber - The current revision number
 */
export async function proceedPlanAction(
  session: Session,
  planId: string,
  workspaceId: string,
  revisionNumber: number
): Promise<void> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const db = getDB(await getParam("DB_URI"));
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Get the plan with its buffered tool calls and status
    const planResult = await client.query(
      `SELECT status, buffered_tool_calls FROM workspace_plan WHERE id = $1`,
      [planId]
    );

    if (planResult.rows.length === 0) {
      throw new Error("Plan not found");
    }

    const planStatus = planResult.rows[0].status;
    const bufferedToolCalls: BufferedToolCall[] = 
      planResult.rows[0].buffered_tool_calls || [];

    // Validate plan is in correct status
    if (planStatus !== 'review') {
      throw new Error(`Plan is not in review status (current: ${planStatus})`);
    }

    if (bufferedToolCalls.length === 0) {
      throw new Error("No buffered tool calls to execute");
    }

    // 2. Update plan status to "applying"
    await client.query(
      `UPDATE workspace_plan SET status = 'applying', updated_at = NOW() WHERE id = $1`,
      [planId]
    );

    await client.query("COMMIT");

    // Notify frontend of status change to 'applying'
    const authHeader = session.user.authHeader;
    await publishPlanUpdate(workspaceId, planId, authHeader);

    // 3. Execute each buffered tool call
    // Note: We execute outside the transaction to avoid long-running transactions
    let successCount = 0;
    let failureCount = 0;
    
    for (const toolCall of bufferedToolCalls) {
      if (toolCall.toolName === "textEditor") {
        const args = toolCall.args as {
          command: string;
          path: string;
          content?: string;
          oldStr?: string;
          newStr?: string;
        };

        // PR3.2: Mark file as 'creating' before execution (shows spinner in UI)
        await updateActionFileStatus(
          workspaceId,
          planId,
          args.path,
          "creating",
          authHeader
        );

        try {
          await callGoEndpoint<TextEditorResponse>(
            "/api/tools/editor",
            {
              command: args.command,
              workspaceId,
              path: args.path,
              content: args.content,
              oldStr: args.oldStr,
              newStr: args.newStr,
              revisionNumber,
            },
            authHeader
          );

          // PR3.2: Mark file as 'created' after success (shows checkmark in UI)
          await updateActionFileStatus(
            workspaceId,
            planId,
            args.path,
            "created",
            authHeader
          );
          successCount++;
        } catch (error) {
          console.error(
            `[proceedPlanAction] Failed to execute tool call ${toolCall.id}:`,
            error
          );
          failureCount++;
          // Continue executing other tool calls even if one fails
          // The user can see the partial result
          // Note: On failure, file remains in 'creating' status
        }
      }
    }

    // 4. Update plan status based on results
    const client2 = await db.connect();
    try {
      if (successCount === 0 && failureCount > 0) {
        // All tool calls failed - reset to review so user can retry
        console.error('[proceedPlanAction] All tool calls failed, resetting to review');
        await client2.query(
          `UPDATE workspace_plan
           SET status = 'review',
               updated_at = NOW()
           WHERE id = $1`,
          [planId]
        );
        // Notify frontend of status change back to 'review'
        await publishPlanUpdate(workspaceId, planId, authHeader);
        throw new Error(`All ${failureCount} tool calls failed. Plan reset to review.`);
      } else {
        // At least some succeeded - mark as applied
        await client2.query(
          `UPDATE workspace_plan
           SET status = 'applied',
               updated_at = NOW(),
               proceed_at = NOW()
           WHERE id = $1`,
          [planId]
        );
        // Notify frontend of status change to 'applied'
        await publishPlanUpdate(workspaceId, planId, authHeader);
        if (failureCount > 0) {
          console.warn(`[proceedPlanAction] Partial success: ${successCount}/${successCount + failureCount} tool calls succeeded`);
        }
      }
    } finally {
      client2.release();
    }

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Marks a plan as ignored without executing any tool calls
 *
 * @param session - User session for authorization
 * @param planId - The plan ID to ignore
 */
export async function ignorePlanAction(
  session: Session,
  planId: string
): Promise<void> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const db = getDB(await getParam("DB_URI"));

  await db.query(
    `UPDATE workspace_plan 
     SET status = 'ignored', 
         updated_at = NOW()
     WHERE id = $1`,
    [planId]
  );
}

