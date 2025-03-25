'use strict';

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

  const acceptingNewUsers = false;
  if (acceptingNewUsers) {
    return upsertNewUser(email, name, imageUrl);
  } else {
    return upsertWaitlistUser(email, name, imageUrl);
  }
}

async function upsertWaitlistUser(email: string, name: string, imageUrl: string): Promise<User> {
  try {
    const db = getDB(await getParam("DB_URI"));

    const id = srs.default({ length: 12, alphanumeric: true });

    await db.query(
      `INSERT INTO waitlist (id, email, name, image_url, created_at, last_login_at, last_active_at)
      VALUES ($1, $2, $3, $4, now(), now(), now()) ON CONFLICT (email) DO NOTHING`,
      [id, email, name, imageUrl],
    );

    return {
      id,
      email,
      name,
      imageUrl,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      isWaitlisted: true,
      settings: await getUserSettings(id),
    };
  } catch (err) {
    logger.error("Failed to upsert user", { err });
    throw err;
  }
}

async function upsertNewUser(email: string, name: string, imageUrl: string): Promise<User> {
  try {
    const db = getDB(await getParam("DB_URI"));

    const id = srs.default({ length: 12, alphanumeric: true });

    await db.query(
      `INSERT INTO chartsmith_user (id, email, name, image_url, created_at, last_login_at, last_active_at)
      VALUES ($1, $2, $3, $4, now(), now(), now()) ON CONFLICT (email) DO NOTHING`,
      [id, email, name, imageUrl],
    );

    return {
      id,
      email,
      name,
      imageUrl,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      isWaitlisted: false,
      settings: await getUserSettings(id),
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
      `SELECT id, email, name, image_url, created_at FROM waitlist ORDER BY created_at ASC`
    );

    const users: User[] = [];
    for (const row of result.rows) {
      users.push({
        id: row.id,
        email: row.email,
        name: row.name || "",
        imageUrl: row.image_url || "",
        createdAt: row.created_at,
        lastLoginAt: undefined,
        lastActiveAt: undefined,
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

export interface CheckWaitlistResult {
  isWaitlisted: boolean;
  userId?: string;
  email?: string;
}

export async function checkWaitlistStatus(email: string): Promise<CheckWaitlistResult> {
  try {
    logger.debug("Checking waitlist status for user", { email });

    const db = getDB(await getParam("DB_URI"));

    // First check if user exists in chartsmith_user table
    const userResult = await db.query(
      `SELECT id FROM chartsmith_user WHERE email = $1`,
      [email]
    );

    // If they exist in the user table, they are not waitlisted
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      logger.info("User exists in chartsmith_user table, not waitlisted", { email, userId });

      return {
        isWaitlisted: false,
        userId,
        email
      };
    }

    // Check if they exist in waitlist table
    const waitlistResult = await db.query(
      `SELECT id FROM waitlist WHERE email = $1`,
      [email]
    );

    // If they're in the waitlist table, they're waitlisted
    if (waitlistResult.rows.length > 0) {
      logger.info("User exists in waitlist table, still waitlisted", { email });
      return { isWaitlisted: true, email };
    }

    // If they're not in either table, something is wrong
    logger.warn("User not found in either users or waitlist tables", { email });
    return { isWaitlisted: true, email };

  } catch (error) {
    logger.error("Failed to check waitlist status", { error, email });
    return { isWaitlisted: true };
  }
}

export async function approveWaitlistUser(waitlistId: string): Promise<boolean> {
  try {
    logger.info("Approving waitlist user", { waitlistId });
    const db = getDB(await getParam("DB_URI"));

    // First, get the waitlist user details
    const waitlistResult = await db.query(
      `SELECT
        id,
        email,
        name,
        image_url,
        created_at
      FROM
        waitlist
      WHERE
        id = $1`,
      [waitlistId]
    );

    if (waitlistResult.rows.length === 0) {
      logger.warn("Attempted to approve non-existent waitlist user", { waitlistId });
      return false;
    }

    const waitlistUser = waitlistResult.rows[0];

    // Begin a transaction
    await db.query("BEGIN");

    try {
      // Insert user into chartsmith_user table
      await db.query(
        `INSERT INTO chartsmith_user (
          id,
          email,
          name,
          image_url,
          created_at,
          last_login_at,
          last_active_at
        ) VALUES (
          $1, $2, $3, $4, $5, now(), now()
        )`,
        [
          waitlistUser.id,
          waitlistUser.email,
          waitlistUser.name,
          waitlistUser.image_url,
          waitlistUser.created_at
        ]
      );

      // Delete from waitlist
      await db.query(
        `DELETE FROM waitlist WHERE id = $1`,
        [waitlistId]
      );

      // Commit the transaction
      await db.query("COMMIT");

      logger.info("Successfully approved waitlist user", {
        waitlistId,
        email: waitlistUser.email
      });

      return true;
    } catch (error) {
      // Rollback in case of error
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    logger.error("Failed to approve waitlist user", { waitlistId, error });
    return false;
  }
}