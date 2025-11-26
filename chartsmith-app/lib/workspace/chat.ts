import { Message } from "@/components/types";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import * as srs from "secure-random-string";
import { logger } from "../utils/logger";
import { ChatMessage } from "../types/workspace";
import { getChatMessage } from "./workspace";

export async function setMessageIgnored(_workspaceID: string, _chatMessageID: string): Promise<void> {
  // Implementation pending
}

export async function cancelChatMessage(chatMessageId: string): Promise<ChatMessage> {
  try {
    const chatMessage = await getChatMessage(chatMessageId);

    if (chatMessage.response !== null) {
      throw new Error("Chat message has already been applied");
    }

    const db = getDB(await getParam("DB_URI"));
    await db.query(`UPDATE workspace_chat SET is_canceled = true WHERE id = $1`, [chatMessageId]);

    return getChatMessage(chatMessageId);
  } catch (err) {
    logger.error("Failed to cancel chat message", { err });
    throw err;
  }
}

export async function listMessagesForWorkspace(workspaceID: string): Promise<ChatMessage[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const queryResult = await db.query(
      `
            SELECT
                workspace_chat.id,
                workspace_chat.created_at,
                workspace_chat.sent_by,
                workspace_chat.prompt,
                workspace_chat.response,
                workspace_chat.is_intent_complete,
                workspace_chat.is_canceled,
                workspace_chat.followup_actions,
                workspace_chat.response_render_id,
                workspace_chat.response_plan_id,
                workspace_chat.response_conversion_id,
                workspace_chat.response_rollback_to_revision_number,
                workspace_chat.revision_number,
                workspace_chat.message_from_persona
            FROM
                workspace_chat
            WHERE
                workspace_chat.workspace_id = $1
            ORDER BY
                workspace_chat.created_at ASC
        `,
      [workspaceID],
    );

    if (!queryResult || queryResult.rows.length === 0) {
      return [];
    }

    // each chat is a user message, and if there is a response that is the assistant message
    const messages: ChatMessage[] = [];

    for (let i = 0; i < queryResult.rows.length; i++) {
      const row = queryResult.rows[i];

      const message: ChatMessage = {
        id: row.id,
        prompt: row.prompt,
        response: row.response,
        createdAt: row.created_at,
        isCanceled: row.is_canceled,
        isIntentComplete: row.is_intent_complete,
        followupActions: row.followup_actions,
        responseRenderId: row.response_render_id,
        responsePlanId: row.response_plan_id,
        responseConversionId: row.response_conversion_id,
        responseRollbackToRevisionNumber: row.response_rollback_to_revision_number,
        revisionNumber: row.revision_number,
        isComplete: true,
        messageFromPersona: row.message_from_persona,
      };

      messages.push(message);
    }

    return messages;
  } catch (err) {
    logger.error("Failed to list messages for workspace", { err });
    throw err;
  }
}

