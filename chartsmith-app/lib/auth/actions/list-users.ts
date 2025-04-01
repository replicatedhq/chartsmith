"use server";

import { listUsersAdmin } from "@/lib/auth/user";
import { Session } from "@/lib/types/session";
import { UserAdmin } from "@/lib/types/user";
import { logger } from "@/lib/utils/logger";

export async function listUserAdminAction(session: Session): Promise<UserAdmin[]> {
  try {
    if (!session.user.isAdmin) {
      logger.warn("Non-admin user attempted to list users", {
        userId: session.user.id,
        email: session.user.email
      });
      return [];
    }

    const users = await listUsersAdmin();
    return users;
  } catch (error) {
    logger.error("Failed to list users", { error });
    throw error;
  }
}