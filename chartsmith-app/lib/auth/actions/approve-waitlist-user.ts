"use server";

import { approveWaitlistUser } from "../user";
import { Session } from "@/lib/types/session";
import { logger } from "@/lib/utils/logger";

export async function approveWaitlistUserAction(session: Session, waitlistId: string): Promise<boolean> {
  try {
    // Validate that the user is an admin
    if (!session.user.isAdmin) {
      logger.warn("Non-admin user attempted to approve waitlist user", { 
        userId: session.user.id,
        email: session.user.email 
      });
      return false;
    }

    // Call the library function to perform the database operations
    const success = await approveWaitlistUser(waitlistId);
    
    logger.info("Waitlist user approval status", {
      success,
      waitlistId,
      approvedBy: session.user.email
    });
    
    return success;
  } catch (error) {
    logger.error("Failed to approve waitlist user action", { error, waitlistId });
    return false;
  }
}