/**
 * LLM Provider Configuration
 * 
 * This module provides a unified interface for switching between
 * different LLM providers (Anthropic, OpenAI, etc.) using the Vercel AI SDK.
 * 
 * To switch providers, set the following environment variables:
 * - LLM_PROVIDER: 'anthropic' | 'openai' (default: 'anthropic')
 * - LLM_MODEL: Model name (default varies by provider)
 * 
 * Example:
 *   LLM_PROVIDER=openai LLM_MODEL=gpt-4o npm run dev
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { LanguageModelV1 } from 'ai';

export type LLMProvider = 'anthropic' | 'openai';

interface ProviderConfig {
  provider: LLMProvider;
  model: string;
}

/**
 * Default models for each provider.
 */
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o',
};

/**
 * Gets the current provider configuration from environment variables.
 */
export function getProviderConfig(): ProviderConfig {
  const provider = (process.env.LLM_PROVIDER || 'anthropic') as LLMProvider;
  const model = process.env.LLM_MODEL || DEFAULT_MODELS[provider];
  
  return { provider, model };
}

/**
 * Creates a language model instance based on the current configuration.
 * 
 * @returns A Vercel AI SDK compatible language model
 */
export function getModel(): LanguageModelV1 {
  const { provider, model } = getProviderConfig();
  
  switch (provider) {
    case 'openai':
      return openai(model);
    case 'anthropic':
    default:
      return anthropic(model);
  }
}

/**
 * Gets the model for a specific provider (useful for explicit provider selection).
 * 
 * @param provider - The provider to use
 * @param model - Optional model override
 * @returns A Vercel AI SDK compatible language model
 */
export function getModelForProvider(
  provider: LLMProvider,
  model?: string
): LanguageModelV1 {
  const modelName = model || DEFAULT_MODELS[provider];
  
  switch (provider) {
    case 'openai':
      return openai(modelName);
    case 'anthropic':
    default:
      return anthropic(modelName);
  }
}

