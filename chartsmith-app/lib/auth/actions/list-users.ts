"use server";

import { listUsers } from "@/lib/auth/user";
import { Session } from "@/lib/types/session";
import { User } from "@/lib/types/user";
import { logger } from "@/lib/utils/logger";

export async function listUsersAction(session: Session): Promise<User[]> {
  try {
    // Validate that the user is an admin
    if (!session.user.isAdmin) {
      logger.warn("Non-admin user attempted to list users", { 
        userId: session.user.id,
        email: session.user.email 
      });
      return [];
    }

    const users = await listUsers();
    return users;
  } catch (error) {
    logger.error("Failed to list users", { error });
    throw error;
  }
}