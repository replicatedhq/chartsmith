export interface LLMConfig {
  model: string;
}

export function getLLMConfig(): LLMConfig {
  return {
    model: process.env.CHARTSMITH_LLM_MODEL || getDefaultModel(),
  };
}

function getDefaultModel(): string {
  if (process.env.OPENROUTER_API_KEY) {
    return 'anthropic/claude-3.5-sonnet';
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return 'claude-sonnet-4-20250514';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'gpt-4o';
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return 'gemini-2.0-flash-exp';
  }
  return 'claude-sonnet-4-20250514';
}

export function getModel(): string {
  return getLLMConfig().model;
}