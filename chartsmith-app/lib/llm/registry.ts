import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { LanguageModel } from 'ai';

/**
 * Verified models with known capabilities
 * These models are tested and recommended for Chartsmith
 */
export const VERIFIED_MODELS = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Latest Claude model, best for complex reasoning and planning',
    contextWindow: 200000,
    supportsTools: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Versatile and fast, good for general tasks',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Long context window, fast responses',
    contextWindow: 1000000,
    supportsTools: true,
  },
] as const;

/**
 * OpenRouter-specific models
 * These use OpenRouter's routing format (provider/model)
 */
export const OPENROUTER_MODELS = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (OpenRouter)',
    provider: 'openrouter',
    description: 'Auto-routes to latest Claude 3.5, with failover',
    contextWindow: 200000,
    supportsTools: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (OpenRouter)',
    provider: 'openrouter',
    description: 'OpenAI GPT-4o via OpenRouter with failover',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    description: 'Open source, cost-effective alternative',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'openrouter',
    description: 'Code-focused model, excellent for technical tasks',
    contextWindow: 64000,
    supportsTools: true,
  },
] as const;

export type ModelInfo = typeof VERIFIED_MODELS[number] | typeof OPENROUTER_MODELS[number] | {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
  supportsTools: boolean;
};

/**
 * Check which API providers are available based on environment variables
 */
export function getAvailableProviders(): string[] {
  const providers: string[] = [];
  
  if (process.env.OPENROUTER_API_KEY) {
    providers.push('openrouter');
  }
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push('anthropic');
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push('openai');
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    providers.push('google');
  }
  
  return providers;
}

/**
 * Create a model provider instance based on model ID
 * Implements priority logic:
 * 1. OpenRouter (if key exists and model has "/" format)
 * 2. Anthropic (if model starts with "claude-")
 * 3. OpenAI (if model starts with "gpt-")
 * 4. Google (if model starts with "gemini-")
 * 5. Fallback to OpenRouter if available
 */
export function createModelProvider(modelId: string): LanguageModel {
  const availableProviders = getAvailableProviders();
  
  // OpenRouter models (contain "/")
  if (modelId.includes('/')) {
    if (availableProviders.includes('openrouter')) {
      return openrouter(modelId);
    }
    throw new Error(`OpenRouter model "${modelId}" requested but OPENROUTER_API_KEY not set`);
  }
  
  // Anthropic models
  if (modelId.startsWith('claude-')) {
    if (availableProviders.includes('anthropic')) {
      return anthropic(modelId);
    }
    // Fallback to OpenRouter if available
    if (availableProviders.includes('openrouter')) {
      return openrouter(`anthropic/${modelId}`);
    }
    throw new Error(`Anthropic model "${modelId}" requested but no API key available`);
  }
  
  // OpenAI models
  if (modelId.startsWith('gpt-')) {
    if (availableProviders.includes('openai')) {
      return openai(modelId);
    }
    // Fallback to OpenRouter if available
    if (availableProviders.includes('openrouter')) {
      return openrouter(`openai/${modelId}`);
    }
    throw new Error(`OpenAI model "${modelId}" requested but no API key available`);
  }
  
  // Google models
  if (modelId.startsWith('gemini-')) {
    if (availableProviders.includes('google')) {
      return google(modelId);
    }
    // Fallback to OpenRouter if available
    if (availableProviders.includes('openrouter')) {
      return openrouter(`google/${modelId}`);
    }
    throw new Error(`Google model "${modelId}" requested but no API key available`);
  }
  
  // Unknown model format - try OpenRouter as last resort
  if (availableProviders.includes('openrouter')) {
    return openrouter(modelId);
  }
  
  throw new Error(`Unknown model "${modelId}" and no fallback provider available`);
}

/**
 * Get the default model based on available API keys
 * Uses same priority as config.ts: OpenRouter → Anthropic → OpenAI → Google
 */
export function getDefaultModel(): string {
  const availableProviders = getAvailableProviders();
  
  if (availableProviders.includes('openrouter')) {
    return 'anthropic/claude-3.5-sonnet';
  }
  if (availableProviders.includes('anthropic')) {
    return 'claude-sonnet-4-20250514';
  }
  if (availableProviders.includes('openai')) {
    return 'gpt-4o';
  }
  if (availableProviders.includes('google')) {
    return 'gemini-2.0-flash-exp';
  }
  
  // Fallback (will error when trying to use, but provides clear message)
  return 'claude-sonnet-4-20250514';
}

/**
 * Get a model instance using the default model or specified model ID
 */
export function getModel(modelId?: string): LanguageModel {
  const model = modelId || getDefaultModel();
  return createModelProvider(model);
}