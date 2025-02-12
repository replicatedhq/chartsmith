"use server";

import { Session } from "@/lib/types/session";
import { RenderedWorkspace } from "@/lib/types/workspace";
import { getRenderedWorkspace } from "../rendered";

export async function getWorkspaceRenderAction(session: Session, renderId: string): Promise<RenderedWorkspace> {
  return getRenderedWorkspace(renderId);
}
