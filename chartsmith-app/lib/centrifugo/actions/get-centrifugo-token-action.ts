"use server"

import { Session } from "@/lib/types/session";
import { getCentrifugoToken } from "./centrifugo";

export async function getCentrifugoTokenAction(session: Session, workspaceID: string): Promise<string> {
  return getCentrifugoToken(workspaceID);
}
