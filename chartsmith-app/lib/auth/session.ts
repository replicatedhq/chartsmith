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

export async function updateUserWaitlistStatus(session: Session, isWaitlisted: boolean): Promise<Session> {
  session.user.isWaitlisted = isWaitlisted;
  return session;
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
      isWaitlisted: session.user.isWaitlisted,
      isAdmin: session.user.isAdmin || false
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
    const decoded = jwt.verify(token, process.env.HMAC_SECRET!) as {
      id: string;
      email?: string;
      isWaitlisted?: boolean;
      exp: number;
    };
    const id = decoded.id;

    const db = getDB(await getParam("DB_URI"));

    // First try to get the session with a join to chartsmith_user
    const result = await db.query(
      `
            SELECT
                session.id,
                session.user_id,
                session.expires_at
            FROM
                session
            WHERE
                session.id = $1
        `,
      [id],
    );

    if (result.rows.length === 0) {
      // No session found in the database, but we have a valid JWT
      // This could happen if the session was deleted from the database
      // but the JWT is still valid. In this case, we can try to reconstruct
      // a session from the JWT payload if it contains the necessary information.
      if (decoded.email && decoded.isWaitlisted) {
        logger.info("Session not found in database, but JWT contains user information", {
          sessionId: id,
          email: decoded.email,
          isWaitlisted: decoded.isWaitlisted
        });

        // Try to find the user in waitlist or chartsmith_user tables
        try {
          // Check waitlist first if isWaitlisted is true
          if (decoded.isWaitlisted) {
            const waitlistResult = await db.query(
              `SELECT id, email, name, image_url, created_at FROM waitlist WHERE email = $1`,
              [decoded.email]
            );

            if (waitlistResult.rows.length > 0) {
              const waitlistedUser = waitlistResult.rows[0];
              return {
                id,
                user: {
                  id: waitlistedUser.id,
                  email: waitlistedUser.email,
                  name: waitlistedUser.name || "",
                  imageUrl: waitlistedUser.image_url || "",
                  createdAt: waitlistedUser.created_at,
                  isWaitlisted: true,
                  settings: {
                    automaticallyAcceptPatches: false,
                    evalBeforeAccept: false,
                    theme: 'auto',
                    tabSize: '2 spaces',
                    showMinimap: false,
                    useSecureBuildImages: false,
                  },
                  isAdmin: false
                },
                expiresAt: new Date(decoded.exp * 1000) // JWT expiry is in seconds
              };
            }
          }

          // If not found in waitlist or not waitlisted, we couldn't reconstruct the session
          return undefined;
        } catch (dbErr) {
          logger.error("Error querying waitlist/user tables", { error: dbErr });
          return undefined;
        }
      }

      return undefined;
    }

    const row = result.rows[0];

    // Try to get the user from chartsmith_user first
    let user = await getUser(row.user_id);

    // If user not found in chartsmith_user, check the waitlist
    if (!user && decoded.email) {
      try {
        const waitlistResult = await db.query(
          `SELECT id, email, name, image_url, created_at FROM waitlist WHERE email = $1`,
          [decoded.email]
        );

        if (waitlistResult.rows.length > 0) {
          const waitlistedUser = waitlistResult.rows[0];
          user = {
            id: waitlistedUser.id,
            email: waitlistedUser.email,
            name: waitlistedUser.name || "",
            imageUrl: waitlistedUser.image_url || "",
            createdAt: waitlistedUser.created_at,
            isWaitlisted: true,
            settings: {
              automaticallyAcceptPatches: false,
              evalBeforeAccept: false,
              theme: 'auto',
              tabSize: '2 spaces',
              showMinimap: false,
              useSecureBuildImages: false,
            },
            isAdmin: false
          };
        }
      } catch (dbErr) {
        logger.error("Error querying waitlist table", { error: dbErr });
      }
    }

    if (!user) {
      return undefined;
    }

    return {
      id: row.id,
      user,
      expiresAt: row.expires_at,
    };
  } catch (err: unknown) {
    // if the error contains "jwt expired" just return undefined
    if (err instanceof Error && err.message.includes("jwt expired")) {
      return undefined;
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

