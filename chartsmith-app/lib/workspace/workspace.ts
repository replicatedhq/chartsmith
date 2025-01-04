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
        `INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, current_revision_number)
        VALUES ($1, now(), now(), $2, $3, $4, 0)`,
        [id, name, userId, createdType],
      );

      const bootsrapFiles = await client.query(`SELECT file_path, content, name FROM bootstrap_file`);
      for (const file of bootsrapFiles.rows) {
        await client.query(
          `INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name)
          VALUES ($1, $2, 0, now(), now(), $3, $4)`,
          [id, file.file_path, file.content, file.name],
        );
      }
      const bootsrapGVKs = await client.query(`SELECT gvk, file_path, content, summary, embeddings FROM bootstrap_gvk`);
      for (const gvk of bootsrapGVKs.rows) {
        const gvkId: string = srs.default({ length: 12, alphanumeric: true });
        await client.query(
          `INSERT INTO workspace_gvk (id, workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings)
          VALUES ($1, $2, $3, 0, $4, now(), $5, $6, $7)`,
          [gvkId, id, gvk.gvk, gvk.file_path, gvk.content, gvk.summary, gvk.embeddings],
        );
      }

      // commit before sending the notification
      await client.query("COMMIT");
    } catch (err) {
      // Rollback transaction on error
      await client.query("ROLLBACK");
      throw err;
    } finally {
      // Release the client back to the pool
      client.release();
    }

    const chatClient = await db.connect();
    const chatId: string = srs.default({ length: 12, alphanumeric: true });
    if (createdType === "prompt") {
      await chatClient.query(
        `INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response, is_complete, is_initial_message)
        VALUES ($1, $2, now(), $3, $4, null, false, true)`,
        [chatId, id, userId, prompt],
      );
    }

    await chatClient.query(`SELECT pg_notify('new_chat', $1)`, [chatId]);

    return {
      id: id,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      currentRevisionNumber: 0,
      name: name,
      files: [],
    };

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
      currentRevisionNumber: row.current_revision_number,
      files: [],
    };

    // get the files, only if revision number is > 0
    if (result.rows[0].current_revision_number > 0) {
      const files = await listFilesForWorkspace(id, result.rows[0].current_revision_number);
      w.files = files;
    }

    return w;
  } catch (err) {
    console.error(err);
    throw err;
  }
}


export async function createRevision(workspaceID: string, chatMessageID: string, userID: string): Promise<number> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
        WITH latest_revision AS (
          SELECT * FROM workspace_revision
          WHERE workspace_id = $1
          ORDER BY revision_number DESC
          LIMIT 1
        ),
        next_revision AS (
          SELECT COALESCE(MAX(revision_number), 0) + 1 as next_num
          FROM workspace_revision
          WHERE workspace_id = $1
        )
        INSERT INTO workspace_revision (
          workspace_id, revision_number, created_at, chat_message_id,
          created_by_user_id, created_type, is_complete
        )
        SELECT
          $1,
          next_num,
          NOW(),
          $2,
          $3,
          COALESCE(lr.created_type, 'manual'),
          false
        FROM next_revision
        LEFT JOIN latest_revision lr ON true
        RETURNING revision_number
      `,
      [workspaceID, chatMessageID, userID]
    );

    const newRevisionNumber = result.rows[0].revision_number;

    await db.query(`UPDATE workspace SET current_revision_number = $1 WHERE id = $2`, [newRevisionNumber, workspaceID]);

    await db.query(`SELECT pg_notify('new_revision', $1)`, [`${workspaceID}/${newRevisionNumber}`]);
    return newRevisionNumber;

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
