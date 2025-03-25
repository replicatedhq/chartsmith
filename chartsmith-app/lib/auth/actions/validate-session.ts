"use server";

import { Session } from "@/lib/types/session";
import { extendSession, findSession } from "../session";
import { logger } from "@/lib/utils/logger";

export async function validateSession(token: string, allowWaitlisted: boolean = true): Promise<Session | undefined> {
  try {
    const session = await findSession(token);
    if (!session) {
      return;
    }

    if (session.expiresAt < new Date()) {
      return;
    }

    // If waitlisted users aren't allowed and this user is waitlisted, return undefined
    if (!allowWaitlisted && session.user.isWaitlisted) {
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
