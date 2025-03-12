"use client"

import { Session } from "@/lib/types/session";
import { WorkspaceContainerClient } from "@/components/WorkspaceContainerClient";

interface WorkspaceContainerProps {
  session: Session;
  editorContent: string;
  onCommandK?: () => void;
}

export function WorkspaceContainer(props: WorkspaceContainerProps) {
  return <WorkspaceContainerClient {...props} />;
}
