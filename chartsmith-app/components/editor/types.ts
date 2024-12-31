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
  is_complete: boolean;
}

export interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
}
