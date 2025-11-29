export interface LLMConfig {
  model: string; // Automatically selected based on API keys
}

export function getLLMConfig(): LLMConfig {
  return {
    model: process.env.CHARTSMITH_LLM_MODEL || getDefaultModel(),
  };
}

// Automatically detect best model based on available API keys
// No configuration needed - just works!
function getDefaultModel(): string {
  // OpenRouter: Use latest Claude 3.5
  if (process.env.OPENROUTER_API_KEY) {
    return 'anthropic/claude-3.5-sonnet';
  }
  
  // Anthropic Direct: Use Claude Sonnet 4 (verified to exist in API)
  if (process.env.ANTHROPIC_API_KEY) {
    return 'claude-sonnet-4-20250514';
  }
  
  // OpenAI: Use GPT-4o
  if (process.env.OPENAI_API_KEY) {
    return 'gpt-4o';
  }
  
  // Google: Use Gemini 2.0 Flash
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return 'gemini-2.0-flash-exp';
  }
  
  // Fallback to Claude Sonnet 4 (will fail if no key, but clear error)
  return 'claude-sonnet-4-20250514';
}

// Helper to get the configured model
export function getModel(): string {
  return getLLMConfig().model;
}