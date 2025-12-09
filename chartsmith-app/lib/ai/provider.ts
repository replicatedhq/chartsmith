import { createAnthropic } from '@ai-sdk/anthropic';

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Default model for chat
export const chatModel = anthropic('claude-sonnet-4-20250514');

// Model for intent classification (faster/cheaper)
export const intentModel = anthropic('claude-3-5-sonnet-20241022');
