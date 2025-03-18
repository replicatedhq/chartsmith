"use server";

import { Session } from "@/lib/types/session";
import { logger } from "@/lib/utils/logger";
import { listReplayableEvents } from "../centrifugo";

export async function replayEventsAction(session: Session): Promise<any[]> {
  logger.debug("replayEventsAction", { session });

  const replayableEvents = await listReplayableEvents(session.user.id);
  return replayableEvents;
}
