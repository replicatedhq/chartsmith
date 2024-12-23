"use server"

import { Session } from "@/lib/types/session";
import { findSession } from "../session";

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
    console.error(err);
    throw err;
  }
}

