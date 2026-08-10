"use server";

import { Session } from "@/lib/types/session";
import { extendSession, findSession } from "../session";
import { logger } from "@/lib/utils/logger";
import { getAnonymousSession } from "../anonymous";

export async function getSessionAction(token?: string): Promise<Session | undefined> {
  const authRequired = process.env.AUTH_REQUIRED === "true" || (
    process.env.AUTH_REQUIRED === undefined &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
  );
  if (!authRequired) {
    return getAnonymousSession();
  }
  if (!token) {
    return;
  }
  return validateSession(token);
}

export async function validateSession(token: string): Promise<Session | undefined> {
  try {
    const session = await findSession(token);
    if (!session) {
      return;
    }

    if (session.expiresAt < new Date()) {
      return;
    }


    return session;
  } catch (err) {
    logger.error("Failed to validate session", err);
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
