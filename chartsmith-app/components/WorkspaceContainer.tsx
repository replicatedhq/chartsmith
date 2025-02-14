"use client"

import { Session } from "@/lib/types/session";
import { WorkspaceContainerClient } from "@/components/WorkspaceContainerClient";

interface WorkspaceContainerProps {
  session: Session;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  onCommandK?: () => void;
}

export function WorkspaceContainer(props: WorkspaceContainerProps) {
  return <WorkspaceContainerClient {...props} />;
}
