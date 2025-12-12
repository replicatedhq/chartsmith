import { createAnthropic } from '@ai-sdk/anthropic';

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Default model for chat
export const chatModel = anthropic('claude-sonnet-4-5-20250929');

// Model for intent classification (faster/cheaper)
export const intentModel = anthropic('claude-sonnet-4-5-20250929');
