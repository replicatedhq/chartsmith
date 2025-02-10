"use server"

import { RenderedChart } from "../types/workspace";
import { listRenderedChartsForWorkspace } from "./rendered";

export async function getWorkspaceRenderedChartsAction(workspaceId: string, revisionNumber: number): Promise<RenderedChart[]> {
  const renderedCharts = await listRenderedChartsForWorkspace(workspaceId, revisionNumber);

  return renderedCharts;
}
