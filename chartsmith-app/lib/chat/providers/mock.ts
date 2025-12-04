/**
 * Mock Provider Implementation
 *
 * A configurable mock provider for unit testing without API calls.
 * Supports simulated streaming, tool calls, and call history tracking.
 */

import type {
  ChatProvider,
  StreamChatParams,
  StreamResult,
} from "./types";
import type { CoreMessage, ToolSet } from "ai";

/**
 * Configuration for mock responses
 */
export interface MockResponse {
  text: string;
  delayMs?: number;
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, unknown>;
  }>;
}

/**
 * Recorded call for assertion purposes
 */
export interface MockCallRecord {
  method: "streamChat" | "generateText";
  params: StreamChatParams;
  timestamp: Date;
}

/**
 * Configuration for the mock provider
 */
export interface MockProviderConfig {
  defaultResponse?: MockResponse;
  responses?: MockResponse[];
}

export class MockProvider implements ChatProvider {
  readonly providerId = "mock";
  private responses: MockResponse[];
  private responseIndex = 0;
  private defaultResponse: MockResponse;
  private _callHistory: MockCallRecord[] = [];

  constructor(config: MockProviderConfig = {}) {
    this.defaultResponse = config.defaultResponse ?? {
      text: "Mock response",
      delayMs: 0,
    };
    this.responses = config.responses ?? [];
  }

  /**
   * Get the history of all calls made to this provider
   */
  get callHistory(): ReadonlyArray<MockCallRecord> {
    return this._callHistory;
  }

  /**
   * Clear the call history
   */
  clearHistory(): void {
    this._callHistory = [];
    this.responseIndex = 0;
  }

  /**
   * Add a response to the queue
   */
  addResponse(response: MockResponse): void {
    this.responses.push(response);
  }

  /**
   * Set the default response
   */
  setDefaultResponse(response: MockResponse): void {
    this.defaultResponse = response;
  }

  private getNextResponse(): MockResponse {
    if (this.responseIndex < this.responses.length) {
      return this.responses[this.responseIndex++];
    }
    return this.defaultResponse;
  }

  async streamChat(params: StreamChatParams): Promise<StreamResult> {
    this._callHistory.push({
      method: "streamChat",
      params,
      timestamp: new Date(),
    });

    const response = this.getNextResponse();

    // Create a mock stream result that mimics the Vercel AI SDK structure
    const mockResult = createMockStreamResult(response);
    return mockResult;
  }

  async generateText(params: StreamChatParams): Promise<{ text: string }> {
    this._callHistory.push({
      method: "generateText",
      params,
      timestamp: new Date(),
    });

    const response = this.getNextResponse();

    if (response.delayMs) {
      await delay(response.delayMs);
    }

    return { text: response.text };
  }
}

/**
 * Create a mock stream result that matches Vercel AI SDK's StreamTextResult
 */
function createMockStreamResult(response: MockResponse): StreamResult {
  const textEncoder = new TextEncoder();
  let streamedText = "";

  // Create a readable stream that emits the response text
  const textStream = new ReadableStream<string>({
    async start(controller) {
      if (response.delayMs) {
        await delay(response.delayMs);
      }

      // Simulate streaming by emitting chunks
      const chunks = response.text.split(" ");
      for (const chunk of chunks) {
        const text = chunk + " ";
        streamedText += text;
        controller.enqueue(text);
        await delay(10); // Small delay between chunks
      }
      controller.close();
    },
  });

  // Create the full stream (data stream format)
  const fullStream = new ReadableStream({
    async start(controller) {
      if (response.delayMs) {
        await delay(response.delayMs);
      }

      controller.enqueue({
        type: "text-delta",
        textDelta: response.text,
      });

      if (response.toolCalls) {
        for (const toolCall of response.toolCalls) {
          controller.enqueue({
            type: "tool-call",
            toolCallId: `mock-${Date.now()}`,
            toolName: toolCall.toolName,
            args: toolCall.args,
          });
        }
      }

      controller.enqueue({
        type: "finish",
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50 },
      });

      controller.close();
    },
  });

  // Return a mock StreamResult object
  // This is a simplified version - the real SDK has more properties
  return {
    textStream,
    fullStream,
    text: Promise.resolve(response.text),
    toolCalls: Promise.resolve(response.toolCalls ?? []),
    toolResults: Promise.resolve([]),
    finishReason: Promise.resolve("stop" as const),
    usage: Promise.resolve({ promptTokens: 100, completionTokens: 50 }),
    response: Promise.resolve({
      id: `mock-${Date.now()}`,
      timestamp: new Date(),
      modelId: "mock-model",
      headers: {},
    }),
    toDataStreamResponse: () => {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(textEncoder.encode(`0:${JSON.stringify(response.text)}\n`));
            controller.close();
          },
        }),
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    },
    toTextStreamResponse: () => {
      return new Response(textStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    },
    pipeDataStreamToResponse: () => {},
    pipeTextStreamToResponse: () => {},
    consumeStream: async () => {},
  } as unknown as StreamResult;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Factory function for creating mock provider
 */
export function createMockProvider(config?: MockProviderConfig): MockProvider {
  return new MockProvider(config);
}
