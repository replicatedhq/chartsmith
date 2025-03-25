"use server";

import { User } from "@/lib/types/user";
import { Session } from "../types/session";
import * as srs from "secure-random-string";
import jwt from "jsonwebtoken";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import parse from "parse-duration";
import { getUser } from "./user";
import { logger } from "../utils/logger";

const sessionDuration = "72h";

export async function createSession(user: User): Promise<Session> {
  logger.debug("Starting createSession", { userId: user.id, email: user.email });
  try {
    const id = srs.default({ length: 12, alphanumeric: true });
    logger.debug("Generated session ID", { sessionId: id });

    const db = getDB(await getParam("DB_URI"));
    logger.debug("Got database connection");

    logger.debug("Inserting session into database", { sessionId: id, userId: user.id });
    try {
      await db.query(
        `
              INSERT INTO session (id, user_id, expires_at)
              VALUES ($1, $2, now() + interval '24 hours')
          `,
        [id, user.id],
      );
      logger.debug("Successfully inserted session into database", { sessionId: id, userId: user.id });
    } catch (dbErr) {
      logger.error("Error inserting session into database", {
        error: dbErr,
        errorMessage: dbErr instanceof Error ? dbErr.message : String(dbErr),
        sessionId: id,
        userId: user.id
      });
      throw dbErr;
    }

    const expiresAt = new Date(Date.now() + parse(sessionDuration, "ms")!);
    logger.info("Session created successfully", {
      sessionId: id,
      userId: user.id,
      email: user.email,
      expiresAt: expiresAt.toISOString(),
      isWaitlisted: user.isWaitlisted
    });

    return {
      id,
      user,
      expiresAt,
    };
  } catch (err) {
    logger.error("Failed to create session", {
      error: err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      userId: user.id,
      email: user.email,
      isWaitlisted: user.isWaitlisted
    });
    throw err;
  }
}

export async function sessionToken(session: Session): Promise<string> {

  try {
    const options: jwt.SignOptions = {
      expiresIn: sessionDuration,
      subject: session.user.id, // Use user.id as the subject claim
    };

    // Check for HMAC_SECRET
    if (!process.env.HMAC_SECRET) {
      logger.error("HMAC_SECRET is not defined in environment variables");
      throw new Error("HMAC_SECRET is not defined");
    }

    const payload = {
      id: session.id,
      name: session.user.name,
      email: session.user.email,
      picture: session.user.imageUrl,
      userSettings: session.user.settings,
      isWaitlisted: session.user.isWaitlisted
    };

    // Generate the JWT using the payload, secret, and options
    const token = jwt.sign(payload, process.env.HMAC_SECRET, options);

    return token;
  } catch (err) {
    logger.error("Failed to generate JWT token", {
      error: err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      sessionId: session.id,
      userId: session.user.id
    });
    throw err;
  }
}

export async function extendSession(session: Session): Promise<Session> {
  try {
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `UPDATE session SET expires_at = now() + interval '24 hours' WHERE id = $1`,
      [session.id],
    );

    return {
      ...session,
      expiresAt: new Date(Date.now() + parse(sessionDuration, "ms")!),
    };
  } catch (err) {
    logger.error("Failed to extend session", { err });
    throw err;
  }
}

export async function findSession(token: string): Promise<Session | undefined> {
  try {
    const decoded = jwt.verify(token, process.env.HMAC_SECRET!) as { id: string };
    const id = decoded.id;

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

    logger.error("Failed to find session", { err });
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
    logger.error("Failed to delete session", { err });
    throw err;
  }
}

