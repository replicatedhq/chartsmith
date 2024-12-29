import { Message } from "@/components/editor/types";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import * as srs from "secure-random-string";

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
                workspace_chat.response,
                workspace_chat.is_complete
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
        fileChanges: undefined,
        isComplete: row.is_complete,
      };
      messages.push(message);
    }

    return messages;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function addChatMessage(workspaceID: string, userID: string, message: string): Promise<Message> {
  try {
    const chatID: string = srs.default({ length: 12, alphanumeric: true });

    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `
          INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response, is_complete, is_initial_message)
          VALUES ($1, $2, now(), $3, $4, null, false, true)
        `,
      [chatID, workspaceID, userID, message],
    );

    await db.query(`SELECT pg_notify('new_chat', $1)`, [chatID]);

    return {
      id: chatID,
      prompt: message,
      response: undefined,
      fileChanges: undefined,
      isComplete: false,
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
