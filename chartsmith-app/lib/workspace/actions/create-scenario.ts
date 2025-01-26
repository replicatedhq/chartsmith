"use server"

import { createScenario } from "@/lib/types/scenario";
import { Session } from "@/lib/types/session";
import { Scenario } from "@/lib/types/workspace";

export async function createScenarioAction(session: Session, workspaceId: string, name: string, values: string): Promise<Scenario> {
  const scenario = await createScenario(workspaceId, name, values);
  return scenario;
}
