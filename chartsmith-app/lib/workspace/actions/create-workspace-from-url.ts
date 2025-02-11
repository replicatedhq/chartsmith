"use server"

import { FollowupAction, Workspace } from "@/lib/types/workspace";
import {ChatMessageIntent, createChatMessage, createWorkspace } from "../workspace";
import { Session } from "@/lib/types/session";
import { logger } from "@/lib/utils/logger";
import { getArchiveFromUrl } from "../archive";

export async function createWorkspaceFromUrlAction(session: Session, url: string): Promise<Workspace> {
  logger.info("Creating workspace from url", { url, userId: session.user.id });

  const baseChart = await getArchiveFromUrl(url);
  const w: Workspace = await createWorkspace("chart", session.user.id, baseChart);

  const followupActions: FollowupAction[] = [
    {
      action: "render",
      label: "Render the chart",
    },
  ];

  await createChatMessage(session.user.id, w.id, {
    prompt: `Import the Helm chart from Artifact Hub: ${url}`,
    response: `Got it. I found a ${baseChart.name} chart in the ${url} repository and finished importing it. What's next?`,
    knownIntent: ChatMessageIntent.NON_PLAN,
    followupActions: followupActions,
  });

  return w;
}
