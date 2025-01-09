"use server"

import { Session } from "@/lib/types/session";
import { setMessageIgnored } from "../chat";

export async function ignorePlanAction(session: Session, workspaceId: string, chatMessageId: string): Promise<void> {
  await setMessageIgnored(workspaceId, chatMessageId);
}
