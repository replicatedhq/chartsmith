"use server";

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";

export interface PublishStatus {
  status: string;
  chartName: string;
  chartVersion: string;
  error?: string;
  createdAt: string;
  processingStartedAt?: string;
  completedAt?: string;
}

export async function getPublishStatusAction(
  session: Session,
  workspaceId: string
): Promise<PublishStatus | null> {
  try {
    if (!session || !session.user) {
      throw new Error("Unauthorized");
    }

    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(`
      SELECT
        status,
        chart_name,
        chart_version,
        error_message,
        created_at,
        processing_started_at,
        completed_at
      FROM workspace_publish
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [workspaceId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      status: row.status,
      chartName: row.chart_name || "chart",
      chartVersion: row.chart_version || "0.1.0",
      error: row.error_message,
      createdAt: row.created_at.toISOString(),
      processingStartedAt: row.processing_started_at ? row.processing_started_at.toISOString() : undefined,
      completedAt: row.completed_at ? row.completed_at.toISOString() : undefined
    };
  } catch (error) {
    logger.error("Failed to get publish status", { error, workspaceId });
    throw error;
  }
}