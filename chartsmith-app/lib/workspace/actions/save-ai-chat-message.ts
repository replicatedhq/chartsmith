"use server"

import { Session } from "@/lib/types/session";
import { ChatMessage } from "@/lib/types/workspace";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";
import * as srs from "secure-random-string";

/**
 * Saves a completed AI SDK chat message to the database.
 * 
 * Unlike createChatMessage which triggers worker processing,
 * this action saves already-completed AI SDK streaming messages
 * directly to the database without triggering additional workflows.
 * 
 * @param session - The user session
 * @param workspaceId - The workspace ID
 * @param prompt - The user's message
 * @param response - The AI's response
 * @returns The saved ChatMessage
 */
export async function saveAIChatMessageAction(
  session: Session,
  workspaceId: string,
  prompt: string,
  response: string
): Promise<ChatMessage> {
  logger.info("Saving AI SDK chat message", { userId: session.user.id, workspaceId });
  
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

    // Insert the message as already complete (no worker processing needed)
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
        true, true, false, false, false, false, false, null, null, null, null, null, 'auto'
      )
      RETURNING *`;

    const values = [
      chatMessageId,
      workspaceId,
      session.user.id,
      prompt,
      response,
      currentRevisionNumber,
    ];

    const result = await client.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      createdAt: row.created_at,
      userId: row.sent_by,
      prompt: row.prompt,
      response: row.response,
      revisionNumber: row.revision_number,
      isCanceled: row.is_canceled,
      isIntentComplete: row.is_intent_complete,
      isComplete: true,
      followupActions: row.followup_actions,
      responseRenderId: row.response_render_id,
      responsePlanId: row.response_plan_id,
      responseConversionId: row.response_conversion_id,
      responseRollbackToRevisionNumber: row.response_rollback_to_revision_number,
      messageFromPersona: row.message_from_persona,
    };
  } catch (err) {
    logger.error("Failed to save AI SDK chat message", { err });
    throw err;
  }
}

