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

export interface Prompt {
  message: Message;
  filesSent: string[];
}

export interface Message {
  id: string;
  prompt: string;
  response?: string;
  isComplete: boolean;
  planId?: string;
}

// Interface for raw message from server before normalization
export interface RawMessage {
  id: string;
  prompt: string;
  response?: string;
}

// Interface for Centrifugo message data

// Raw workspace data from server before normalization
export interface RawFile {
  id?: string;
  filePath: string;  // Changed from path to filePath to match actual data
  content: string;
}

export interface RawWorkspace {
  id: string;
  created_at: string;
  last_updated_at: string;
  name: string;
  files: RawFile[];
  charts: {
    id: string;
    name: string;
    files: RawFile[];
  }[];
  current_revision: number;
  incomplete_revision_number?: number;
}

export interface CentrifugoMessageData {
  workspace?: RawWorkspace;
  message?: RawMessage;
  is_complete?: boolean;
  workspace_id: string;
  is_applied?: boolean;
  is_applying?: boolean;
  is_ignored?: boolean;
}

// Interface for raw message from server before normalization
export interface RawMessage {
  id: string;
  prompt: string;
  response?: string;
  is_applied?: boolean;
  is_applying?: boolean;
  is_ignored?: boolean;
}

export interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
}
