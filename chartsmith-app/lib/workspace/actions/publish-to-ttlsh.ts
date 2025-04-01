"use server";

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";
import { enqueueWork } from "@/lib/utils/queue";

interface PublishResult {
  success: boolean;
  error?: string;
  repoUrl?: string;
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

    // Use a deterministic URL based on the workspace ID
    const repoUrl = `ttl.sh/chartsmith-${workspaceId}:latest`;

    // Enqueue the publish job
    await enqueueWork("publish_workspace", {
      workspaceId,
      userId: session.user.id,
      repoUrl,
      timestamp: new Date().toISOString()
    });

    // Store the publish event in the database for tracking
    const db = getDB(await getParam("DB_URI"));
    await db.query(`
      INSERT INTO workspace_publish (
        workspace_id, 
        user_id, 
        repository_url, 
        status, 
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [workspaceId, session.user.id, repoUrl, "pending"]);

    return {
      success: true,
      repoUrl
    };
  } catch (error) {
    logger.error("Failed to publish workspace to ttl.sh", { error, workspaceId });
    return {
      success: false,
      error: "Failed to publish workspace. Please try again later."
    };
  }
}