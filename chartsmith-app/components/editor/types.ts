export interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  path?: string;
  hasError?: boolean;
  errorCount?: number;
  errorLine?: number;
  scenarioId?: string;
}

export interface Message {
  id: string;
  prompt: string;
  response?: string;
  fileChanges?: {
    path: string;
    content: string;
  }[];
  isComplete: boolean;
}

// Interface for raw message from server before normalization
export interface RawMessage {
  id: string;
  prompt: string;
  response?: string;
  fileChanges?: {
    path: string;
    content: string;
  }[];
}

// Interface for Centrifugo message data
import { Workspace } from "@/lib/types/workspace";

export interface CentrifugoMessageData {
  workspace?: Workspace;
  message?: RawMessage;
  is_complete?: boolean;
  workspace_id: string;
}

export interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
}
