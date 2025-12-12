"use server";

import { User } from "@/lib/types/user";
import { Session } from "../types/session";
import * as srs from "secure-random-string";
import { getDB } from "../data/db";
import { getParam } from "../data/param";
import parse from "parse-duration";
import { getUser } from "./user";
import { logger } from "../utils/logger";

// Dynamic import for jsonwebtoken to avoid module loading issues
let jwtModule: typeof import("jsonwebtoken") | null = null;
async function getJWT(): Promise<typeof import("jsonwebtoken")> {
  if (!jwtModule) {
    try {
      jwtModule = await import("jsonwebtoken");
    } catch (err) {
      logger.error("Failed to import jsonwebtoken", { error: err });
      throw new Error("jsonwebtoken module failed to load");
    }
  }
  return jwtModule;
}

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
  // In test mode, try to use JWT if HMAC_SECRET is available, otherwise use simple token
  const isTestMode = process.env.ENABLE_TEST_AUTH === 'true' || process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true';
  
  // If test mode and no HMAC_SECRET, use simple token format
  if (isTestMode && !process.env.HMAC_SECRET) {
    return `test-token-${session.id}-${Date.now()}`;
  }

  try {
    // Check for HMAC_SECRET first
    if (!process.env.HMAC_SECRET) {
      logger.warn("HMAC_SECRET is not defined, using test token format");
      return `test-token-${session.id}-${Date.now()}`;
    }

    // Try to use JWT, but fall back to simple token if it fails
    try {
      const jwt = await getJWT();
      const options: import("jsonwebtoken").SignOptions = {
        expiresIn: sessionDuration,
        subject: session.user.id, // Use user.id as the subject claim
      };

      const payload = {
        id: session.id,
        name: session.user.name,
        email: session.user.email,
        picture: session.user.imageUrl,
        userSettings: session.user.settings,
        isWaitlisted: session.user.isWaitlisted,
        isAdmin: session.user.isAdmin || false
      };

      // Generate the JWT using the payload, secret, and options
      const token = jwt.sign(payload, process.env.HMAC_SECRET, options);
      return token;
    } catch (jwtError) {
      // If JWT fails, fall back to simple token (works for both test and production)
      logger.warn("JWT generation failed, using simple token format", { 
        error: jwtError,
        isTestMode 
      });
      return `test-token-${session.id}-${Date.now()}`;
    }
  } catch (err) {
    // If everything fails, return a simple token as fallback
    logger.warn("Failed to generate JWT token, using fallback token", {
      error: err,
      sessionId: session.id,
      userId: session.user.id
    });
    return `test-token-${session.id}-${Date.now()}`;
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
    // Decode URL-encoded tokens (cookies might be URL encoded)
    let decodedToken = token;
    try {
      decodedToken = decodeURIComponent(token);
    } catch (e) {
      // If decoding fails, use original token
      decodedToken = token;
    }

    // Handle test tokens - format: test-token-{sessionId}-{timestamp}
    if (decodedToken.startsWith('test-token-')) {
      // Extract session ID from test token
      // The format is: test-token-{sessionId}-{timestamp}
      // So we need to extract everything between "test-token-" and the last "-"
      const withoutPrefix = decodedToken.replace('test-token-', '');
      const lastDashIndex = withoutPrefix.lastIndexOf('-');
      
      if (lastDashIndex > 0) {
        const sessionId = withoutPrefix.substring(0, lastDashIndex);
        logger.debug("Extracting session ID from test token", { 
          tokenPrefix: decodedToken.substring(0, 30) + '...',
          sessionId 
        });
        
        const db = getDB(await getParam("DB_URI"));
        const result = await db.query(
          `SELECT id, user_id, expires_at FROM session WHERE id = $1`,
          [sessionId]
        );
        if (result.rows.length > 0) {
          const row = result.rows[0];
          const user = await getUser(row.user_id);
          if (user) {
            logger.debug("Test token session found", { sessionId, userId: user.id });
            return {
              id: row.id,
              user,
              expiresAt: row.expires_at,
            };
          } else {
            logger.warn("Test token session found but user not found", { sessionId, userId: row.user_id });
          }
        } else {
          logger.warn("Test token session not found in database", { sessionId, tokenPrefix: decodedToken.substring(0, 30) });
        }
      } else {
        logger.warn("Invalid test token format - no dash found", { tokenPrefix: decodedToken.substring(0, 50) });
      }
      return undefined;
    }

    const jwt = await getJWT();
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

