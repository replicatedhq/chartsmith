import * as srs from "secure-random-string";
import { User } from "../types/user";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { logger } from "../utils/logger";

export async function upsertUser(email: string, name: string, imageUrl: string): Promise<User> {
  const user = await findUser(email);
  if (user) {
    return user;
  }

  try {
    const db = getDB(await getParam("DB_URI"));
    const id = srs.default({ length: 12, alphanumeric: true });

    await db.query(
      `INSERT INTO chartsmith_user (id, email, name, image_url, created_at, last_login_at, last_active_at)
      VALUES ($1, $2, $3, $4, now(), now(), now())
        `,
      [id, email, name, imageUrl],
    );

    return {
      id: id,
      email: email,
      name: name,
      imageUrl: imageUrl,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
    };
  } catch (err) {
    logger.error("Failed to upsert user", { err });
    throw err;
  }
}

export async function findUser(email: string): Promise<User | undefined> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                chartsmith_user.id,
                chartsmith_user.email,
                chartsmith_user.name,
                chartsmith_user.image_url,
                chartsmith_user.created_at,
                chartsmith_user.last_login_at,
                chartsmith_user.last_active_at
            FROM
                chartsmith_user
            WHERE
                chartsmith_user.email = $1
        `,
      [email],
    );

    if (result.rows.length === 0) {
      return;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      lastActiveAt: row.last_active_at,
    };
  } catch (err) {
    logger.error("Failed to find user", { err });
    throw err;
  }
}

export async function getUser(id: string): Promise<User | undefined> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                chartsmith_user.id,
                chartsmith_user.email,
                chartsmith_user.name,
                chartsmith_user.image_url,
                chartsmith_user.created_at,
                chartsmith_user.last_login_at,
                chartsmith_user.last_active_at
            FROM
                chartsmith_user
            WHERE
                chartsmith_user.id = $1
        `,
      [id],
    );

    if (result.rows.length === 0) {
      return;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      lastActiveAt: row.last_active_at,
    };
  } catch (err) {
    logger.error("Failed to get user", { err });
    throw err;
  }
}

