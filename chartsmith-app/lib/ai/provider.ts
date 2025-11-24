/**
 * AI Provider Factory for ChartSmith
 * 
 * This module provides a unified interface for switching between AI providers
 * (Anthropic, OpenAI) based on environment configuration.
 * 
 * ## Configuration
 * 
 * Set the `LLM_PROVIDER` environment variable to choose the provider:
 * - `anthropic` (default) - Uses Claude models
 * - `openai` - Uses GPT models
 * 
 * Each provider requires its own API key:
 * - `ANTHROPIC_API_KEY` for Anthropic
 * - `OPENAI_API_KEY` for OpenAI
 * 
 * ## Model Selection
 * 
 * You can also override the default model with `LLM_MODEL`:
 * - For Anthropic: `claude-3-haiku-20240307`, `claude-3-sonnet-20240229`, `claude-3-opus-20240229`
 * - For OpenAI: `gpt-4-turbo`, `gpt-4o`, `gpt-3.5-turbo`
 * 
 * @example
 * ```typescript
 * import { getModel, getProviderInfo } from '@/lib/ai/provider';
 * 
 * const model = getModel();
 * const info = getProviderInfo();
 * console.log(`Using ${info.provider} with model ${info.model}`);
 * ```
 * 
 * @module lib/ai/provider
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * Supported AI providers
 */
export type AIProvider = 'anthropic' | 'openai';

/**
 * Default models for each provider
 */
const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-3-haiku-20240307',
  openai: 'gpt-4-turbo',
};

/**
 * Alternative models available for each provider
 */
export const AVAILABLE_MODELS: Record<AIProvider, string[]> = {
  anthropic: [
    'claude-3-haiku-20240307',    // Fast, cost-effective
    'claude-3-sonnet-20240229',   // Balanced performance
    'claude-3-opus-20240229',     // Most capable
    'claude-3-5-sonnet-20241022', // Latest Sonnet
  ],
  openai: [
    'gpt-4-turbo',      // Fast GPT-4
    'gpt-4o',           // Latest optimized
    'gpt-4o-mini',      // Cost-effective
    'gpt-3.5-turbo',    // Legacy, fastest
  ],
};

/**
 * Provider information returned by getProviderInfo()
 */
export interface ProviderInfo {
  provider: AIProvider;
  model: string;
  apiKeyConfigured: boolean;
}

/**
 * Get the current provider from environment
 */
export function getProvider(): AIProvider {
  const provider = process.env.LLM_PROVIDER?.toLowerCase() || 'anthropic';
  
  if (provider !== 'anthropic' && provider !== 'openai') {
    console.warn(`[AI Provider] Unknown provider "${provider}", falling back to anthropic`);
    return 'anthropic';
  }
  
  return provider;
}

/**
 * Get the model name to use
 */
export function getModelName(): string {
  const provider = getProvider();
  const customModel = process.env.LLM_MODEL;
  
  if (customModel) {
    // Validate that the model is available for the provider
    if (AVAILABLE_MODELS[provider].includes(customModel)) {
      return customModel;
    }
    console.warn(
      `[AI Provider] Model "${customModel}" not in known models for ${provider}, using anyway`
    );
    return customModel;
  }
  
  return DEFAULT_MODELS[provider];
}

/**
 * Check if the required API key is configured for the current provider
 */
export function isApiKeyConfigured(): boolean {
  const provider = getProvider();
  
  switch (provider) {
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    default:
      return false;
  }
}

/**
 * Get the AI model instance based on environment configuration.
 * 
 * This is the main function to use in route handlers:
 * 
 * ```typescript
 * import { getModel } from '@/lib/ai/provider';
 * 
 * const result = await streamText({
 *   model: getModel(),
 *   messages,
 *   system: systemPrompt,
 * });
 * ```
 * 
 * @returns Configured AI model instance
 * @throws Error if the API key is not configured
 */
export function getModel(): LanguageModel {
  const provider = getProvider();
  const modelName = getModelName();
  
  // Validate API key
  if (!isApiKeyConfigured()) {
    const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    throw new Error(
      `[AI Provider] ${keyName} is not configured. Please set it in your environment variables.`
    );
  }
  
  console.log(`[AI Provider] Using ${provider} with model ${modelName}`);
  
  switch (provider) {
    case 'openai':
      return openai(modelName);
    case 'anthropic':
    default:
      return anthropic(modelName);
  }
}

/**
 * Get information about the current provider configuration.
 * Useful for logging and debugging.
 * 
 * @returns Provider information object
 */
export function getProviderInfo(): ProviderInfo {
  return {
    provider: getProvider(),
    model: getModelName(),
    apiKeyConfigured: isApiKeyConfigured(),
  };
}

/**
 * Validate provider configuration and return any issues.
 * Useful for startup checks.
 * 
 * @returns Array of configuration issues, empty if all is well
 */
export function validateProviderConfig(): string[] {
  const issues: string[] = [];
  const provider = getProvider();
  
  if (!isApiKeyConfigured()) {
    const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    issues.push(`Missing ${keyName} for provider "${provider}"`);
  }
  
  const modelName = getModelName();
  if (!AVAILABLE_MODELS[provider].includes(modelName)) {
    issues.push(
      `Model "${modelName}" is not in the known models for ${provider}. ` +
      `Available: ${AVAILABLE_MODELS[provider].join(', ')}`
    );
  }
  
  return issues;
}

