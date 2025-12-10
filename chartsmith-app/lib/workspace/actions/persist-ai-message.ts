"use server"

import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";

/**
 * Persist an AI response to the database.
 * Updates the chat message with the AI's response text and marks intent as complete.
 */
export async function persistAIResponseAction(
  chatMessageId: string,
  response: string
): Promise<void> {
  try {
    const dbUri = await getParam("DB_URI");
    const db = getDB(dbUri);

    await db.query(
      `UPDATE workspace_chat
       SET response = $1, is_intent_complete = true, is_intent_conversational = true
       WHERE id = $2`,
      [response, chatMessageId]
    );
  } catch (error) {
    logger.error("Failed to persist AI response", {
      chatMessageId,
      error,
    });
    throw error;
  }
}
