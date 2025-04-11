import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import * as srs from "secure-random-string";


export async function createExtensionToken(userId: string): Promise<string> {
  try {
    const db = getDB(await getParam("DB_URI"))

    const id = srs.default({ length: 12, alphanumeric: true });
    const token = srs.default({ length: 32, alphanumeric: true });

    const query = `INSERT INTO extension_token (id, token, user_id, created_at) VALUES ($1, $2, $3, $4)`
    await db.query(query, [id, token, userId, new Date()])

    return token;
  } catch (err) {
    console.error(err)
    throw new Error("Failed to create extension token")
  }
}

export async function userIdFromExtensionToken(token: string): Promise<string | null> {
  try {
    const db = getDB(await getParam("DB_URI"))

    const query = `SELECT user_id FROM extension_token WHERE token = $1`
    const result = await db.query(query, [token])

    return result.rows[0].user_id
  } catch (err) {
    console.error(err)
    return null
  }
}
