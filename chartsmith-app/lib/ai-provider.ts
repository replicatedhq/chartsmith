import { anthropic } from '@ai-sdk/anthropic';

/**
 * AI Provider Configuration
 *
 * This module provides a factory pattern for AI model configuration,
 * enabling easy multi-provider support in the future.
 */

export type AIProvider = 'anthropic' | 'openai' | 'google';

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  maxTokens?: number;
}

/**
 * Default model configurations for different providers
 */
const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4-turbo-preview',
  google: 'gemini-pro',
};

/**
 * Get the AI model instance based on provider and model name
 *
 * @param provider - The AI provider to use (default: 'anthropic')
 * @param modelName - The model name (optional, uses default if not specified)
 * @returns The configured AI model instance
 */
export function getAIModel(
  provider: AIProvider = 'anthropic',
  modelName?: string
) {
  const model = modelName || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'anthropic':
      return anthropic(model);
    // Future providers can be added here:
    // case 'openai':
    //   return openai(model);
    // case 'google':
    //   return google(model);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Get the default model for the current environment
 * This can be extended to read from environment variables
 */
export function getDefaultModel() {
  const provider = (process.env.AI_PROVIDER as AIProvider) || 'anthropic';
  const modelName = process.env.AI_MODEL_NAME;
  return getAIModel(provider, modelName);
}
