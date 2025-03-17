"use server";

import { Session } from "@/lib/types/session";
import { RenderedWorkspace } from "@/lib/types/workspace";
import { listWorkspaceRenders } from "../rendered";
import { logger } from "@/lib/utils/logger";
export async function listWorkspaceRendersAction(session: Session, workspaceId: string): Promise<RenderedWorkspace[]> {
  logger.info("listWorkspaceRendersAction", { session, workspaceId });
  const renders = await listWorkspaceRenders(session, workspaceId);
  return renders;
}
