/**
 * AI Provider Factory
 * 
 * This module provides a factory for creating AI SDK model instances.
 * It abstracts provider selection and returns configured model instances
 * that can be used with streamText and other AI SDK functions.
 * 
 * All models are accessed via OpenRouter for unified multi-provider support.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { 
  Provider, 
  AVAILABLE_PROVIDERS, 
  AVAILABLE_MODELS,
  getDefaultModelForProvider,
  getModelById,
} from './models';
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from './config';

// Re-export for convenience
export { AVAILABLE_PROVIDERS, AVAILABLE_MODELS } from './models';
export type { Provider, ProviderConfig, ModelConfig } from './models';

/**
 * Error thrown when an invalid provider is requested
 */
export class InvalidProviderError extends Error {
  constructor(provider: string) {
    super(`Invalid provider: ${provider}. Available providers: ${AVAILABLE_PROVIDERS.map(p => p.id).join(', ')}`);
    this.name = 'InvalidProviderError';
  }
}

/**
 * Error thrown when an invalid model is requested
 */
export class InvalidModelError extends Error {
  constructor(modelId: string) {
    super(`Invalid model: ${modelId}. Available models: ${AVAILABLE_MODELS.map(m => m.modelId).join(', ')}`);
    this.name = 'InvalidModelError';
  }
}

/**
 * Create an OpenRouter provider instance
 * 
 * This is a singleton-like factory that creates the OpenRouter client
 * configured with the API key from environment variables.
 */
function createOpenRouterProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  return createOpenRouter({
    apiKey,
  });
}

/**
 * Get a model instance for the specified provider and model
 * 
 * @param provider - The provider ID (e.g., 'openai', 'anthropic')
 * @param modelId - Optional specific model ID (e.g., 'openai/gpt-4o')
 * @returns An AI SDK model instance ready for use with streamText
 * 
 * @example
 * ```typescript
 * // Get the default OpenAI model
 * const model = getModel('openai');
 * 
 * // Get a specific model
 * const claudeModel = getModel('anthropic', 'anthropic/claude-3.5-sonnet');
 * 
 * // Use with streamText
 * const result = await streamText({
 *   model: getModel('openai'),
 *   messages: [...],
 * });
 * ```
 */
export function getModel(provider?: string, modelId?: string) {
  const openrouter = createOpenRouterProvider();
  
  // Determine which model to use
  let targetModelId: string;
  
  if (modelId) {
    // If a specific model is provided, validate and use it
    const modelConfig = getModelById(modelId);
    if (!modelConfig) {
      throw new InvalidModelError(modelId);
    }
    targetModelId = modelConfig.modelId;
  } else if (provider) {
    // If only provider is specified, use its default model
    const validProvider = AVAILABLE_PROVIDERS.find(p => p.id === provider);
    if (!validProvider) {
      throw new InvalidProviderError(provider);
    }
    targetModelId = getDefaultModelForProvider(provider as Provider);
  } else {
    // Use the global default
    targetModelId = DEFAULT_MODEL;
  }

  // Return the OpenRouter model instance
  return openrouter(targetModelId);
}

/**
 * Get the default provider
 */
export function getDefaultProvider(): Provider {
  const provider = DEFAULT_PROVIDER as Provider;
  const validProvider = AVAILABLE_PROVIDERS.find(p => p.id === provider);
  return validProvider ? provider : 'openai';
}

/**
 * Validate that a provider ID is valid
 */
export function isValidProvider(provider: string): provider is Provider {
  return AVAILABLE_PROVIDERS.some(p => p.id === provider);
}

/**
 * Validate that a model ID is valid
 */
export function isValidModel(modelId: string): boolean {
  return AVAILABLE_MODELS.some(m => m.modelId === modelId || m.id === modelId);
}

