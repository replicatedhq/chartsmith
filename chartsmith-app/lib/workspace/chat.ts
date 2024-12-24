import { Message } from "@/components/editor/types";
import { getDB } from "../data/db";
import { getParam } from "../data/param";


export async function listMessagesForWorkspace(workspaceID: string): Promise<Message[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
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
      [workspaceID]
    );

    if (result.rows.length === 0) {
      return [];
    }

    // each chat is a user message, and if there is a response that is the assistant message
    const messages: Message[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];

      const userMessage: Message = {
        role: "user",
        content: row.prompt,
        changes: undefined,
        fileChanges: undefined
      };
      messages.push(userMessage);

      if (row.response) {
        messages.push({
          role: "assistant",
          content: row.response,
          changes: undefined,
          fileChanges: undefined
        });
      }
    }

    return messages;
  } catch (err) {
    console.error(err);
    throw err;
  }
}
