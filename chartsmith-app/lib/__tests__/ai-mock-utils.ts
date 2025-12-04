/**
 * AI SDK Mock Utilities for Testing
 * 
 * This module provides utilities for mocking Vercel AI SDK responses
 * in unit tests. Instead of making real API calls (slow, expensive, flaky),
 * we use these mocks for fast, deterministic tests.
 * 
 * Usage:
 *   import { createMockStreamResponse, createMockToolCall } from './ai-mock-utils';
 */

import { CoreMessage, CoreToolMessage } from 'ai';

/**
 * Creates a mock text response that simulates AI SDK streaming
 */
export function createMockTextResponse(text: string) {
  return {
    text,
    finishReason: 'stop' as const,
    usage: {
      promptTokens: 10,
      completionTokens: text.split(' ').length,
    },
  };
}

/**
 * Creates a mock tool call response
 */
export function createMockToolCall(
  toolName: string,
  args: Record<string, unknown>
) {
  return {
    type: 'tool-call' as const,
    toolCallId: `mock-tool-call-${Date.now()}`,
    toolName,
    args,
  };
}

/**
 * Creates a mock tool result
 */
export function createMockToolResult(
  toolCallId: string,
  toolName: string,
  result: unknown
) {
  return {
    type: 'tool-result' as const,
    toolCallId,
    toolName,
    result,
  };
}

/**
 * Mock responses for common Chartsmith tools
 */
export const chartsmithMockResponses = {
  // Mock response for viewing a file
  viewFile: (path: string, content: string) => createMockToolCall('view', { path }),
  
  // Mock response for string replacement
  strReplace: (path: string, oldStr: string, newStr: string) => 
    createMockToolCall('str_replace', { path, old_str: oldStr, new_str: newStr }),
  
  // Mock response for creating a file
  createFile: (path: string, content: string) =>
    createMockToolCall('create', { path, content }),
  
  // Mock response for a conversational message
  conversational: (message: string) => createMockTextResponse(message),
};

/**
 * Creates a mock conversation history
 */
export function createMockConversation(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): CoreMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Mock AI provider for testing
 * 
 * This can be used with AI SDK's testing patterns:
 * 
 * ```typescript
 * const mockModel = createMockAIModel({
 *   responses: [
 *     { type: 'text', content: 'Hello!' },
 *     { type: 'tool-call', tool: 'view', args: { path: 'values.yaml' } },
 *   ],
 * });
 * ```
 */
export interface MockAIModelConfig {
  responses: Array<
    | { type: 'text'; content: string }
    | { type: 'tool-call'; tool: string; args: Record<string, unknown> }
  >;
}

export function createMockAIModel(config: MockAIModelConfig) {
  let responseIndex = 0;
  
  return {
    doGenerate: async () => {
      const response = config.responses[responseIndex];
      responseIndex = (responseIndex + 1) % config.responses.length;
      
      if (response.type === 'text') {
        return {
          text: response.content,
          toolCalls: [],
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
        };
      } else {
        return {
          text: '',
          toolCalls: [createMockToolCall(response.tool, response.args)],
          finishReason: 'tool-calls' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
        };
      }
    },
    
    doStream: async function* () {
      const response = config.responses[responseIndex];
      responseIndex = (responseIndex + 1) % config.responses.length;
      
      if (response.type === 'text') {
        // Simulate streaming by yielding chunks
        const words = response.content.split(' ');
        for (const word of words) {
          yield { type: 'text-delta' as const, textDelta: word + ' ' };
        }
        yield { type: 'finish' as const, finishReason: 'stop' as const };
      } else {
        yield {
          type: 'tool-call' as const,
          toolCallId: `mock-${Date.now()}`,
          toolName: response.tool,
          args: response.args,
        };
        yield { type: 'finish' as const, finishReason: 'tool-calls' as const };
      }
    },
  };
}

/**
 * Test helper: Assert that a tool was called with specific arguments
 */
export function expectToolCall(
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>,
  expectedTool: string,
  expectedArgs?: Partial<Record<string, unknown>>
) {
  const call = toolCalls.find((tc) => tc.toolName === expectedTool);
  
  if (!call) {
    throw new Error(
      `Expected tool "${expectedTool}" to be called, but it wasn't. ` +
      `Called tools: ${toolCalls.map((tc) => tc.toolName).join(', ')}`
    );
  }
  
  if (expectedArgs) {
    for (const [key, value] of Object.entries(expectedArgs)) {
      if (call.args[key] !== value) {
        throw new Error(
          `Expected tool "${expectedTool}" arg "${key}" to be "${value}", ` +
          `but got "${call.args[key]}"`
        );
      }
    }
  }
  
  return call;
}

