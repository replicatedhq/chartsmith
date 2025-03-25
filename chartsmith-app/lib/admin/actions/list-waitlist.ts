"use server"

import { listWaitlistUsers } from "@/lib/auth/user";
import { Session } from "@/lib/types/session";
import { User } from "@/lib/types/user";
import { logger } from "@/lib/utils/logger";

export async function listWaitlistUsersAction(sess: Session): Promise<User[]> {
  if (!sess.user.isAdmin) {
    throw new Error("Unauthorized");
  }

  logger.info("Listing waitlist users");

  const waitlistUsers = await listWaitlistUsers();
  return waitlistUsers;
}
