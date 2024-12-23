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
                workspace_chat.content,
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

    const messages: Message[] = result.rows.map((row: any) => {
      return {
        role: row.sent_by === "user" ? "user" : "assistant",
        content: row.content,
        changes: null,
        fileChanges: null,
        timestamp: row.created_at
      };
    });

    return messages;
  } catch (err) {
    console.error(err);
    throw err;
  }
}
