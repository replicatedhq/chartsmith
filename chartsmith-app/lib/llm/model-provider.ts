/**
 * Model provider for LLM interactions.
 * Centralizes model selection and supports mock mode for testing.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';
import { createMockModel, shouldUseMock } from './mock-provider';

/**
 * Default mock response for chat interactions.
 */
const DEFAULT_CHAT_MOCK_RESPONSE = `I'm a mock response for testing the chat API.

This response simulates what you'd get from the real LLM, but without making any API calls.
Set MOCK_LLM_RESPONSES=false to use the real Anthropic API.`;

/**
 * Default mock response for intent classification.
 * Returns a conversational intent by default.
 */
const DEFAULT_INTENT_MOCK_RESPONSE = JSON.stringify({
  isConversational: true,
  isPlan: false,
  isOffTopic: false,
  isChartDeveloper: false,
  isChartOperator: false,
  isProceed: false,
  isRender: false,
});

/**
 * Get the model to use for chat interactions.
 * Returns a mock model if MOCK_LLM_RESPONSES is true, otherwise returns the real Anthropic model.
 */
export function getChatModel() {
  if (shouldUseMock()) {
    return createMockModel([DEFAULT_CHAT_MOCK_RESPONSE]);
  }
  return anthropic('claude-sonnet-4-20250514');
}

/**
 * Get the model to use for intent classification.
 * Uses Groq (Llama) for fast, cheap classification.
 * Returns a mock model if MOCK_LLM_RESPONSES is true.
 */
export function getIntentModel() {
  if (shouldUseMock()) {
    return createMockModel([DEFAULT_INTENT_MOCK_RESPONSE]);
  }
  return groq('llama-3.3-70b-versatile');
}
