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
  // Anthropic models
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Latest Claude model, best for complex reasoning and planning',
    contextWindow: 200000,
    supportsTools: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'High-performance model with excellent reasoning capabilities',
    contextWindow: 200000,
    supportsTools: true,
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Most capable Claude 3 model for complex tasks',
    contextWindow: 200000,
    supportsTools: true,
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fast and cost-effective, great for simple tasks',
    contextWindow: 200000,
    supportsTools: true,
  },
  // OpenAI models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Versatile and fast, good for general tasks',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Cost-effective variant of GPT-4o, faster responses',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Enhanced GPT-4 with improved performance',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: 'Fast and affordable option for simpler tasks',
    contextWindow: 16385,
    supportsTools: true,
  },
  // Google models
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Long context window, fast responses',
    contextWindow: 1000000,
    supportsTools: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    description: 'Advanced model with strong reasoning capabilities',
    contextWindow: 1000000,
    supportsTools: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    description: 'Fast and efficient, good for quick responses',
    contextWindow: 1000000,
    supportsTools: true,
  },
] as const;

/**
 * OpenRouter-specific models
 * These use OpenRouter's routing format (provider/model)
 */
export const OPENROUTER_MODELS = [
  // Anthropic models via OpenRouter
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (OpenRouter)',
    provider: 'openrouter',
    description: 'Auto-routes to latest Claude 3.5, with failover',
    contextWindow: 200000,
    supportsTools: true,
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus (OpenRouter)',
    provider: 'openrouter',
    description: 'Most capable Claude 3 model via OpenRouter',
    contextWindow: 200000,
    supportsTools: true,
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku (OpenRouter)',
    provider: 'openrouter',
    description: 'Fast and cost-effective Claude model via OpenRouter',
    contextWindow: 200000,
    supportsTools: true,
  },
  // OpenAI models via OpenRouter
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (OpenRouter)',
    provider: 'openrouter',
    description: 'OpenAI GPT-4o via OpenRouter with failover',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (OpenRouter)',
    provider: 'openrouter',
    description: 'Cost-effective GPT-4o variant via OpenRouter',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo (OpenRouter)',
    provider: 'openrouter',
    description: 'Enhanced GPT-4 via OpenRouter',
    contextWindow: 128000,
    supportsTools: true,
  },
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo (OpenRouter)',
    provider: 'openrouter',
    description: 'Fast and affordable option via OpenRouter',
    contextWindow: 16385,
    supportsTools: true,
  },
  // Google models via OpenRouter
  {
    id: 'google/gemini-1.5-pro',
    name: 'Gemini 1.5 Pro (OpenRouter)',
    provider: 'openrouter',
    description: 'Advanced Gemini model via OpenRouter',
    contextWindow: 1000000,
    supportsTools: true,
  },
  {
    id: 'google/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (OpenRouter)',
    provider: 'openrouter',
    description: 'Fast Gemini model via OpenRouter',
    contextWindow: 1000000,
    supportsTools: true,
  },
  // Other models
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    description: 'Open source, cost-effective alternative',
    contextWindow: 128000,
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