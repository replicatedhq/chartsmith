/**
 * AI Provider Factory
 * 
 * Creates AI provider instances for Vercel AI SDK based on provider and model selection.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export type AIProvider = 'anthropic' | 'openrouter';

// OpenRouter client configuration
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://chartsmith.io',
    'X-Title': 'ChartSmith',
  },
});

/**
 * Get the appropriate AI provider model instance
 * @param provider - The AI provider (anthropic | openrouter)
 * @param model - The model ID
 * @returns Language model instance for Vercel AI SDK
 */
export function getProviderModel(provider: AIProvider, model: string) {
  if (provider === 'anthropic') {
    return anthropic(model);
  } else if (provider === 'openrouter') {
    return openrouter(model);
  }
  
  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Validate provider configuration
 * @param provider - The AI provider to validate
 * @returns Error message if invalid, null if valid
 */
export function validateProviderConfig(provider: AIProvider): string | null {
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      return 'ANTHROPIC_API_KEY environment variable is not set';
    }
  } else if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      return 'OPENROUTER_API_KEY environment variable is not set';
    }
  }
  
  return null;
}

