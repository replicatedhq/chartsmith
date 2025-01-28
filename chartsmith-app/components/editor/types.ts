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
  is_applied?: boolean;
  is_applying?: boolean;
  is_ignored?: boolean;
  isComplete?: boolean;
  isApplied?: boolean;
  isApplying?: boolean;
  isIgnored?: boolean;
  role?: string;
  createdAt?: Date;
  workspaceId?: string;
  planId?: string;
  userId?: string;
  isOptimistic?: boolean;
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
  chatMessage?: RawChatMessage;
  message?: RawMessage;
  plan?: RawPlan;
  artifact?: RawArtifact;
  workspaceId: string;
}

export interface RawChatMessage {
  id: string;
  prompt: string;
  response?: string;
  createdAt: string;  // ISO date string from server
}

export interface RawArtifact {
  revisionNumber: number;
  path: string;
  content: string;
}

// Interface for raw message from server before normalization
export interface RawMessage {
  id: string;
  prompt: string;
  response?: string;
}

import { Scenario } from '@/lib/types/workspace';

export interface RawPlan {
  id: string;
  description: string;
  status: string;
  workspaceId: string;
  chatMessageIds: string[];
  createdAt: string;
  isComplete?: boolean;
  actionFiles: {
    action: string;
    path: string;
    status: string;
  }[];
}
