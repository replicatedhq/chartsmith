"use server";

import { User } from "@/lib/types/user";
import { Session } from "../types/session";
import * as srs from "secure-random-string";
import jwt from "jsonwebtoken";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import parse from "parse-duration";
import { getUser } from "./user";

const sessionDuration = "72h";

export async function createSession(user: User): Promise<Session> {
  try {
    const id = srs.default({ length: 12, alphanumeric: true });
    const db = getDB(await getParam("DB_URI"));

    await db.query(
      `
            INSERT INTO session (id, user_id, expires_at)
            VALUES ($1, $2, now() + interval '24 hours')
        `,
      [id, user.id],
    );

    return {
      id,
      user,
      expiresAt: new Date(Date.now() + parse(sessionDuration, "ms")!),
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function sessionToken(session: Session): Promise<string> {
  const options: jwt.SignOptions = {
    expiresIn: sessionDuration,
    subject: session.user.id, // Use user.id as the subject claim
  };

  // Generate the JWT using the payload, secret, and options
  const token = jwt.sign(
    {
      id: session.id,
      name: session.user.name,
      email: session.user.email,
      picture: session.user.imageUrl,
    },
    process.env.HMAC_SECRET!,
    options,
  );
  return token;
}

export async function findSession(token: string): Promise<Session | undefined> {
  try {
    const decoded = jwt.verify(token, process.env.HMAC_SECRET!) as { id: string };
    const id = decoded.id;

    console.log("finding session", id);

    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                session.id,
                session.user_id,
                session.expires_at,
                chartsmith_user.image_url
            FROM
                session
                JOIN chartsmith_user ON chartsmith_user.id = session.user_id
            WHERE
                session.id = $1
        `,
      [id],
    );

    if (result.rows.length === 0) {
      return;
    }

    const row = result.rows[0];
    const user = await getUser(row.user_id);
    if (!user) {
      return;
    }

    return {
      id: row.id,
      user,
      expiresAt: row.expires_at,
    };
  } catch (err: unknown) {
    // if the error contains "jwt expired" just return undefined
    if (err instanceof Error && err.message.includes("jwt expired")) {
      return;
    }

    console.error(err);
    throw err;
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `
            DELETE FROM session
            WHERE
                session.id = $1
        `,
      [id],
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}
