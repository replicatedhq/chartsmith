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
      console.error('[Provider Validation] ANTHROPIC_API_KEY is not configured');
      return 'ANTHROPIC_API_KEY environment variable is not set. Please add it to your .env.local file.';
    }
    console.log('[Provider Validation] Anthropic API key is configured');
  } else if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[Provider Validation] OPENROUTER_API_KEY is not configured');
      return 'OPENROUTER_API_KEY environment variable is not set. Please add it to your .env.local file.';
    }
    console.log('[Provider Validation] OpenRouter API key is configured');
  }
  
  return null;
}

/**
 * Check if an error is due to insufficient credits or invalid API key
 * @param error - The error object
 * @returns Error message with helpful information
 */
export function parseProviderError(error: any, provider: AIProvider): string {
  const errorMessage = error?.message || String(error);
  const statusCode = error?.status || error?.statusCode;
  
  console.error(`[${provider.toUpperCase()} Error]`, {
    message: errorMessage,
    status: statusCode,
    error: error
  });

  // OpenRouter specific errors
  if (provider === 'openrouter') {
    if (statusCode === 401 || errorMessage.includes('unauthorized') || errorMessage.includes('invalid api key')) {
      return '🔑 OpenRouter API Key Error: Your API key is invalid or not recognized. Please check your OPENROUTER_API_KEY in .env.local';
    }
    if (statusCode === 402 || errorMessage.includes('insufficient credits') || errorMessage.includes('credit')) {
      return '💳 OpenRouter Credits Error: Insufficient credits. Please add credits to your OpenRouter account at https://openrouter.ai/credits';
    }
    if (statusCode === 429) {
      return '⏱️ OpenRouter Rate Limit: Too many requests. Please wait a moment and try again.';
    }
  }

  // Anthropic specific errors
  if (provider === 'anthropic') {
    if (statusCode === 401) {
      return '🔑 Anthropic API Key Error: Your API key is invalid. Please check your ANTHROPIC_API_KEY in .env.local';
    }
    if (statusCode === 429) {
      return '⏱️ Anthropic Rate Limit: Too many requests. Please wait a moment and try again.';
    }
  }

  return `AI Provider Error (${provider}): ${errorMessage}`;
}

