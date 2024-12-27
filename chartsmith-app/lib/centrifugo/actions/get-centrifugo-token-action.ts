"use server"

import { Session } from "@/lib/types/session";
import { getCentrifugoToken } from "./centrifugo";

export async function getCentrifugoTokenAction(session: Session): Promise<string> {
  return getCentrifugoToken(session.user.id);
}
