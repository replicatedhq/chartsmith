import { Message } from "@/components/editor/types";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import * as srs from "secure-random-string";

export async function setMessageIgnored(workspaceID: string, chatMessageID: string): Promise<void> {
  try {
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `
        UPDATE workspace_chat
        SET is_ignored = true
        WHERE workspace_id = $1 AND id = $2
      `,
      [workspaceID, chatMessageID],
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
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
                workspace_chat.response,
                workspace_chat.is_complete,
                workspace_chat.is_applied,
                workspace_chat.is_applying,
                workspace_chat.is_ignored
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

      console.log("Processing message row:", row);

      const message: Message = {
        id: row.id,
        prompt: row.prompt,
        response: row.response,
        isComplete: row.is_complete,
        isApplied: row.is_applied,
        isApplying: row.is_applying,
        isIgnored: row.is_ignored,
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
          INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response, is_complete, is_initial_message, is_applied, is_applying, is_ignored)
          VALUES ($1, $2, now(), $3, $4, null, false, true, false, false, false)
        `,
      [chatID, workspaceID, userID, message],
    );

    await db.query(`SELECT pg_notify('new_chat', $1)`, [chatID]);

    return {
      id: chatID,
      prompt: message,
      response: undefined,
      isComplete: false,
      isApplied: false,
      isApplying: false,
      isIgnored: false,
    };
  } catch (err) {
    console.error(err);
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
          workspace_chat.response,
          workspace_chat.is_complete,
          workspace_chat.is_applied,
          workspace_chat.is_applying,
          workspace_chat.is_ignored
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
      isComplete: row.is_complete,
      isApplied: row.is_applied,
      isApplying: row.is_applying,
      isIgnored: row.is_ignored,
    };

    return message;
  } catch (err) {
    console.error(err);
    throw err;
  }
}
