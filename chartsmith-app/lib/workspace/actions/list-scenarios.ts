"use server"

import { listScenarios } from "@/lib/workspace/scenario";
import { Session } from "@/lib/types/session";
import { Scenario } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

export async function listScenariosAction(session: Session, workspaceId: string, chartId: string): Promise<Scenario[]> {
  logger.info("Listing scenarios", { workspaceId });
  try {
    const scenarios = await listScenarios(workspaceId, chartId);
    return scenarios;
  } catch (err) {
    logger.error("Failed to list scenarios", { err, workspaceId });
    throw err;
  }
}
