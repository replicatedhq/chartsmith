"use server";

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
    console.error("Google auth error:", error);
    throw error;
  }
}
