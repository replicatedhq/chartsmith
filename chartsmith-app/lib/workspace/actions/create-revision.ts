"use server"

import { Session } from "@/lib/types/session";
import { createRevision, getPlan, getWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";


export async function createRevisionAction(session: Session, planId: string): Promise<Workspace | undefined> {
  console.log("createRevisionAction called", { planId, userId: session?.user?.id });
  try {
    console.log("createRevisionAction: fetching plan");
    const plan = await getPlan(planId);
    console.log("createRevisionAction: plan fetched", { planId: plan?.id });

    console.log("createRevisionAction: calling createRevision");
    await createRevision(plan, session.user.id);
    console.log("createRevisionAction: createRevision completed");

    console.log("createRevisionAction: fetching workspace");
    const workspace = await getWorkspace(plan.workspaceId);
    console.log("createRevisionAction: workspace fetched", { workspaceId: workspace?.id });

    return workspace;
  } catch (err) {
    console.error("createRevisionAction failed", { err });
    throw err;
  }
}
