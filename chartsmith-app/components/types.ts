import { Plan, Workspace, WorkspaceFile, RenderedFile, Conversion, ConversionFile } from "@/lib/types/workspace";

export interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content: string;
  filePath: string;
  id?: string;
  revisionNumber?: number;
  chartId?: string;
  workspaceId?: string;
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
  isApplied?: boolean;
  isApplying?: boolean;
  isIgnored?: boolean;
  isCanceled?: boolean;
  createdAt?: Date;
  workspaceId?: string;
  userId?: string;
  isIntentComplete?: boolean;
  followupActions?: any[];
  responseRenderId?: string;
  responsePlanId?: string;
  responseConversionId?: string;
  responseRollbackToRevisionNumber?: number;
  planId?: string;
  revisionNumber?: number;
}

// Interface for raw message from server before normalization
export interface RawMessage {
  id: string;
  prompt: string;
  response?: string;
  isIntentComplete: boolean;
  followupActions?: RawFollowupAction[];
}

export interface RawFollowupAction {
  action: string;
  label: string;
}

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
  revision?: RawRevision;
  artifact?: RawArtifact;
  workspaceId: string;
  eventType?: string;
  renderedFile?: RenderedFile;
  renderChartId?: string;
  renderId?: string;
  depUpdateCommand?: string;
  depUpdateStdout?: string;
  depUpdateStderr?: string;
  helmTemplateCommand?: string;
  helmTemplateStdout?: string;
  helmTemplateStderr?: string;
  conversion?: Conversion;
  conversionId?: string;
  conversionFile?: ConversionFile;
  filePath?: string;
  status?: string;
}

export interface RawRevision {
  workspaceId: string;
  workspace: RawWorkspace;
  revisionNumber: number;
  isComplete: boolean;
}

export interface RawChatMessage {
  id: string;
  prompt: string;
  response?: string;
  createdAt: string;  // ISO date string from server
  isCanceled: boolean;
  responseRenderId?: string;
  responsePlanId?: string;
  responseRollbackToRevisionNumber?: number;
  isComplete?: boolean;
  isApplied?: boolean;
  isApplying?: boolean;
  isIgnored?: boolean;
  isIntentComplete?: boolean;
  workspaceId: string;
  planId: string;
  userId: string;
  followupActions: RawFollowupAction[];
  revisionNumber?: number;
}

export interface RawArtifact {
  revisionNumber: number;
  path: string;
  content: string;
  pendingPatch?: string;
}

// Interface for raw message from server before normalization
export interface RawMessage {
  id: string;
  prompt: string;
  response?: string;
}

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

export interface RenderStreamEvent {
  workspaceId: string;
  renderChartId: string;
  depUpdateCommand?: string;
  depUpdateStdout?: string;
  depUpdateStderr?: string;
  helmTemplateCommand?: string;
  helmTemplateStdout?: string;
  helmTemplateStderr?: string;
}
