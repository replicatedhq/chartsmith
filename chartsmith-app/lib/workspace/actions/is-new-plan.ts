"use server"

import { Session } from "@/lib/types/session";

// isNewPlanAction returns true if the message should result in a plan, false if it's conversational or otherwise
export async function isNewPlanAction(session: Session, workspaceId: string, message: string) {
  return true;
}
