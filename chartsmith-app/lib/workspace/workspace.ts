import { getDB } from "../data/db";
import { getParam } from "../data/param";

import { File, Workspace } from "../types/workspace";
import * as srs from "secure-random-string";

export async function createWorkspace(name: string, createdType: string, prompt: string | undefined, userId: string): Promise<Workspace> {
  try {
    const id = srs.default({ length: 12, alphanumeric: true });
    const db = getDB(await getParam("DB_URI"));

    // Start transaction
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, prompt, current_revision_number)
        VALUES ($1, now(), now(), $2, $3, $4, $5, 0)`,
        [id, name, userId, createdType, prompt],
      );

      const chatId: string = srs.default({ length: 12, alphanumeric: true });
      if (createdType === "prompt") {
        await client.query(
          `INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response, is_complete, is_initial_message)
          VALUES ($1, $2, now(), $3, $4, null, false, true)`,
          [chatId, id, userId, prompt],
        );
      }

      await client.query("COMMIT");

      try {
        const notifyResult = await client.query(`SELECT pg_notify('new_workspace', $1)`, [id]);
        console.log('Notification sent:', {
          channel: 'new_workspace',
          payload: id,
          pgResult: notifyResult
        });
      } catch (err) {
        console.error('Failed to send notification:', err);
      }

      return {
        id: id,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        name: name,
        files: [],
      };
    } catch (err) {
      // Rollback transaction on error
      await client.query("ROLLBACK");
      throw err;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                workspace.id,
                workspace.created_at,
                workspace.last_updated_at,
                workspace.name,
                workspace.created_by_user_id,
                workspace.created_type,
                workspace.prompt,
                workspace.current_revision_number
            FROM
                workspace
            WHERE
                workspace.id = $1
        `,
      [id],
    );

    if (result.rows.length === 0) {
      return;
    }

    const row = result.rows[0];

    const w: Workspace = {
      id: row.id,
      createdAt: row.created_at,
      lastUpdatedAt: row.last_updated_at,
      name: row.name,
      files: [],
    };

    // get the files
    const files = await listFilesForWorkspace(id, result.rows[0].current_revision_number);
    w.files = files;

    return w;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function listFilesForWorkspace(workspaceID: string, revisionNumber: number): Promise<File[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                workspace_file.file_path,
                workspace_file.content,
                workspace_file.name
            FROM
                workspace_file
            WHERE
                workspace_file.workspace_id = $1 AND workspace_file.revision_number = $2
        `,
      [workspaceID, revisionNumber],
    );

    if (result.rows.length === 0) {
      return [];
    }

    const files: File[] = result.rows.map((row: { file_path: string; content: string; name: string }) => {
      return {
        path: row.file_path,
        content: row.content,
        name: row.name,
      };
    });

    return files;
  } catch (err) {
    console.error(err);
    throw err;
  }
}
