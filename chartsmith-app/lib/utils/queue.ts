import { getDB } from "../data/db";
import { getParam } from "../data/param";
import * as srs from "secure-random-string";

export async function enqueueWork(channel: string, payload: any): Promise<void> {
  const client = getDB(await getParam("DB_URI"));

  const id = srs.default({ length: 12, alphanumeric: true });
  await client.query(
    `INSERT INTO work_queue (id, channel, payload, created_at) ` +
    `VALUES ($1, $2, $3, NOW())`,
    [id, channel, payload]
  );

  await client.query(`SELECT pg_notify('${channel}', $1)`, [id]);
}
