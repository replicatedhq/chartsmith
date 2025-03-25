"use server";

import { logger } from "@/lib/utils/logger";
import { fetchGoogleProfile } from "../client";
import { createSession, sessionToken } from "../session";
import { upsertUser } from "../user";

export async function exchangeGoogleCodeForSession(code: string): Promise<string> {
  try {
    const profile = await fetchGoogleProfile(code);

    const user = await upsertUser(profile.email, profile.name, profile.picture);

    const sess = await createSession(user);
    const jwt = await sessionToken(sess);
    return jwt;
  } catch (error) {
    logger.error("Failed to exchange Google code for session", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}
