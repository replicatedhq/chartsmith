/**
 * Chat message format conversion utilities.
 * 
 * Converts between AI SDK message format and our internal Message type.
 * This enables the frontend to use Vercel AI SDK's useChat hook while
 * maintaining compatibility with existing components that use the Message type.
 */

import { CoreMessage } from 'ai';
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
 * Extract text content from AI SDK message content.
 * Handles both string and array formats.
 */
function extractContent(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map(c => c.type === 'text' ? (c.text || '') : '')
    .join('');
}

/**
 * Generate a unique ID for messages.
 */
function generateId(): string {
  return srs.default({ length: 32 });
}

/**
 * Convert AI SDK message to our Message format.
 * 
 * AI SDK messages are separate user/assistant messages, while our format
 * combines them into a single Message with prompt (user) and response (assistant).
 * 
 * @param aiMessage - AI SDK message (user or assistant)
 * @param metadata - Chartsmith-specific metadata to preserve
 * @returns Message in our format
 */
export function aiMessageToMessage(
  aiMessage: CoreMessage,
  metadata: MessageMetadata = {}
): Message {
  const content = extractContent(aiMessage.content);
  // AI SDK messages may not have id, generate one if needed
  const messageId = (aiMessage as any).id || generateId();
  
  // Extract tool invocations if present
  const toolInvocations = (aiMessage as any).toolInvocations?.map((inv: any) => ({
    toolCallId: inv.toolCallId || inv.id,
    toolName: inv.toolName || inv.name,
    args: inv.args,
    result: inv.result,
  }));
  
  if (aiMessage.role === 'user') {
    return {
      id: messageId,
      prompt: content,
      response: undefined,
      isComplete: true,
      createdAt: metadata.createdAt || new Date(),
      toolInvocations,
      ...metadata,
    };
  } else if (aiMessage.role === 'assistant') {
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
  
  throw new Error(`Unsupported message role: ${(aiMessage as any).role}`);
}

/**
 * Convert our Message format to AI SDK messages.
 * 
 * Our Message format combines user prompt and assistant response into one object.
 * This function splits it into separate user and assistant messages for AI SDK.
 * 
 * @param message - Our Message format
 * @returns Array of AI SDK messages (user, then assistant if response exists)
 */
export function messageToAIMessages(message: Message): CoreMessage[] {
  const messages: CoreMessage[] = [];
  
  if (message.prompt) {
    messages.push({
      role: 'user',
      content: message.prompt,
    } as CoreMessage);
  }
  
  if (message.response) {
    messages.push({
      role: 'assistant',
      content: message.response,
    } as CoreMessage);
  }
  
  return messages;
}

/**
 * Convert array of Messages to AI SDK format for initial messages.
 * 
 * @param messages - Array of our Message format
 * @returns Array of AI SDK messages
 */
export function messagesToAIMessages(messages: Message[]): CoreMessage[] {
  return messages.flatMap(messageToAIMessages);
}

