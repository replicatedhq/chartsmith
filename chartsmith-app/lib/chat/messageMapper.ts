/**
 * Message Mapper for AI SDK ↔ Existing Message Format Conversion
 *
 * This module provides utilities to convert between AI SDK's UIMessage format
 * and the existing Message format used throughout the Chartsmith application.
 *
 * Key Conversions:
 * - UIMessage.parts → Message.prompt / Message.response
 * - useChat status → isThinking / isStreaming / isIntentComplete flags
 * - Tool results → responsePlanId extraction
 */

import { type UIMessage } from "ai";
import { type Message } from "@/components/types";

/**
 * Extracts text content from UIMessage parts, filtering out tool invocations
 */
export function extractTextFromParts(parts: UIMessage["parts"]): string {
  if (!parts || parts.length === 0) return "";

  return parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text"
    )
    .map((part) => part.text)
    .join("\n");
}

/**
 * Extracts user prompt from a UIMessage
 */
export function extractPromptFromUIMessage(message: UIMessage): string {
  if (message.role !== "user") return "";
  return extractTextFromParts(message.parts);
}

/**
 * Extracts assistant response from a UIMessage
 */
export function extractResponseFromUIMessage(message: UIMessage): string {
  if (message.role !== "assistant") return "";
  return extractTextFromParts(message.parts);
}

/**
 * Checks if a UIMessage contains tool invocations
 */
export function hasToolInvocations(message: UIMessage): boolean {
  return (
    message.parts?.some(
      (part) => part.type === "tool-invocation" || part.type === "tool-result"
    ) ?? false
  );
}

/**
 * Extracts plan ID from tool results if textEditor created a plan
 * Note: In PR2.0, AI SDK does NOT create plans, so this returns undefined
 * Kept for future enhancement compatibility
 */
export function extractPlanIdFromToolResults(
  message: UIMessage
): string | undefined {
  // Filter for tool-related parts (AI SDK v5 uses type like "tool-textEditor")
  const toolParts =
    message.parts?.filter(
      (part) => part.type === "tool-result" || part.type.startsWith("tool-")
    ) ?? [];

  for (const part of toolParts) {
    // Type assertion - tool parts may have output with planId
    // Using unknown cast to avoid strict type checking on AI SDK internal types
    const toolPart = part as unknown as {
      type: string;
      toolName?: string;
      output?: { planId?: string };
    };
    if (toolPart.toolName === "textEditor" && toolPart.output?.planId) {
      return toolPart.output.planId;
    }
  }

  return undefined;
}

/**
 * Maps AI SDK status to existing UI flags
 *
 * Status mapping (from Tech PRD):
 * - 'submitted' → isThinking=true, isStreaming=false
 * - 'streaming' → isThinking=false, isStreaming=true
 * - 'ready' → isThinking=false, isStreaming=false, isIntentComplete=true
 * - 'error' → isThinking=false, isStreaming=false, isIntentComplete=true
 */
export interface StatusFlags {
  isThinking: boolean;
  isStreaming: boolean;
  isIntentComplete: boolean;
  isComplete: boolean;
}

export function mapStatusToFlags(
  status: "submitted" | "streaming" | "ready" | "error"
): StatusFlags {
  switch (status) {
    case "submitted":
      return {
        isThinking: true,
        isStreaming: false,
        isIntentComplete: false,
        isComplete: false,
      };
    case "streaming":
      return {
        isThinking: false,
        isStreaming: true,
        isIntentComplete: false,
        isComplete: false,
      };
    case "ready":
    case "error":
      return {
        isThinking: false,
        isStreaming: false,
        isIntentComplete: true,
        isComplete: true,
      };
  }
}

/**
 * Converts a single AI SDK UIMessage to existing Message format
 */
export function mapUIMessageToMessage(
  uiMessage: UIMessage,
  options: {
    workspaceId?: string;
    revisionNumber?: number;
    isComplete?: boolean;
    isCanceled?: boolean;
  } = {}
): Message {
  const isUser = uiMessage.role === "user";
  const isAssistant = uiMessage.role === "assistant";

  return {
    id: uiMessage.id,
    prompt: isUser ? extractTextFromParts(uiMessage.parts) : "",
    response: isAssistant ? extractTextFromParts(uiMessage.parts) : undefined,
    isComplete: options.isComplete ?? true,
    isIntentComplete: options.isComplete ?? true,
    isCanceled: options.isCanceled ?? false,
    workspaceId: options.workspaceId,
    revisionNumber: options.revisionNumber,
    // PR2.0: AI SDK does NOT create plans - responsePlanId will be undefined
    responsePlanId: isAssistant
      ? extractPlanIdFromToolResults(uiMessage)
      : undefined,
    createdAt: new Date(),
    // Not supported in AI SDK mode (per Tech PRD):
    // - followupActions
    // - responseRollbackToRevisionNumber
    // - isApplied, isApplying, isIgnored (use Commit/Discard instead)
  };
}

/**
 * Converts array of AI SDK UIMessages to existing Message format
 * Pairs user/assistant messages appropriately for display
 *
 * @param uiMessages - Array of UIMessages from AI SDK useChat
 * @param options - Configuration options
 * @returns Array of Messages in existing format
 */
export function mapUIMessagesToMessages(
  uiMessages: UIMessage[],
  options: {
    workspaceId?: string;
    revisionNumber?: number;
    isStreaming?: boolean;
    isCanceled?: boolean;
  } = {}
): Message[] {
  const messages: Message[] = [];

  for (let i = 0; i < uiMessages.length; i++) {
    const uiMsg = uiMessages[i];

    if (uiMsg.role === "user") {
      // Start a new message with user prompt
      const message: Message = {
        id: uiMsg.id,
        prompt: extractTextFromParts(uiMsg.parts),
        response: undefined,
        isComplete: false,
        isIntentComplete: false,
        isCanceled: false,
        workspaceId: options.workspaceId,
        revisionNumber: options.revisionNumber,
        createdAt: new Date(),
      };

      // Check if next message is the assistant response
      const nextMsg = uiMessages[i + 1];
      if (nextMsg && nextMsg.role === "assistant") {
        message.response = extractTextFromParts(nextMsg.parts);
        message.responsePlanId = extractPlanIdFromToolResults(nextMsg);

        // Determine completion status
        const isLastMessage = i + 1 === uiMessages.length - 1;
        message.isComplete = !options.isStreaming || !isLastMessage;
        message.isIntentComplete = message.isComplete;
        message.isCanceled = isLastMessage
          ? options.isCanceled ?? false
          : false;

        i++; // Skip the assistant message in next iteration
      }

      messages.push(message);
    }
    // Handle standalone assistant messages (shouldn't happen normally, but handle gracefully)
    else if (uiMsg.role === "assistant" && i === 0) {
      // Assistant message at start without user prompt (edge case)
      const message: Message = {
        id: uiMsg.id,
        prompt: "",
        response: extractTextFromParts(uiMsg.parts),
        isComplete: !options.isStreaming,
        isIntentComplete: !options.isStreaming,
        isCanceled: options.isCanceled ?? false,
        workspaceId: options.workspaceId,
        revisionNumber: options.revisionNumber,
        responsePlanId: extractPlanIdFromToolResults(uiMsg),
        createdAt: new Date(),
      };
      messages.push(message);
    }
  }

  return messages;
}

/**
 * Merges streaming messages with historical messages from database
 * Historical messages take precedence for shared IDs (database is authoritative)
 * 
 * PR2.0 Enhancement: Also matches by prompt content since AI SDK generates
 * different IDs than the database. When a streaming message's prompt matches
 * a historical message, we merge the streaming response INTO the historical message.
 *
 * @param historicalMessages - Messages from database (via Jotai/Centrifugo)
 * @param streamingMessages - Messages from current AI SDK session
 * @returns Merged array with no duplicates, streaming responses attached to historical messages
 */
export function mergeMessages(
  historicalMessages: Message[],
  streamingMessages: Message[]
): Message[] {
  const historicalIds = new Set(historicalMessages.map((m) => m.id));
  
  // Create a map of prompt content -> historical message for matching
  const historicalByPrompt = new Map<string, Message>();
  for (const msg of historicalMessages) {
    if (msg.prompt) {
      historicalByPrompt.set(msg.prompt.trim(), msg);
    }
  }

  // Merge streaming responses into historical messages where prompts match
  const mergedHistorical = historicalMessages.map((histMsg) => {
    if (!histMsg.prompt || histMsg.response) {
      // Already has response or no prompt to match, keep as-is
      return histMsg;
    }
    
    // Find streaming message with matching prompt
    const matchingStreaming = streamingMessages.find(
      (sm) => sm.prompt?.trim() === histMsg.prompt?.trim()
    );
    
    if (matchingStreaming && matchingStreaming.response) {
      // Merge streaming response into historical message
      return {
        ...histMsg,
        response: matchingStreaming.response,
        isComplete: matchingStreaming.isComplete,
        isIntentComplete: matchingStreaming.isIntentComplete,
        isCanceled: matchingStreaming.isCanceled,
      };
    }
    
    return histMsg;
  });

  // Filter out streaming messages that:
  // 1. Already exist in history by ID
  // 2. Have matching prompts in history (already merged above)
  const newStreamingMessages = streamingMessages.filter((m) => {
    if (historicalIds.has(m.id)) return false;
    if (m.prompt && historicalByPrompt.has(m.prompt.trim())) return false;
    return true;
  });

  return [...mergedHistorical, ...newStreamingMessages];
}

/**
 * Determines if a message is currently being streamed by AI SDK
 * Used by Centrifugo handler to skip updates for streaming messages
 *
 * @param messageId - ID of the message to check
 * @param currentStreamingMessageId - ID of message currently streaming (from adapter)
 * @returns true if this message is being streamed
 */
export function isMessageCurrentlyStreaming(
  messageId: string,
  currentStreamingMessageId: string | null
): boolean {
  if (!currentStreamingMessageId) return false;
  return messageId === currentStreamingMessageId;
}

