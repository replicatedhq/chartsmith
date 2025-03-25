"use server";

import { listWaitlistUsers } from "@/lib/auth/user";
import { Session } from "@/lib/types/session";
import { User } from "@/lib/types/user";
import { logger } from "@/lib/utils/logger";

export async function listWaitlistUsersAction(session: Session): Promise<User[]> {
  try {
    // Validate that the user is an admin
    if (!session.user.isAdmin) {
      logger.warn("Non-admin user attempted to list waitlist users", { 
        userId: session.user.id,
        email: session.user.email 
      });
      return [];
    }

    const waitlistUsers = await listWaitlistUsers();
    return waitlistUsers;
  } catch (error) {
    logger.error("Failed to list waitlist users", { error });
    throw error;
  }
}