"use server";

import { updateUserAdminStatus } from "../user";
import { Session } from "../../types/session";
import { logger } from "../../utils/logger";

export async function updateUserAdminStatusAction(session: Session, userId: string, isAdmin: boolean): Promise<boolean> {
  try {
    if (!session.user.isAdmin) {
      logger.warn("Non-admin user attempted to update admin status", {
        requestingUserId: session.user.id,
        targetUserId: userId,
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
