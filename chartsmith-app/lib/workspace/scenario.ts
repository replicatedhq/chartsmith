import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { logger } from "../utils/logger";
import * as srs from "secure-random-string";
import { Scenario } from "../types/workspace";

export async function createScenario(workspaceId: string, chartId: string, name: string, description: string, values: string): Promise<Scenario> {
  logger.debug(`Creating scenario for workspace ${workspaceId} with name ${name} and values ${values}`);
  try {
    const db = getDB(await getParam("DB_URI"));
    const id = srs.default({ length: 12, alphanumeric: true });

    const result = await db.query(
      `INSERT INTO workspace_scenario (id, workspace_id, chart_id, name, description, values, is_read_only)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id, name, values`,
      [id, workspaceId, chartId, name, description, values]
    );

    const scenario: Scenario = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      values: result.rows[0].values
    };
    return scenario;
  } catch (error) {
    logger.error(`Error creating scenario for workspace ${workspaceId} with name ${name} and values ${values}`, error);
    throw error;
  }
}

export async function listScenarios(workspaceId: string, chartId: string): Promise<Scenario[]> {
  logger.debug(`Listing scenarios for workspace ${workspaceId}`);
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `SELECT id, name, description, values
       FROM workspace_scenario
       WHERE workspace_id = $1 AND chart_id = $2
       ORDER BY name`,
      [workspaceId, chartId]
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      values: row.values
    }));
  } catch (error) {
    logger.error(`Error listing scenarios for workspace ${workspaceId}`, error);
    throw error;
  }
}
