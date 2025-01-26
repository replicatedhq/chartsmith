import { logger } from "../utils/logger";
import { Scenario } from "./workspace";

export async function createScenario(workspaceId: string, name: string, values: string): Promise<Scenario> {
  logger.debug(`Creating scenario for workspace ${workspaceId} with name ${name} and values ${values}`);
  try {
    throw new Error("Not implemented");
  } catch (error) {
    logger.error(`Error creating scenario for workspace ${workspaceId} with name ${name} and values ${values}`, error);
    throw error;
  }
}

export async function listScenarios(workspaceId: string): Promise<Scenario[]> {
  logger.debug(`Listing scenarios for workspace ${workspaceId}`);
  try {
    throw new Error("Not implemented");
  } catch (error) {
    logger.error(`Error listing scenarios for workspace ${workspaceId}`, error);
    throw error;
  }
}
