import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { logger } from "../utils/logger";
import * as srs from "secure-random-string";
import { Scenario } from "./workspace";

export async function createScenario(workspaceId: string, name: string, values: string): Promise<Scenario> {
  logger.debug(`Creating scenario for workspace ${workspaceId} with name ${name} and values ${values}`);
  try {
    const db = getDB(await getParam("DB_URI"));
    const id = srs.default({ length: 12, alphanumeric: true });

    const result = await db.query(
      `INSERT INTO workspace_scenario (id, workspace_id, name, values)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, values`,
      [id, workspaceId, name, values]
    );

    return {
      id: result.rows[0].id,
      name: result.rows[0].name,
      values: result.rows[0].values
    };
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
