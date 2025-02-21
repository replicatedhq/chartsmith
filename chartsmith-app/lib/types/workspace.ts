import { Message } from "@/components/types";

export interface Workspace {
  id: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  name: string;
  charts: Chart[];
  files: WorkspaceFile[];
  currentRevisionNumber: number;
  incompleteRevisionNumber?: number;
}

export interface WorkspaceFile {
  id: string;
  filePath: string;  // Required - files without paths are filtered out
  content: string;   // Required but may be empty string
  pendingPatch?: string;
}

export interface Chart {
  id: string;
  name: string;
  files: WorkspaceFile[];
}

export interface RenderedWorkspace {
  id: string;
  workspaceId: string;
  revisionNumber: number;
  createdAt: Date;
  completedAt?: Date;
  charts: RenderedChart[];
}

export interface RenderedChart {
  id: string;
  chartId: string;
  chartName: string;
  isSuccess: boolean;
  depUpdateCommand?: string;
  depUpdateStdout?: string;
  depUpdateStderr?: string;
  helmTemplateCommand?: string;
  helmTemplateStdout?: string;
  helmTemplateStderr?: string;
  createdAt: Date;
  completedAt?: Date;
  renderedFiles: RenderedFile[];
}

export interface RenderedFile {
  id: string;
  filePath: string;
  renderedContent: string;
}

export enum ConversionStatus {
  Pending = 'pending',
  Analyzing = 'analyzing',
  Sorting = 'sorting',
  Templating = 'templating',
  Normalizing = 'normalizing',
  Simplifying = 'simplifying',
  Finalizing = 'finalizing',
  Complete = 'complete',
}

export interface Conversion {
  id: string;
  sourceType: string;
  status: ConversionStatus;
  workspaceId: string;
  chatMessageIds: string[];
  createdAt: Date;
  sourceFiles: ConversionFile[];
}

export enum ConversionFileStatus {
  Pending = 'pending',
  Processing = 'converting',
  Converted = 'converted',
  Simplifying = 'simplifying',
  Completed = 'completed',
}

export interface ConversionFile {
  id: string;
  filePath: string;
  content: string;
  status: ConversionFileStatus;
}

export interface Plan {
  id: string;
  description: string;
  status: string;
  workspaceId: string;
  chatMessageIds: string[];
  createdAt: Date;
  isComplete: boolean;
  proceedAt?: Date;
  actionFiles: ActionFile[];
}

export interface ActionFile {
  action: string;
  path: string;
  status: string;
}

export interface ChatMessage {
  id: string;
  prompt: string;
  response: string;
  createdAt: Date;
  isIntentComplete: boolean;
  isCanceled: boolean;
  followupActions?: FollowupAction[];
  responseRenderId?: string;
  responsePlanId?: string;
  responseConversionId?: string;
  isComplete: boolean;  // Add required Message properties
  workspaceId?: string;
  userId?: string;
  isApplied?: boolean;
  isApplying?: boolean;
  isIgnored?: boolean;
  planId?: string;
}

export interface FollowupAction {
  action: string;
  label: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
  chartId?: string;
  workspaceId?: string;
}

export interface RenderUpdate {
  workspaceId: string;
  revisionNumber: number;
  valuesContent: string;
  valuesHash: string;
  chartName: string;
  stdout: string;
  stderr: string;
  result: string;
}
