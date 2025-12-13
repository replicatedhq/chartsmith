import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { logger } from "../utils/logger";

/**
 * Appends a chunk of text to a chat message's response
 *
 * Uses a row-level lock (FOR UPDATE) to prevent concurrent chunk appends from
 * overwriting each other. This ensures chunks are appended in order even when
 * multiple onChunk callbacks run concurrently.
 */
export async function appendChatMessageResponse(chatMessageId: string, chunk: string): Promise<void> {
  try {
    const db = getDB(await getParam("DB_URI"));

    // Use a transaction with row-level locking to prevent concurrent updates
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the row to prevent concurrent updates
      const lockQuery = `SELECT response FROM workspace_chat WHERE id = $1 FOR UPDATE`;
      const result = await client.query(lockQuery, [chatMessageId]);

      if (result.rows.length === 0) {
        throw new Error(`Chat message not found: ${chatMessageId}`);
      }

      // Append the chunk
      const updateQuery = `UPDATE workspace_chat SET response = COALESCE(response, '') || $1 WHERE id = $2`;
      await client.query(updateQuery, [chunk, chatMessageId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error("Failed to append chat message response", { err, chatMessageId });
    throw err;
  }
}

/**
 * Marks a chat message as complete
 */
export async function markChatMessageComplete(chatMessageId: string): Promise<void> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const query = `UPDATE workspace_chat SET is_intent_complete = true WHERE id = $1`;
    await db.query(query, [chatMessageId]);
  } catch (err) {
    logger.error("Failed to mark chat message complete", { err, chatMessageId });
    throw err;
  }
}

/**
 * Gets the workspace ID for a chat message
 */
export async function getWorkspaceIdForChatMessage(chatMessageId: string): Promise<string> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`SELECT workspace_id FROM workspace_chat WHERE id = $1`, [chatMessageId]);

    if (result.rows.length === 0) {
      throw new Error(`Chat message not found: ${chatMessageId}`);
    }

    return result.rows[0].workspace_id;
  } catch (err) {
    logger.error("Failed to get workspace ID for chat message", { err, chatMessageId });
    throw err;
  }
}
