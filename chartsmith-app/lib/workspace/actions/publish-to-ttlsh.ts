"use server";

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";
import { enqueueWork } from "@/lib/utils/queue";

interface PublishResult {
  success: boolean;
  error?: string;
}

export async function publishToTtlshAction(session: Session, workspaceId: string): Promise<PublishResult> {
  try {
    // Validate session and permissions
    if (!session || !session.user) {
      return { success: false, error: "Unauthorized" };
    }

    // Log the publish request
    logger.info("Publishing workspace to ttl.sh", {
      userId: session.user.id,
      workspaceId: workspaceId
    });

    // Get database connection
    const db = getDB(await getParam("DB_URI"));

    // Get the current workspace revision
    const workspaceResult = await db.query(`
      SELECT current_revision_number FROM workspace
      WHERE id = $1
    `, [workspaceId]);

    if (workspaceResult.rows.length === 0) {
      return { success: false, error: "Workspace not found" };
    }

    const revision = workspaceResult.rows[0].current_revision_number.toString();

    // Enqueue the publish job
    await enqueueWork("publish_workspace", {
      workspaceId,
      userId: session.user.id,
      revision
    });


    return {
      success: true
    };
  } catch (error) {
    logger.error("Failed to publish workspace to ttl.sh", { error, workspaceId });
    return {
      success: false,
      error: "Failed to publish workspace. Please try again later."
    };
  }
}