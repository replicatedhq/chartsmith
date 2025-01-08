"use server";

import { Session } from "@/lib/types/session";
import { setUserReplicatedToken } from "../token";

export async function exchangeReplicatedAuth(session: Session, nonce: string, exchange: string): Promise<boolean> {
  console.log("Exchanging Replicated nonce:", nonce);
  console.log("Exchanging Replicated exchange:", exchange);

  // make the api request to echange with the nonce
  const response = await fetch(`${exchange}?nonce=${nonce}`);
  if (!response.ok) {
    console.error("Failed to exchange Replicated nonce:", response);
    return false;
  }

  // check the response for success
  const json = await response.json();
  if (!json.token) {
    console.error("Failed to exchange Replicated nonce: missing token");
    return false;
  }

  await setUserReplicatedToken(session.user.id, json.token);

  return true;
}
