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

    // 1. Get the plan with its buffered tool calls
    const planResult = await client.query(
      `SELECT buffered_tool_calls FROM workspace_plan WHERE id = $1`,
      [planId]
    );

    if (planResult.rows.length === 0) {
      throw new Error("Plan not found");
    }

    const bufferedToolCalls: BufferedToolCall[] = 
      planResult.rows[0].buffered_tool_calls || [];

    if (bufferedToolCalls.length === 0) {
      throw new Error("No buffered tool calls to execute");
    }

    // 2. Update plan status to "applying"
    await client.query(
      `UPDATE workspace_plan SET status = 'applying', updated_at = NOW() WHERE id = $1`,
      [planId]
    );

    await client.query("COMMIT");

    // 3. Execute each buffered tool call
    // Note: We execute outside the transaction to avoid long-running transactions
    const authHeader = session.user.authHeader;
    
    for (const toolCall of bufferedToolCalls) {
      if (toolCall.toolName === "textEditor") {
        const args = toolCall.args as {
          command: string;
          path: string;
          content?: string;
          oldStr?: string;
          newStr?: string;
        };

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
        } catch (error) {
          console.error(
            `[proceedPlanAction] Failed to execute tool call ${toolCall.id}:`,
            error
          );
          // Continue executing other tool calls even if one fails
          // The user can see the partial result
        }
      }
    }

    // 4. Update plan status to "applied"
    const client2 = await db.connect();
    try {
      await client2.query(
        `UPDATE workspace_plan 
         SET status = 'applied', 
             updated_at = NOW(),
             proceed_at = NOW()
         WHERE id = $1`,
        [planId]
      );
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

