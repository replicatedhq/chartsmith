import { NextResponse } from 'next/server';
import { 
  getAvailableProviders, 
  VERIFIED_MODELS, 
  OPENROUTER_MODELS,
  ModelInfo 
} from '@/lib/llm/registry';

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    is_moderated: boolean;
    context_length: number;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  // OpenRouter doesn't have a direct "supports_tools" field
  // We infer from model capabilities and known models
}

/**
 * Check if an OpenRouter model likely supports tool calling
 * Based on model ID patterns and known capabilities
 */
function supportsTools(model: OpenRouterModel): boolean {
  const id = model.id.toLowerCase();
  
  // Known models with tool support
  const toolSupportedPrefixes = [
    'anthropic/claude-3',
    'anthropic/claude-2',
    'openai/gpt-4',
    'openai/gpt-3.5',
    'google/gemini',
    'meta-llama/llama-3',
    'mistralai/mistral',
    'cohere/command',
  ];
  
  return toolSupportedPrefixes.some(prefix => id.startsWith(prefix));
}

/**
 * Fetch available models from OpenRouter
 */
async function fetchOpenRouterModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      // Cache for 1 hour to avoid rate limits
      next: { revalidate: 3600 },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const models = data.data as OpenRouterModel[];
    
    // Filter models by capabilities
    return models
      .filter(model => {
        // Must have sufficient context window
        if (model.context_length < 16384) return false;
        
        // Must support tool calling
        if (!supportsTools(model)) return false;
        
        return true;
      })
      .map(model => ({
        id: model.id,
        name: model.name,
        provider: 'openrouter' as const,
        description: `Context: ${model.context_length.toLocaleString()} tokens`,
        contextWindow: model.context_length,
        supportsTools: true,
      }))
      // Sort by context window (descending) and then by name
      .sort((a, b) => {
        if (b.contextWindow !== a.contextWindow) {
          return b.contextWindow - a.contextWindow;
        }
        return a.name.localeCompare(b.name);
      })
      // Limit to top 50 models to avoid overwhelming UI
      .slice(0, 50);
  } catch (error) {
    return [];
  }
}

/**
 * GET /api/models
 * Returns available models based on configured API keys
 * 
 * Priority Logic:
 * - If OpenRouter is available, prefer OpenRouter models (they have built-in failover)
 * - Only show direct provider models if OpenRouter is NOT available
 */
export async function GET() {
  const providers = getAvailableProviders();
  const hasOpenRouter = providers.includes('openrouter');
  
  // Build recommended models list based on available providers
  const recommended: ModelInfo[] = [];
  
  if (hasOpenRouter) {
    // OpenRouter is available - only show OpenRouter models (no duplicates)
    for (const model of OPENROUTER_MODELS) {
      recommended.push(model);
    }
  } else {
    // No OpenRouter - show direct provider models
    for (const model of VERIFIED_MODELS) {
      if (providers.includes(model.provider)) {
        recommended.push(model);
      }
    }
  }
  
  // Fetch additional OpenRouter models if key is available
  let allModels: ModelInfo[] = [...recommended];
  
  if (hasOpenRouter) {
    const openRouterModels = await fetchOpenRouterModels();
    
    // Add OpenRouter models that aren't already in recommended list
    const recommendedIds = new Set(recommended.map(m => m.id));
    const additionalModels = openRouterModels.filter(m => !recommendedIds.has(m.id));
    
    allModels = [...recommended, ...additionalModels];
  }
  
  return NextResponse.json({
    providers,
    recommended,
    all: allModels,
  });
}