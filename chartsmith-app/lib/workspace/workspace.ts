import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { Workspace } from "../types/workspace";
import * as srs from "secure-random-string";

export async function createWorkspace(name: string, createdType: string, prompt: string | undefined, userId: string): Promise<Workspace> {
  try {
    const id = srs.default({ length: 12, alphanumeric: true });
    const db = getDB(await getParam("DB_URI"));

    const result = await db.query(
      `INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, prompt)
      VALUES ($1, now(), now(), $2, $3, $4, $5)
        `,
      [id, name, userId, createdType, prompt]
    );

    return {
      id: id,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      name: name
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
