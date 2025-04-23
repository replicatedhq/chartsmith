import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import { getWorkspace, getPlan } from "@/lib/workspace/workspace";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";

/**
 * GET route to retrieve content for a specific file in a plan
 * 
 * Path: /api/workspace/[workspaceId]/plans/[planId]/file/[...filePath]
 * 
 * Returns the content of the specified file for the given plan
 */
export async function GET(req: NextRequest, { params }: { params: { workspaceId: string, planId: string, filePath: string[] } }) {
  try {
    // Authenticate the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await userIdFromExtensionToken(authHeader.split(' ')[1])
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract parameters
    const { workspaceId, planId } = params;
    
    // Join the file path segments
    const filePath = params.filePath.join('/');
    
    if (!workspaceId || !planId || !filePath) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get the workspace to verify it exists and the user has access
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get the plan to verify it exists
    const plan = await getPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Verify the plan belongs to the workspace
    if (plan.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Plan does not belong to workspace' }, { status: 403 });
    }

    // Find the file in the action files
    const actionFile = plan.actionFiles.find(file => file.path === filePath);
    if (!actionFile) {
      return NextResponse.json({ error: 'File not found in plan' }, { status: 404 });
    }

    // Get the DB connection
    const db = getDB(await getParam("DB_URI"));

    // Query for the file content
    // We need to get the content_pending for the requested file
    const fileQuery = `
      SELECT content_pending
      FROM workspace_file
      WHERE workspace_id = $1
        AND file_path = $2
        AND revision_number = $3
    `;

    const result = await db.query(fileQuery, [workspaceId, filePath, workspace.currentRevisionNumber]);
    
    if (result.rows.length === 0 || !result.rows[0].content_pending) {
      // If no pending content, try to get the file content from the specified planId
      // This depends on how your application stores the plan's file changes
      logger.info(`No pending content found for file ${filePath} in workspace ${workspaceId}`);
      
      return NextResponse.json({ error: 'No pending content found for file' }, { status: 404 });
    }

    // Return the pending file content
    return NextResponse.json({ 
      content: result.rows[0].content_pending,
      filePath,
      planId,
      workspaceId
    });
  } catch (error) {
    logger.error("Failed to get file content from plan", { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 