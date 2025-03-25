import * as srs from "secure-random-string";
import { User, UserSetting } from "../types/user";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { logger } from "../utils/logger";

const defaultUserSettings: UserSetting = {
  automaticallyAcceptPatches: false,
  evalBeforeAccept: false,
};

export async function upsertUser(email: string, name: string, imageUrl: string): Promise<User> {
  const user = await findUser(email);
  if (user) {
    return user;
  }

  try {
    const acceptingNewUsers = false;
    if (!acceptingNewUsers) {
      return upsertWaitlistUser(email, name, imageUrl);
    } else {
      return upsertRealUser(email, name, imageUrl);
    }
  } catch (err) {
    logger.error("Failed to upsert user", { err });
    throw err;
  }
}

async function upsertWaitlistUser(email: string, name: string, imageUrl: string): Promise<User> {
  const id = srs.default({ length: 12, alphanumeric: true });

  try {
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `INSERT INTO waitlist (id, email, name, image_url, created_at, last_login_at, last_active_at)
      VALUES ($1, $2, $3, $4, now(), now(), now())
      ON CONFLICT (email) DO NOTHING
      `,
      [id, email, name, imageUrl],
    );
  } catch (dbErr) {
    logger.error("Error inserting waitlist into database", {
      error: dbErr,
      errorMessage: dbErr instanceof Error ? dbErr.message : String(dbErr),
      userId: id,
      email
    });
    throw dbErr;
  }

  const userSettings = await getUserSettings(id);

  return {
    id: id,
    email: email,
    name: name,
    imageUrl: imageUrl,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    lastActiveAt: new Date(),
    isWaitlisted: true,
    settings: userSettings,
    isAdmin: false,
  };
}

async function upsertRealUser(email: string, name: string, imageUrl: string): Promise<User> {
  const id = srs.default({ length: 12, alphanumeric: true });

  try {
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `INSERT INTO chartsmith_user (id, email, name, image_url, created_at, last_login_at, last_active_at)
      VALUES ($1, $2, $3, $4, now(), now(), now())
      ON CONFLICT (email) DO NOTHING
      `,
      [id, email, name, imageUrl],
    );
  } catch (dbErr) {
    logger.error("Error inserting user into database", {
      error: dbErr,
      errorMessage: dbErr instanceof Error ? dbErr.message : String(dbErr),
      userId: id,
      email
    });
    throw dbErr;
  }

  const userSettings = await getUserSettings(id);

  return {
    id: id,
    email: email,
    name: name,
    imageUrl: imageUrl,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    lastActiveAt: new Date(),
    isWaitlisted: false,
    settings: userSettings,
    isAdmin: false,
  };
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
                chartsmith_user.last_active_at,
                chartsmith_user.is_admin
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

    // Check if this user is on the waitlist
    const waitlistResult = await db.query(
      `SELECT email FROM waitlist WHERE email = $1`,
      [email]
    );
    const isWaitlisted = waitlistResult.rows.length > 0;

    const user: User = {
      id: row.id,
      email: row.email,
      name: row.name,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      lastActiveAt: row.last_active_at,
      isWaitlisted: isWaitlisted,
      settings: await getUserSettings(row.id),
      isAdmin: row.is_admin,
    };

    return user;
  } catch (err) {
    logger.error("Failed to find user", { err });
    throw err;
  }
}

export async function updateUserSetting(id: string, key: string, value: string): Promise<UserSetting> {
  try {
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `
            INSERT INTO chartsmith_user_setting (user_id, key, value)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, key) DO UPDATE SET value = $3
        `,
      [id, key, value],
    );

    return await getUserSettings(id);
  } catch (err) {
    logger.error("Failed to update user setting", { err });
    throw err;
  }
}

async function getUserSettings(id: string): Promise<UserSetting> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                chartsmith_user_setting.key,
                chartsmith_user_setting.value
            FROM
                chartsmith_user_setting
            WHERE
                chartsmith_user_setting.user_id = $1
        `,
      [id],
    );

    const userSettings: UserSetting = { ...defaultUserSettings };

    for (const row of result.rows) {
      switch (row.key) {
        case "automatically_accept_patches":
          userSettings.automaticallyAcceptPatches = row.value === "true";
          break;
        case "eval_before_accept":
          userSettings.evalBeforeAccept = row.value === "true";
      }
    }

    return userSettings;
  } catch (err) {
    logger.error("Failed to get user settings", { err });
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
                chartsmith_user.last_active_at,
                chartsmith_user.is_admin
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

    // Check if this user is on the waitlist
    const waitlistResult = await db.query(
      `SELECT email FROM waitlist WHERE email = $1`,
      [row.email]
    );
    const isWaitlisted = waitlistResult.rows.length > 0;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      lastActiveAt: row.last_active_at,
      isWaitlisted: isWaitlisted,
      settings: await getUserSettings(row.id),
      isAdmin: row.is_admin,
    };
  } catch (err) {
    logger.error("Failed to get user", { err });
    throw err;
  }
}

export async function listUsers(): Promise<User[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `SELECT id, email, name, image_url, created_at, last_login_at, last_active_at, is_admin FROM chartsmith_user ORDER BY created_at ASC`
    );
    const users: User[] = [];
    for (const row of result.rows) {
      users.push({
        id: row.id,
        email: row.email,
        name: row.name,
        imageUrl: row.image_url,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        lastActiveAt: row.last_active_at,
        isWaitlisted: false,
        settings: {
          automaticallyAcceptPatches: false,
          evalBeforeAccept: false,
        },
        isAdmin: row.is_admin,
      });
    }

    return users;
  } catch (err) {
    logger.error("Failed to list users", { err });
    throw err;
  }
}

export async function listWaitlistUsers(): Promise<User[]> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `SELECT id, email, name, image_url, created_at, last_login_at, last_active_at FROM waitlist ORDER BY created_at ASC`
    );

    const users: User[] = [];
    for (const row of result.rows) {
      users.push({
        id: row.id,
        email: row.email,
        name: row.name,
        imageUrl: row.image_url,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        lastActiveAt: row.last_active_at,
        isWaitlisted: true,
        settings: {
          automaticallyAcceptPatches: false,
          evalBeforeAccept: false,
        },
        isAdmin: false,
      });
    }

    return users;
  } catch (err) {
    logger.error("Failed to list waitlist users", { err });
    throw err;
  }
}

export async function approveWaitlistUser(userId: string): Promise<void> {
  const db = getDB(await getParam("DB_URI"));

  try {
    await db.query('BEGIN');
    const result = await db.query(
      `SELECT id, email, name, image_url, created_at, last_login_at, last_active_at FROM waitlist WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    const row = result.rows[0];

    await db.query(
      `INSERT INTO chartsmith_user (id, email, name, image_url, created_at, last_login_at, last_active_at)
      VALUES ($1, $2, $3, $4, now(), now(), now())
      ON CONFLICT (email) DO NOTHING
      `,
      [row.id, row.email, row.name, row.image_url]
    );

    await db.query(
      `DELETE FROM waitlist WHERE id = $1`,
      [userId]
    );

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    logger.error("Failed to approve waitlist user", { err });
    throw err;
  }
}
