"use server";

import { Session } from "@/lib/types/session";
import { setUserReplicatedToken } from "../token";
import { logger } from "@/lib/utils/logger";

export async function exchangeReplicatedAuth(session: Session, nonce: string, exchange: string): Promise<boolean> {
  // make the api request to echange with the nonce
  const response = await fetch(`${exchange}?nonce=${nonce}`);
  if (!response.ok) {
    logger.error("Failed to exchange Replicated nonce", { response });
    return false;
  }

  // check the response for success
  const json = await response.json();
  if (!json.token) {
    logger.error("Failed to exchange Replicated nonce: missing token", { json });
    return false;
  }

  await setUserReplicatedToken(session.user.id, json.token);

  return true;
}
