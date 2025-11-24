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

// Tool invocation type for AI SDK compatibility
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'partial-call' | 'call' | 'result';
  result?: unknown;
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
  // AI SDK compatibility fields
  role?: 'user' | 'assistant' | 'system' | 'tool';
  content?: string; // Alternative to response for AI SDK format
  toolInvocations?: ToolInvocation[];
  // Streaming state
  isStreaming?: boolean;
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
  id: string;
  filePath: string;
  chart_id?: string;
  content: string;
  content_pending?: string;
  revision_number: number;
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
  file?: RawFile;
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
  completedAt?: string;
  isAutorender?: boolean;
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
  contentPending?: string;
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
