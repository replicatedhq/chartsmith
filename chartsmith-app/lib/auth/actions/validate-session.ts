"use server";

import { Session } from "@/lib/types/session";
import { extendSession, findSession } from "../session";
import { logger } from "@/lib/utils/logger";

export async function validateSession(token: string): Promise<Session | undefined> {
  try {
    logger.debug("Validating session", { tokenPrefix: token.substring(0, 30) + '...' });
    const session = await findSession(token);
    if (!session) {
      logger.warn("findSession returned undefined", { tokenPrefix: token.substring(0, 30) + '...' });
      return;
    }

    if (session.expiresAt < new Date()) {
      logger.warn("Session expired", { 
        sessionId: session.id, 
        expiresAt: session.expiresAt,
        now: new Date()
      });
      return;
    }

    logger.debug("Session validated successfully", { 
      sessionId: session.id, 
      userId: session.user.id,
      email: session.user.email,
      isWaitlisted: session.user.isWaitlisted
    });
    return session;
  } catch (err) {
    logger.error("Failed to validate session", { error: err, tokenPrefix: token.substring(0, 30) + '...' });
    throw err;
  }
}

export async function extendSessionAction(token: string): Promise<Session | undefined> {
  try {
    const session = await findSession(token);
    if (!session) {
      return;
    }

    const extendedSession = await extendSession(session);
    return extendedSession;
  } catch (err) {
    logger.error("Failed to extend session", err);
    throw err;
  }
}
