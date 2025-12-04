/**
 * Message Builder
 *
 * Transform chat context into AI SDK message format.
 * Pure function - no I/O operations.
 */

import type { CoreMessage } from "ai";
import type { WorkspaceContext } from "./providers/types";
import { CHAT_SYSTEM_PROMPT, CHAT_INSTRUCTIONS } from "./prompts/system";

/**
 * Options for building messages
 */
export interface BuildMessagesOptions {
  /** Include system prompt as first message */
  includeSystemPrompt?: boolean;
  /** Custom system prompt override */
  customSystemPrompt?: string;
  /** The current user message */
  userMessage: string;
}

/**
 * Build AI SDK messages from workspace context
 *
 * This matches the message structure used in the Go implementation
 * (pkg/llm/conversational.go) but in AI SDK format.
 *
 * @param context - Workspace context with files, plan, and history
 * @param options - Message building options
 * @returns Array of CoreMessage for AI SDK
 */
export function buildMessages(
  context: WorkspaceContext,
  options: BuildMessagesOptions
): CoreMessage[] {
  const messages: CoreMessage[] = [];

  // Add context messages (as assistant messages, matching Go implementation)
  messages.push({
    role: "assistant",
    content: CHAT_INSTRUCTIONS,
  });

  // Add chart structure context
  if (context.chartStructure) {
    messages.push({
      role: "assistant",
      content: `I am working on a Helm chart that has the following structure: ${context.chartStructure}`,
    });
  }

  // Add relevant file contents
  for (const file of context.relevantFiles) {
    messages.push({
      role: "assistant",
      content: `File: ${file.filePath}, Content: ${file.content}`,
    });
  }

  // Add recent plan description if available
  if (context.recentPlan) {
    messages.push({
      role: "assistant",
      content: context.recentPlan.description,
    });
  }

  // Add previous conversation messages
  for (const msg of context.previousMessages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({
    role: "user",
    content: options.userMessage,
  });

  return messages;
}

/**
 * Get the system prompt for chat
 *
 * @param customPrompt - Optional custom system prompt
 * @returns System prompt string
 */
export function getSystemPrompt(customPrompt?: string): string {
  return customPrompt ?? CHAT_SYSTEM_PROMPT;
}

/**
 * Build messages for intent classification
 *
 * @param userMessage - The user's message to classify
 * @returns Messages for intent classification
 */
export function buildIntentClassificationMessages(
  userMessage: string
): CoreMessage[] {
  return [
    {
      role: "user",
      content: userMessage,
    },
  ];
}

/**
 * Format tool call results as a message
 *
 * @param toolName - Name of the tool that was called
 * @param result - Result from the tool execution
 * @returns Formatted message content
 */
export function formatToolResult(toolName: string, result: unknown): string {
  const resultStr =
    typeof result === "string" ? result : JSON.stringify(result);
  return `Tool ${toolName} returned: ${resultStr}`;
}
