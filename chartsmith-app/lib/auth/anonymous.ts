"use server";

import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { Session } from "@/lib/types/session";
import { findUser } from "@/lib/auth/user";

const anonymousEmail = "anonymous@chartsmith.local";

export async function getAnonymousSession(): Promise<Session> {
  const db = getDB(await getParam("DB_URI"));
  await db.query(
    `INSERT INTO chartsmith_user (
      id, email, name, image_url, created_at, last_login_at, last_active_at, is_admin
    ) VALUES (
      'anonymous', $1, 'ChartSmith User', '/logo.svg', now(), now(), now(), true
    ) ON CONFLICT (email) DO UPDATE SET last_active_at = now()`,
    [anonymousEmail],
  );

  const user = await findUser(anonymousEmail);
  if (!user) {
    throw new Error("Failed to create the anonymous ChartSmith user");
  }

  return {
    id: "anonymous",
    user,
    expiresAt: new Date("9999-12-31T23:59:59.999Z"),
  };
}
