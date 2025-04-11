"use server"

import { Session } from "@/lib/types/session";
import { Workspace } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { ChatMessageFromPersona, ChatMessageIntent, CreateChatMessageParams, createWorkspace } from "../workspace";
import { getChartFromBytes, getFilesFromBytes } from "../archive";

export async function createWorkspaceFromArchiveAction(userId: string, formData: FormData, archiveType: 'helm' | 'k8s'): Promise<Workspace> {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No file provided');
  }

  logger.info("Creating workspace from archive", { fileName: file.name, archiveType });

  const bytes = await file.arrayBuffer();

  if (archiveType === 'helm') {
    const baseChart = await getChartFromBytes(bytes, file.name);

    const createChartMessageParams: CreateChatMessageParams = {
      prompt: `Import the Helm chart from the uploaded file named ${file.name}`,
      response: `Got it. I found a ${baseChart.name} chart in the ${file.name} file. What's next?`,
      knownIntent: ChatMessageIntent.NON_PLAN,
      responseRollbackToRevisionNumber: 1,
      messageFromPersona: ChatMessageFromPersona.AUTO,
    }
    const w: Workspace = await createWorkspace("archive", userId, createChartMessageParams, baseChart);

    return w;
  } else if (archiveType === 'k8s') {
    const looseFiles = await getFilesFromBytes(bytes, file.name);

    const createChartMessageParams: CreateChatMessageParams = {
      prompt: `Create a Helm chart from the Kubernetes manifests in the uploaded file named ${file.name}`,
      response: `I'll create a Helm chart from the Kubernetes manifests in the uploaded file named ${file.name}`,
      knownIntent: ChatMessageIntent.CONVERT_K8S_TO_HELM,
      additionalFiles: looseFiles,
      responseRollbackToRevisionNumber: 1,
      messageFromPersona: ChatMessageFromPersona.AUTO,
    }
    const w: Workspace = await createWorkspace("archive", userId, createChartMessageParams);

    return w;
  }

  throw new Error('Invalid archive type');
}
