"use server";

import { logger } from "@/lib/utils/logger";
import { sessionToken, updateUserWaitlistStatus } from "../session";
import { Session } from "@/lib/types/session";
import { checkWaitlistStatus } from "../user";

// return a new JWT
export async function checkWaitlistStatusAction(sess: Session): Promise<string> {
  try {
    logger.info("Checking waitlist status action", { email: sess.user.email });

    const result = await checkWaitlistStatus(sess.user.email);
    console.log(result);
    if (result.isWaitlisted === sess.user.isWaitlisted) {
      // return the same jwt
      return await sessionToken(sess);
    }

    const updatedSession = await updateUserWaitlistStatus(sess, result.isWaitlisted);

    return await sessionToken(updatedSession);

  } catch (error) {
    console.log(error);
    logger.error("Failed to execute check waitlist status action", { error });
    const jwt = await sessionToken(sess);
    return jwt;
  }
}