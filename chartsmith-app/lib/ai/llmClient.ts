/**
 * Shared LLM Client Library
 * 
 * This module provides a unified interface for AI chat with tool support.
 * It imports from PR1's provider.ts and extends it with tool integration.
 * 
 * Use runChat() for chat interactions that may need tool support.
 * Use getModel() for direct model access (re-exported from provider.ts).
 */

import { streamText, type LanguageModel, type CoreMessage } from 'ai';

// Re-export from provider.ts for convenience
export { 
  getModel, 
  getDefaultProvider,
  isValidProvider,
  isValidModel,
  AVAILABLE_PROVIDERS,
  AVAILABLE_MODELS,
} from './provider';

export type { Provider, ProviderConfig, ModelConfig } from './provider';

// Re-export prompts
export { 
  CHARTSMITH_TOOL_SYSTEM_PROMPT,
  CHARTSMITH_CHAT_PROMPT,
  getSystemPromptWithContext,
} from './prompts';

// Re-export tool utilities
export { createTools, TOOL_NAMES } from './tools';
export type { ToolName } from './tools';

/**
 * Options for runChat function
 */
export interface RunChatOptions {
  /** The model instance to use */
  model: LanguageModel;
  /** The messages to send */
  messages: CoreMessage[];
  /** System prompt to use */
  system?: string;
  /** Tools to make available (use createTools() to generate) */
  tools?: Record<string, ReturnType<typeof import('./tools').createTools>[keyof ReturnType<typeof import('./tools').createTools>]>;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Run a chat completion with optional tool support
 * 
 * This is the main entry point for AI chat interactions in the application.
 * It wraps streamText() with consistent configuration.
 * 
 * @param options - Chat options including model, messages, system prompt, and tools
 * @returns The streamText result for streaming responses
 * 
 * @example
 * ```typescript
 * import { runChat, getModel, createTools, CHARTSMITH_TOOL_SYSTEM_PROMPT } from '@/lib/ai/llmClient';
 * 
 * const tools = createTools(authHeader, workspaceId, revisionNumber);
 * const model = getModel('anthropic');
 * 
 * const result = runChat({
 *   model,
 *   messages,
 *   system: CHARTSMITH_TOOL_SYSTEM_PROMPT,
 *   tools,
 * });
 * 
 * return result.toTextStreamResponse();
 * ```
 */
export function runChat(options: RunChatOptions) {
  const { model, messages, system, tools, abortSignal } = options;
  
  return streamText({
    model,
    messages,
    system,
    tools,
    abortSignal,
  });
}

/**
 * Check if a response contains tool calls
 * 
 * Useful for debugging and logging tool usage.
 */
export function hasToolCalls(response: unknown): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }
  
  const r = response as Record<string, unknown>;
  return Array.isArray(r.toolCalls) && r.toolCalls.length > 0;
}

const llmClient = {
  runChat,
  hasToolCalls,
};

export default llmClient;

