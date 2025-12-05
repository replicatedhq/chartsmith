/**
 * AI Provider Factory
 * 
 * This module provides a factory for creating AI SDK model instances.
 * It abstracts provider selection and returns configured model instances
 * that can be used with streamText and other AI SDK functions.
 * 
 * Provider Priority (configurable via USE_OPENROUTER_PRIMARY env var):
 * 
 * When USE_OPENROUTER_PRIMARY=true (default):
 *   1. OpenRouter (OPENROUTER_API_KEY) - unified multi-provider access
 *   2. Direct Anthropic API (ANTHROPIC_API_KEY) - backup
 *   3. Direct OpenAI API (OPENAI_API_KEY) - backup
 * 
 * When USE_OPENROUTER_PRIMARY=false:
 *   1. Direct provider API (OPENAI_API_KEY or ANTHROPIC_API_KEY)
 *   2. OpenRouter (OPENROUTER_API_KEY) - fallback
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
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
 * Check if direct provider API keys are available
 */
function hasDirectOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function hasDirectAnthropic(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function hasOpenRouter(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Check if OpenRouter should be used as the primary provider
 * Default: true (OpenRouter first, direct APIs as backup)
 * Set USE_OPENROUTER_PRIMARY=false to use direct APIs first
 */
function shouldUseOpenRouterPrimary(): boolean {
  const envValue = process.env.USE_OPENROUTER_PRIMARY;
  // Default to true if not set or set to 'true'
  return envValue !== 'false';
}

/**
 * Create an OpenRouter provider instance (fallback)
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
 * Priority for API access:
 * 1. Direct provider API (OPENAI_API_KEY or ANTHROPIC_API_KEY)
 * 2. OpenRouter (OPENROUTER_API_KEY)
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
  // Determine the target provider
  let targetProvider: Provider;
  let targetModelId: string;
  
  if (modelId) {
    // If a specific model is provided, validate and use it
    const modelConfig = getModelById(modelId);
    if (!modelConfig) {
      throw new InvalidModelError(modelId);
    }
    targetModelId = modelConfig.modelId;
    targetProvider = modelConfig.provider;
  } else if (provider) {
    // If only provider is specified, use its default model
    const validProvider = AVAILABLE_PROVIDERS.find(p => p.id === provider);
    if (!validProvider) {
      throw new InvalidProviderError(provider);
    }
    targetProvider = provider as Provider;
    targetModelId = getDefaultModelForProvider(targetProvider);
  } else {
    // Use the global default
    targetModelId = DEFAULT_MODEL;
    targetProvider = DEFAULT_PROVIDER as Provider;
  }

  // Determine provider priority based on USE_OPENROUTER_PRIMARY setting
  const openRouterFirst = shouldUseOpenRouterPrimary();
  
  if (openRouterFirst) {
    // Priority: OpenRouter → Direct Anthropic → Direct OpenAI
    
    // 1. Try OpenRouter first (primary)
    if (hasOpenRouter()) {
      console.log(`[AI Provider] Using OpenRouter (primary) for model: ${targetModelId}`);
      const openrouter = createOpenRouterProvider();
      return openrouter(targetModelId);
    }
    
    // 2. Fall back to direct Anthropic API
    if (targetProvider === 'anthropic' && hasDirectAnthropic()) {
      const shortModelId = targetModelId.replace('anthropic/', '');
      console.log(`[AI Provider] Using direct Anthropic API (backup) for model: ${shortModelId}`);
      return anthropic(shortModelId);
    }
    
    // 3. Fall back to direct OpenAI API
    if (targetProvider === 'openai' && hasDirectOpenAI()) {
      const shortModelId = targetModelId.replace('openai/', '');
      console.log(`[AI Provider] Using direct OpenAI API (backup) for model: ${shortModelId}`);
      return openai(shortModelId);
    }
  } else {
    // Priority: Direct APIs → OpenRouter (original behavior)
    
    // 1. Try direct provider APIs first
    if (targetProvider === 'openai' && hasDirectOpenAI()) {
      const shortModelId = targetModelId.replace('openai/', '');
      console.log(`[AI Provider] Using direct OpenAI API for model: ${shortModelId}`);
      return openai(shortModelId);
    }
    
    if (targetProvider === 'anthropic' && hasDirectAnthropic()) {
      const shortModelId = targetModelId.replace('anthropic/', '');
      console.log(`[AI Provider] Using direct Anthropic API for model: ${shortModelId}`);
      return anthropic(shortModelId);
    }

    // 2. Fall back to OpenRouter
    if (hasOpenRouter()) {
      console.log(`[AI Provider] Using OpenRouter (fallback) for model: ${targetModelId}`);
      const openrouter = createOpenRouterProvider();
      return openrouter(targetModelId);
    }
  }

  // No API keys available
  throw new Error(
    `No API key available for provider '${targetProvider}'. ` +
    `Set OPENROUTER_API_KEY (recommended), or ANTHROPIC_API_KEY/OPENAI_API_KEY in your environment.`
  );
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

