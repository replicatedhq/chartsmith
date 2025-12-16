/**
 * Mock LLM provider for testing without API calls.
 * Uses Vercel AI SDK's MockLanguageModelV2 for realistic streaming behavior.
 */

import { MockLanguageModelV2, simulateReadableStream } from 'ai/test';
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';

/**
 * Create a mock model that returns predefined responses.
 * Useful for testing chat flows without making real API calls.
 *
 * @param responses - Array of responses to return in sequence
 * @returns A mock language model compatible with Vercel AI SDK
 */
export function createMockModel(responses: string[]) {
  let callIndex = 0;

  return new MockLanguageModelV2({
    doStream: async () => {
      const response = responses[callIndex++] || 'Mock response';
      const textId = `text-${Date.now()}`;

      const chunks: LanguageModelV2StreamPart[] = [
        { type: 'text-start', id: textId },
        { type: 'text-delta', id: textId, delta: response },
        { type: 'text-end', id: textId },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ];

      return {
        stream: simulateReadableStream({ chunks, chunkDelayInMs: 10 }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

/**
 * Check if mock responses should be used instead of real API calls.
 * Controlled by MOCK_LLM_RESPONSES environment variable.
 */
export function shouldUseMock(): boolean {
  return process.env.MOCK_LLM_RESPONSES === 'true';
}
