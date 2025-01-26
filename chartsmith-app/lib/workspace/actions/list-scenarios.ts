"use server"

import { listScenarios } from "@/lib/types/scenario";
import { Session } from "@/lib/types/session";
import { Scenario } from "@/lib/types/workspace";

export async function listScenariosAction(session: Session, workspaceId: string): Promise<Scenario[]> {
  const scenarios = await listScenarios(workspaceId);
  return scenarios;
}
