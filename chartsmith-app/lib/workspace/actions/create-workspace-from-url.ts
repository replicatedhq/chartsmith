"use server"

import { Workspace } from "@/lib/types/workspace";
import { createNonPlanMessage, createWorkspace } from "../workspace";
import { Session } from "@/lib/types/session";
import { logger } from "@/lib/utils/logger";
import { getArchiveFromUrl } from "../archive";

export async function createWorkspaceFromUrlAction(session: Session, url: string): Promise<Workspace> {
  logger.info("Creating workspace from url", { url, userId: session.user.id });

  const baseChart = await getArchiveFromUrl(url);
  const w: Workspace = await createWorkspace("chart", session.user.id, baseChart);
  await createNonPlanMessage(session.user.id, `Importing chart from ${url}`, w.id, "", `Got it. I found a ${baseChart.name} chart in the ${url} repository and finished importing it. What's next?`);

  return w;
}
