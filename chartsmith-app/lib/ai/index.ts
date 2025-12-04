/**
 * AI Module Exports
 * 
 * This module re-exports all AI-related utilities for convenient importing.
 * 
 * @example
 * ```typescript
 * import { getModel, AVAILABLE_PROVIDERS, CHARTSMITH_SYSTEM_PROMPT } from '@/lib/ai';
 * import { createTools, runChat } from '@/lib/ai';
 * ```
 */

// Provider factory and utilities
export { 
  getModel, 
  getDefaultProvider,
  isValidProvider,
  isValidModel,
  InvalidProviderError,
  InvalidModelError,
  AVAILABLE_PROVIDERS,
  AVAILABLE_MODELS,
} from './provider';

// Type exports
export type { 
  Provider, 
  ProviderConfig, 
  ModelConfig 
} from './provider';

// Model utilities
export {
  getModelsForProvider,
  getModelById,
  getProviderById,
  getDefaultModelForProvider,
} from './models';

// Configuration constants
export {
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  MAX_STREAMING_DURATION,
  CHARTSMITH_SYSTEM_PROMPT,
  STREAMING_THROTTLE_MS,
} from './config';

// PR1.5: LLM Client and tools
export { runChat, hasToolCalls } from './llmClient';
export { 
  createTools,
  TOOL_NAMES,
  createGetChartContextTool,
  createTextEditorTool,
  createLatestSubchartVersionTool,
  createLatestKubernetesVersionTool,
  callGoEndpoint,
} from './tools';
export type { ToolName } from './tools';

// PR1.5: System prompts with tool documentation
export {
  CHARTSMITH_TOOL_SYSTEM_PROMPT,
  CHARTSMITH_CHAT_PROMPT,
  getSystemPromptWithContext,
} from './prompts';

