/**
 * LLM Module Exports
 * 
 * This module provides unified access to all LLM-related functionality
 * using the Vercel AI SDK.
 */

// Provider configuration
export { getModel, getModelForProvider, getProviderConfig } from './provider';
export type { LLMProvider } from './provider';

// System prompts
export {
  buildSystemPrompt,
  commonSystemPrompt,
  chatOnlySystemPrompt,
  endUserSystemPrompt,
} from './system-prompts';
export type { ChatRole, ChartContext } from './system-prompts';

// Prompt type classification
export { promptType, PromptType, PromptRole } from './prompt-type';
export type { PromptIntent } from './prompt-type';

// Message adapters
export {
  toAIMessage,
  toAIMessages,
  fromAIMessages,
  createMessageFromAI,
} from './message-adapter';
export type { CreateMessageFromAI } from './message-adapter';

