"use server";

import { logger } from "@/lib/utils/logger";
import { Session } from "@/lib/types/session";
import { approveWaitlistUser } from "@/lib/auth/user";

export async function approveWaitlistUserAction(session: Session, waitlistId: string): Promise<boolean> {
  try {
    // Validate that the user is an admin
    if (!session.user.isAdmin) {
      return false;
    }

    await approveWaitlistUser(waitlistId);
    return true;
  } catch (err) {
    logger.error("Failed to approve waitlist user", { err });
    return false;
  }
}
