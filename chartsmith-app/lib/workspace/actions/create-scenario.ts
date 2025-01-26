"use server"

"use server"

import { createScenario } from "@/lib/types/scenario";
import { Session } from "@/lib/types/session";
import { Scenario } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

export async function createScenarioAction(session: Session, workspaceId: string, name: string, values: string): Promise<Scenario> {
  logger.info("Creating new scenario", { workspaceId, name });
  try {
    const scenario = await createScenario(workspaceId, name, values);
    return scenario;
  } catch (err) {
    logger.error("Failed to create scenario", { err, workspaceId, name });
    throw err;
  }
}
