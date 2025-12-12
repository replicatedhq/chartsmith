/**
 * Message Adapter for AI SDK Integration
 * 
 * Provides utilities to convert between AI SDK message format
 * and Chartsmith's database message format.
 */

import type { Message as AIMessage } from '@ai-sdk/react';
import type { Message } from '@/components/types';
import type { ChatMessage } from '@/lib/types/workspace';

/**
 * Converts a Chartsmith database message to AI SDK format.
 * Used when loading conversation history.
 */
export function toAIMessage(message: Message | ChatMessage): AIMessage[] {
  const messages: AIMessage[] = [];
  
  // User message (the prompt)
  if (message.prompt) {
    messages.push({
      id: `${message.id}-user`,
      role: 'user',
      content: message.prompt,
      createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
    });
  }
  
  // Assistant message (the response)
  if (message.response) {
    messages.push({
      id: `${message.id}-assistant`,
      role: 'assistant',
      content: message.response,
      createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
    });
  }
  
  return messages;
}

/**
 * Converts an array of Chartsmith messages to AI SDK format.
 * Filters to only include conversational messages (no plans/renders).
 */
export function toAIMessages(messages: (Message | ChatMessage)[]): AIMessage[] {
  const aiMessages: AIMessage[] = [];
  
  for (const message of messages) {
    // Skip messages that are plan-based or have special responses
    // These should continue to use the existing Centrifugo-based UI
    if (
      (message as Message).responsePlanId ||
      (message as Message).responseRenderId ||
      (message as Message).responseConversionId
    ) {
      continue;
    }
    
    aiMessages.push(...toAIMessage(message));
  }
  
  return aiMessages;
}

/**
 * Extracts message data from AI SDK messages for database persistence.
 * Returns an object with prompt and response that can be saved.
 */
export function fromAIMessages(
  userMessage: AIMessage,
  assistantMessage: AIMessage
): {
  prompt: string;
  response: string;
} {
  return {
    prompt: userMessage.content,
    response: assistantMessage.content,
  };
}

/**
 * Creates a database-compatible message object from AI SDK messages.
 * This is a partial object - the ID and other fields should be set by the database.
 */
export interface CreateMessageFromAI {
  prompt: string;
  response: string;
  isComplete: boolean;
  isIntentComplete: boolean;
}

export function createMessageFromAI(
  userMessage: AIMessage,
  assistantMessage: AIMessage
): CreateMessageFromAI {
  return {
    prompt: userMessage.content,
    response: assistantMessage.content,
    isComplete: true,
    isIntentComplete: true,
  };
}

