"use server";

import { Session } from "@/lib/types/session";
import { getCentrifugoToken } from "@/lib/centrifugo/centrifugo";
import { logger } from "@/lib/utils/logger";

export async function getCentrifugoTokenAction(session: Session): Promise<string> {
  logger.debug("getCentrifugoTokenAction", { session });
  return getCentrifugoToken(session.user.id);
}
