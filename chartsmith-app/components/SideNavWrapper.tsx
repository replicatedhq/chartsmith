"use client";

import { useWorkspaceUI } from "@/contexts/WorkspaceUIContext";
import { SideNav } from "./SideNav";

interface SideNavWrapperProps {
  workspaceID: string;
}

export function SideNavWrapper({ workspaceID }: SideNavWrapperProps) {
  const { isFileTreeVisible } = useWorkspaceUI();

  if (!isFileTreeVisible) {
    return null;
  }

  return <SideNav workspaceID={workspaceID} />;
}
