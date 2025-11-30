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

// Anthropic Models (Direct API)
export const ANTHROPIC_MODELS: ModelConfig[] = [
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    description: '',
    contextWindow: 200000,
    provider: 'anthropic',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: '',
    contextWindow: 200000,
    provider: 'anthropic',
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: '',
    contextWindow: 200000,
    provider: 'anthropic',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: '',
    contextWindow: 200000,
    provider: 'anthropic',
  },
];

// OpenRouter Models - Grouped by provider
export const OPENROUTER_MODELS: ModelConfig[] = [
  // Google
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: '',
    contextWindow: 1050000,
    provider: 'openrouter',
  },
  
  // Anthropic
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: '',
    contextWindow: 200000,
    provider: 'openrouter',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: '',
    contextWindow: 1000000,
    provider: 'openrouter',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: '',
    contextWindow: 200000,
    provider: 'openrouter',
  },
  
  // xAI
  {
    id: 'x-ai/grok-code-fast-1',
    name: 'Grok Code Fast 1',
    description: '',
    contextWindow: 128000,
    provider: 'openrouter',
  },
  {
    id: 'x-ai/grok-4.1-fast:free',
    name: 'Grok 4.1 Fast (Free)',
    description: '',
    contextWindow: 128000,
    provider: 'openrouter',
  },
  
  // OpenAI
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    description: '',
    contextWindow: 1000000,
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
  return 'anthropic/claude-sonnet-4.5';
}




