/**
 * Context Builder
 *
 * Pure function to construct chat context from workspace data.
 * No I/O operations - all data is passed in as parameters.
 */

import type { WorkspaceContext } from "./providers/types";

/**
 * Maximum number of files to include in context
 */
const MAX_FILES = 10;

/**
 * Maximum content length per file (characters)
 */
const MAX_FILE_CONTENT_LENGTH = 10000;

/**
 * Raw workspace data from database
 */
export interface WorkspaceData {
  id: string;
  charts: Array<{
    id: string;
    files: Array<{
      filePath: string;
      content: string;
    }>;
  }>;
}

/**
 * Relevant file with score for ranking
 */
export interface RelevantFile {
  filePath: string;
  content: string;
  relevanceScore?: number;
}

/**
 * Plan data from database
 */
export interface PlanData {
  id: string;
  description: string;
}

/**
 * Chat message from database
 */
export interface ChatMessageData {
  id: string;
  prompt: string;
  response?: string;
  role?: "user" | "assistant";
}

/**
 * Input parameters for building chat context
 */
export interface BuildContextParams {
  workspace: WorkspaceData;
  relevantFiles: RelevantFile[];
  recentPlan?: PlanData;
  previousMessages: ChatMessageData[];
  currentMessageId?: string;
}

/**
 * Build chat context from workspace data
 *
 * This is a pure function - no side effects or I/O operations.
 *
 * @param params - Input data for building context
 * @returns Structured chat context
 */
export function buildChatContext(params: BuildContextParams): WorkspaceContext {
  const { workspace, relevantFiles, recentPlan, previousMessages, currentMessageId } = params;

  // Get chart structure
  const chartStructure = buildChartStructure(workspace);

  // Limit and truncate relevant files
  const limitedFiles = limitRelevantFiles(relevantFiles, MAX_FILES, MAX_FILE_CONTENT_LENGTH);

  // Filter previous messages (exclude current message)
  const filteredMessages = previousMessages
    .filter((msg) => msg.id !== currentMessageId)
    .map((msg) => ({
      role: (msg.response ? "assistant" : "user") as "user" | "assistant",
      content: msg.response ?? msg.prompt,
    }));

  return {
    workspaceId: workspace.id,
    chartStructure,
    relevantFiles: limitedFiles.map((file) => ({
      filePath: file.filePath,
      content: file.content,
    })),
    recentPlan: recentPlan
      ? {
          id: recentPlan.id,
          description: recentPlan.description,
        }
      : undefined,
    previousMessages: filteredMessages,
  };
}

/**
 * Build a string representation of the chart structure
 */
function buildChartStructure(workspace: WorkspaceData): string {
  if (!workspace.charts || workspace.charts.length === 0) {
    return "No charts in workspace";
  }

  const chart = workspace.charts[0];
  const structure = chart.files
    .map((file) => `File: ${file.filePath}`)
    .join("\n");

  return structure || "Empty chart";
}

/**
 * Limit relevant files by count and truncate content
 */
function limitRelevantFiles(
  files: RelevantFile[],
  maxFiles: number,
  maxContentLength: number
): RelevantFile[] {
  // Sort by relevance score if available
  const sorted = [...files].sort((a, b) => {
    const scoreA = a.relevanceScore ?? 0;
    const scoreB = b.relevanceScore ?? 0;
    return scoreB - scoreA;
  });

  // Limit count
  const limited = sorted.slice(0, maxFiles);

  // Truncate content
  return limited.map((file) => ({
    ...file,
    content:
      file.content.length > maxContentLength
        ? file.content.slice(0, maxContentLength) + "\n... [truncated]"
        : file.content,
  }));
}

/**
 * Calculate total token estimate for context
 * Rough estimate: 1 token ≈ 4 characters
 */
export function estimateContextTokens(context: WorkspaceContext): number {
  let totalChars = 0;

  totalChars += context.chartStructure.length;

  for (const file of context.relevantFiles) {
    totalChars += file.filePath.length + file.content.length;
  }

  if (context.recentPlan) {
    totalChars += context.recentPlan.description.length;
  }

  for (const msg of context.previousMessages) {
    totalChars += msg.content.length;
  }

  return Math.ceil(totalChars / 4);
}
