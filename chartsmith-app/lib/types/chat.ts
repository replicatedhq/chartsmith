/**
 * Chat message format conversion utilities.
 *
 * Converts between AI SDK v5 UIMessage format and our internal Message type.
 * This enables the frontend to use Vercel AI SDK's useChat hook while
 * maintaining compatibility with existing components that use the Message type.
 *
 * AI SDK v5 uses UIMessage with a `parts` array instead of `content` string.
 */

import { UIMessage } from 'ai';
import { Message } from '@/components/types';
import * as srs from 'secure-random-string';

/**
 * Metadata fields that are Chartsmith-specific and not part of AI SDK message format.
 * These are preserved during conversion.
 */
export interface MessageMetadata {
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
  isApplied?: boolean;
  isApplying?: boolean;
  isIgnored?: boolean;
  isCanceled?: boolean;
  createdAt?: Date;
}

/**
 * Generate a unique ID for messages.
 */
function generateId(): string {
  return srs.default({ length: 32 });
}

/**
 * Extract text content from UIMessage parts array.
 * AI SDK v5 uses parts array with type: 'text' for text content.
 */
export function extractTextFromParts(parts: UIMessage['parts']): string {
  if (!parts || !Array.isArray(parts)) {
    return '';
  }
  return parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text || '')
    .join('');
}

/**
 * Convert AI SDK v5 UIMessage to our Message format.
 *
 * AI SDK messages are separate user/assistant messages, while our format
 * combines them into a single Message with prompt (user) and response (assistant).
 *
 * @param uiMessage - AI SDK v5 UIMessage (user or assistant)
 * @param metadata - Chartsmith-specific metadata to preserve
 * @returns Message in our format
 */
export function uiMessageToMessage(
  uiMessage: UIMessage,
  metadata: MessageMetadata = {}
): Message {
  const content = extractTextFromParts(uiMessage.parts);
  const messageId = uiMessage.id || generateId();

  // Extract tool invocations from parts if present
  // In AI SDK v5, tool parts have type like 'tool-${name}' or 'dynamic-tool'
  const toolParts = uiMessage.parts?.filter(
    (part) => part.type.startsWith('tool-') || part.type === 'dynamic-tool'
  ) || [];

  const toolInvocations = toolParts.length > 0
    ? toolParts.map((part: any) => ({
        toolCallId: part.toolCallId,
        toolName: part.toolName || part.type.replace('tool-', ''),
        args: part.input,
        result: part.output,
      }))
    : undefined;

  if (uiMessage.role === 'user') {
    return {
      id: messageId,
      prompt: content,
      response: undefined,
      isComplete: true,
      createdAt: metadata.createdAt || new Date(),
      toolInvocations,
      ...metadata,
    };
  } else if (uiMessage.role === 'assistant') {
    return {
      id: messageId,
      prompt: '', // Assistant messages don't have prompts
      response: content,
      isComplete: true,
      createdAt: metadata.createdAt || new Date(),
      toolInvocations,
      ...metadata,
    };
  }

  throw new Error(`Unsupported message role: ${uiMessage.role}`);
}

/**
 * Convert our Message format to AI SDK v5 UIMessage array.
 *
 * Our Message format combines user prompt and assistant response into one object.
 * This function splits it into separate user and assistant UIMessages for AI SDK v5.
 *
 * @param message - Our Message format
 * @returns Array of AI SDK v5 UIMessages (user, then assistant if response exists)
 */
export function messageToUIMessages(message: Message): UIMessage[] {
  const messages: UIMessage[] = [];

  if (message.prompt) {
    messages.push({
      id: `${message.id}-user`,
      role: 'user',
      parts: [{ type: 'text', text: message.prompt }],
    });
  }

  if (message.response) {
    messages.push({
      id: `${message.id}-assistant`,
      role: 'assistant',
      parts: [{ type: 'text', text: message.response }],
    });
  }

  return messages;
}

/**
 * Convert array of Messages to AI SDK v5 UIMessage format for initial messages.
 *
 * @param messages - Array of our Message format
 * @returns Array of AI SDK v5 UIMessages
 */
export function messagesToUIMessages(messages: Message[]): UIMessage[] {
  return messages.flatMap(messageToUIMessages);
}

// Legacy exports for backward compatibility with tests
// These are deprecated and will be removed in a future version
export const aiMessageToMessage = uiMessageToMessage;
export const messageToAIMessages = messageToUIMessages;
export const messagesToAIMessages = messagesToUIMessages;
