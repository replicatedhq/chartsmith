"use server";

import { Session } from "@/lib/types/session";
import { Workspace } from "@/lib/types/workspace";
import { listWorkspaces } from "../workspace";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";

interface WorkspaceListResult {
  workspaces: Workspace[];
  userName?: string;
  userEmail?: string;
}

export async function listWorkspacesAction(session: Session, userId?: string): Promise<WorkspaceListResult> {
  // Validate that the user is an admin if requesting other users' workspaces
  if (userId && userId !== session.user.id && !session.user.isAdmin) {
    logger.warn("Non-admin user attempted to view other user's workspaces", {
      requestingUserId: session.user.id,
      requestedUserId: userId,
    });
    return { workspaces: [] };
  }

  // If user is admin and requesting specific user's workspaces
  if (session.user.isAdmin && userId) {
    try {
      // First get the user info
      const db = getDB(await getParam("DB_URI"));
      const userResult = await db.query(
        `SELECT name, email FROM chartsmith_user WHERE id = $1`,
        [userId]
      );

      let userName = undefined;
      let userEmail = undefined;

      if (userResult.rows.length > 0) {
        userName = userResult.rows[0].name;
        userEmail = userResult.rows[0].email;
      }

      // Get the user's workspaces
      const workspaces = await listWorkspaces(userId);
      
      return {
        workspaces,
        userName,
        userEmail
      };
    } catch (error) {
      logger.error("Failed to list user workspaces", { error, userId });
      throw error;
    }
  }

  // Admin requested all workspaces
  if (session.user.isAdmin && !userId) {
    try {
      const db = getDB(await getParam("DB_URI"));
      const result = await db.query(`
        SELECT 
          w.id, 
          w.created_at, 
          w.last_updated_at, 
          w.name, 
          w.created_by_user_id, 
          w.created_type, 
          w.current_revision_number,
          cu.name as user_name,
          cu.email as user_email
        FROM workspace w
        LEFT JOIN chartsmith_user cu ON w.created_by_user_id = cu.id
        ORDER BY w.last_updated_at DESC
        LIMIT 100
      `);

      // Convert rows to Workspace objects
      const workspaces: Workspace[] = result.rows.map(row => ({
        id: row.id,
        createdAt: row.created_at,
        lastUpdatedAt: row.last_updated_at,
        name: row.name,
        currentRevisionNumber: row.current_revision_number,
        files: [],
        charts: [],
        createdByUserName: row.user_name,
        createdByUserEmail: row.user_email
      }));

      return { workspaces };
    } catch (error) {
      logger.error("Failed to list all workspaces", { error });
      throw error;
    }
  }

  // Regular user requesting their own workspaces
  const workspaces = await listWorkspaces(session.user.id);
  return { workspaces };
}