/**
 * AI Model Definitions
 * 
 * This module defines the available AI models and providers for the chat system.
 * All models are accessed via OpenRouter for unified multi-provider support.
 */

// Provider type - the high-level provider selection
export type Provider = 'openai' | 'anthropic';

// Model configuration interface
export interface ModelConfig {
  id: string;           // Internal identifier
  name: string;         // Display name for UI
  provider: Provider;   // Which provider this model belongs to
  modelId: string;      // Full model ID for OpenRouter (e.g., "openai/gpt-4o")
  description: string;  // Brief description for UI tooltips
}

// Provider configuration interface
export interface ProviderConfig {
  id: Provider;
  name: string;
  description: string;
  defaultModel: string;  // Default model ID for this provider
}

/**
 * Available models configuration
 * 
 * These are the models users can select from in the ProviderSelector.
 * All models are accessed via OpenRouter.
 * 
 * Primary model: Claude Sonnet 4 - latest and recommended for Chartsmith
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  // Anthropic Claude 4 family (preferred)
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    modelId: 'anthropic/claude-sonnet-4',
    description: 'Anthropic\'s latest balanced model - recommended for Chartsmith',
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    modelId: 'anthropic/claude-sonnet-4-5',
    description: 'Anthropic\'s newest Sonnet model with enhanced capabilities',
  },
  {
    id: 'claude-opus-4.5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    modelId: 'anthropic/claude-opus-4-5',
    description: 'Anthropic\'s most powerful model',
  },
  // OpenAI models (alternative)
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    modelId: 'openai/gpt-4o',
    description: 'OpenAI\'s most capable model with vision capabilities',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    modelId: 'openai/gpt-4o-mini',
    description: 'Smaller, faster version of GPT-4o',
  },
];

/**
 * Available providers configuration
 * 
 * High-level provider groups shown in the ProviderSelector.
 * Anthropic is listed first as it's the preferred provider for Chartsmith.
 */
export const AVAILABLE_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet 4 (recommended) and Opus models',
    defaultModel: 'anthropic/claude-sonnet-4',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o and GPT-4o Mini models',
    defaultModel: 'openai/gpt-4o',
  },
];

/**
 * Get models for a specific provider
 */
export function getModelsForProvider(provider: Provider): ModelConfig[] {
  return AVAILABLE_MODELS.filter((model) => model.provider === provider);
}

/**
 * Get model configuration by ID
 */
export function getModelById(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find((model) => model.modelId === modelId || model.id === modelId);
}

/**
 * Get provider configuration by ID
 */
export function getProviderById(providerId: Provider): ProviderConfig | undefined {
  return AVAILABLE_PROVIDERS.find((provider) => provider.id === providerId);
}

/**
 * Get the default model for a provider
 */
export function getDefaultModelForProvider(provider: Provider): string {
  const providerConfig = getProviderById(provider);
  return providerConfig?.defaultModel || 'openai/gpt-4o';
}

