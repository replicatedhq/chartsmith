"use server";

import { logger } from "@/lib/utils/logger";
import { sessionToken } from "../session";
import { Session } from "@/lib/types/session";

// return a new JWT
export async function checkWaitlistStatusAction(sess: Session): Promise<string> {
  console.log(sess);
  try {
    // logger.info("Checking waitlist status action", { email: sess.user.email });

    // const result = await checkWaitlistStatus(sess.user.email);

    // return await sessionToken(sess);

  } catch (error) {
    console.log(error);
    logger.error("Failed to execute check waitlist status action", { error });
    const jwt = await sessionToken(sess);
    return jwt;
  }
}