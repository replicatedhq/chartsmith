import { Message } from "@/components/editor/types";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import * as srs from "secure-random-string";
import { logger } from "../utils/logger";

export async function setMessageIgnored(_workspaceID: string, _chatMessageID: string): Promise<void> {
  // TODO
}

export async function listMessagesForWorkspace(workspaceID: string): Promise<Message[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const queryResult = await db.query(
      `
            SELECT
                workspace_chat.id,
                workspace_chat.created_at,
                workspace_chat.sent_by,
                workspace_chat.prompt,
                workspace_chat.response

            FROM
                workspace_chat
            WHERE
                workspace_chat.workspace_id = $1
        `,
      [workspaceID],
    );

    if (!queryResult || queryResult.rows.length === 0) {
      return [];
    }

    // each chat is a user message, and if there is a response that is the assistant message
    const messages: Message[] = [];

    for (let i = 0; i < queryResult.rows.length; i++) {
      const row = queryResult.rows[i];

      const message: Message = {
        id: row.id,
        prompt: row.prompt,
        response: row.response,
        createdAt: row.created_at,
      };
      messages.push(message);
    }

    return messages;
  } catch (err) {
    logger.error("Failed to list messages for workspace", { err });
    throw err;
  }
}

export async function addChatMessage(workspaceID: string, userID: string, message: string): Promise<Message> {
  try {
    const chatID: string = srs.default({ length: 12, alphanumeric: true });

    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `
          INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response)
          VALUES ($1, $2, now(), $3, $4)
        `,
      [chatID, workspaceID, userID, message],
    );

    await db.query(`SELECT pg_notify('new_chat', $1)`, [chatID]);

    return {
      id: chatID,
      prompt: message,
      response: undefined,
      isComplete: false,
    };
  } catch (err) {
    logger.error("Failed to add chat message", { err });
    throw err;
  }
}

export async function getChatMessage(workspaceID: string, chatID: string): Promise<Message> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
        SELECT
          workspace_chat.id,
          workspace_chat.workspace_id,
          workspace_chat.created_at,
          workspace_chat.sent_by,
          workspace_chat.prompt,
          workspace_chat.response
        FROM
          workspace_chat
        WHERE
          workspace_chat.id = $1
      `,
      [chatID],
    );

    if (result.rows.length === 0) {
      throw new Error("no chat message found");
    }

    const row = result.rows[0];
    const message: Message = {
      id: row.id,
      prompt: row.prompt,
      response: row.response,
    };

    return message;
  } catch (err) {
    logger.error("Failed to get chat message", { err });
    throw err;
  }
}
