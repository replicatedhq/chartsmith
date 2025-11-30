/**
 * AI Model Configuration
 * 
 * This file defines the available models for each AI provider.
 * Models are used in the provider/model selection UI.
 */

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  provider: 'anthropic' | 'openrouter';
}

// Anthropic Models
export const ANTHROPIC_MODELS: ModelConfig[] = [
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    description: 'Latest and most capable model (Feb 2025)',
    contextWindow: 200000,
    provider: 'anthropic',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Balanced performance and speed (Oct 2024)',
    contextWindow: 200000,
    provider: 'anthropic',
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Most powerful model for complex tasks',
    contextWindow: 200000,
    provider: 'anthropic',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and cost-effective',
    contextWindow: 200000,
    provider: 'anthropic',
  },
];

// OpenRouter Models (Popular models available via OpenRouter)
export const OPENROUTER_MODELS: ModelConfig[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (OpenRouter)',
    description: 'Claude 3.5 Sonnet via OpenRouter',
    contextWindow: 200000,
    provider: 'openrouter',
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'OpenAI GPT-4 Turbo',
    contextWindow: 128000,
    provider: 'openrouter',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'OpenAI GPT-4 Omni',
    contextWindow: 128000,
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini 1.5 Pro',
    description: 'Google Gemini 1.5 Pro',
    contextWindow: 1000000,
    provider: 'openrouter',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    description: 'Meta Llama 3.3 70B Instruct',
    contextWindow: 128000,
    provider: 'openrouter',
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B',
    description: 'Mistral Mixtral 8x7B Instruct',
    contextWindow: 32000,
    provider: 'openrouter',
  },
];

// Get models for a specific provider
export function getModelsForProvider(provider: 'anthropic' | 'openrouter'): ModelConfig[] {
  if (provider === 'anthropic') {
    return ANTHROPIC_MODELS;
  }
  return OPENROUTER_MODELS;
}

// Get model config by ID
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return [...ANTHROPIC_MODELS, ...OPENROUTER_MODELS].find(m => m.id === modelId);
}

// Get default model for provider
export function getDefaultModelForProvider(provider: 'anthropic' | 'openrouter'): string {
  if (provider === 'anthropic') {
    return 'claude-3-5-sonnet-20241022';
  }
  return 'anthropic/claude-3.5-sonnet';
}

