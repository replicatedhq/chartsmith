"use server"

import { Session } from "@/lib/types/session";
import { Archive } from "@/lib/types/archive";
import { Workspace } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { ChatMessageIntent, createChatMessage, createWorkspace } from "../workspace";
import { getArchiveFromBytes } from "../archive";

export async function createWorkspaceFromArchiveAction(session: Session, formData: FormData): Promise<Workspace> {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No file provided');
  }

  logger.info("Creating workspace from archive", { fileName: file.name });

  const bytes = await file.arrayBuffer();
  const baseChart = await getArchiveFromBytes(bytes, file.name);

  const w: Workspace = await createWorkspace("archive", session.user.id, baseChart);

  await createChatMessage(session.user.id, w.id, {
    prompt: `Import the Helm chart from the uploaded file named ${file.name}`,
    response: `Got it. I found a ${baseChart.name} chart in the ${file.name} file. What's next?`,
    knownIntent: ChatMessageIntent.NON_PLAN,
  });

  return w;
}
