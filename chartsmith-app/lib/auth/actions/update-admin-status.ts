"use server";

import { updateUserAdminStatus } from "../user";
import { Session } from "../../types/session";
import { logger } from "../../utils/logger";

export async function updateUserAdminStatusAction(session: Session, userId: string, isAdmin: boolean): Promise<boolean> {
  try {
    // Only admins can change admin status
    if (!session.user.isAdmin) {
      logger.warn("Non-admin user attempted to update admin status", {
        requestingUserId: session.user.id,
        targetUserId: userId,
      });
      return false;
    }
    
    // Prevent admins from removing their own admin status
    if (session.user.id === userId && !isAdmin) {
      logger.warn("Admin cannot remove their own admin status", {
        userId: session.user.id,
      });
      return false;
    }

    const success = await updateUserAdminStatus(userId, isAdmin);
    return success;
  } catch (error) {
    logger.error("Failed to update user admin status", { error, userId });
    return false;
  }
}
