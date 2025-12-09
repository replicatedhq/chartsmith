import { Plan, Workspace, WorkspaceFile, RenderedFile, Conversion, ConversionFile } from "@/lib/types/workspace";
import type { UIMessage } from "ai";

// ============================================================================
// DISCRIMINATED UNIONS FOR MESSAGE STATES
// TypeScript enforces valid states - no tests needed for invalid combinations
// ============================================================================

/**
 * Message streaming status - discriminated union ensures only valid states exist.
 * No need to test "what if streaming AND canceled" - that state can't be constructed.
 */
export type MessageStatus =
  | { status: "streaming" }
  | { status: "complete"; response: string }
  | { status: "canceled" }
  | { status: "error"; error: string };

/**
 * Get status text - exhaustive switch ensures all cases handled.
 * TypeScript errors if a case is missing - no tests needed.
 */
export function getStatusText(messageStatus: MessageStatus): string {
  switch (messageStatus.status) {
    case "streaming":
      return "thinking...";
    case "complete":
      return messageStatus.response;
    case "canceled":
      return "canceled";
    case "error":
      return messageStatus.error;
  }
  // TypeScript ensures exhaustiveness - this line is unreachable
}

/**
 * Derive message status from UIMessage - single source of truth
 */
export function deriveMessageStatus(message: UIMessage, isStreaming: boolean): MessageStatus {
  const metadata = message.metadata as ChartsmithMessageMetadata | undefined;

  if (metadata?.isCanceled) {
    return { status: "canceled" };
  }

  const hasStreamingPart = message.parts.some(
    (part) => part.type === "text" && (part as { state?: string }).state === "streaming"
  );

  if (isStreaming && hasStreamingPart) {
    return { status: "streaming" };
  }

  const text = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");

  return { status: "complete", response: text || "Chart files created." };
}

// ============================================================================
// CHARTSMITH MESSAGE TYPES
// ============================================================================

export interface FollowupAction {
  action: string;
  label: string;
}

/**
 * Chartsmith-specific metadata for UIMessage.
 * Used with UIMessage's metadata field for AI SDK integration.
 */
export interface ChartsmithMessageMetadata {
  responseRenderId?: string;
  responsePlanId?: string;
  responseConversionId?: string;
  responseRollbackToRevisionNumber?: number;
  planId?: string;
  revisionNumber?: number;
  followupActions?: FollowupAction[];
  isCanceled?: boolean;
  workspaceId?: string;
  userId?: string;
  createdAt?: Date;
}

/**
 * Chartsmith chat message - UIMessage with Chartsmith metadata.
 */
export type ChatMessage = UIMessage<ChartsmithMessageMetadata>;

/**
 * User message - narrowed type for user role messages
 */
export type UserChatMessage = ChatMessage & { role: "user" };

/**
 * Assistant message - narrowed type for assistant role messages
 */
export type AssistantChatMessage = ChatMessage & { role: "assistant" };

// ============================================================================
// TYPE GUARDS - Let TypeScript narrow types, no runtime tests needed
// ============================================================================

export function isUserMessage(message: ChatMessage): message is UserChatMessage {
  return message.role === "user";
}

export function isAssistantMessage(message: ChatMessage): message is AssistantChatMessage {
  return message.role === "assistant";
}

/**
 * Exhaustive message handler - TypeScript ensures all roles are handled
 */
export function handleMessageByRole<T>(
  message: ChatMessage,
  handlers: {
    user: (msg: UserChatMessage) => T;
    assistant: (msg: AssistantChatMessage) => T;
    system: (msg: ChatMessage) => T;
  }
): T {
  switch (message.role) {
    case "user":
      return handlers.user(message as UserChatMessage);
    case "assistant":
      return handlers.assistant(message as AssistantChatMessage);
    case "system":
      return handlers.system(message);
  }
  // Exhaustiveness check - TypeScript errors if a role is unhandled
  const _exhaustive: never = message.role;
  return _exhaustive;
}

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
