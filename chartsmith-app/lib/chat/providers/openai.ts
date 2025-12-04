/**
 * OpenAI Provider Implementation
 *
 * Uses the Vercel AI SDK's OpenAI provider for chat completions.
 * API key is injected via constructor for testability.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { streamText, generateText } from "ai";
import type {
  ChatProvider,
  ChatProviderConfig,
  StreamChatParams,
  StreamResult,
} from "./types";

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_MAX_TOKENS = 8192;

export class OpenAIProvider implements ChatProvider {
  readonly providerId = "openai";
  private client: ReturnType<typeof createOpenAI>;
  private model: string;

  constructor(config: ChatProviderConfig) {
    if (!config.apiKey) {
      throw new Error("OpenAI API key is required");
    }

    this.client = createOpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async streamChat(params: StreamChatParams): Promise<StreamResult> {
    // streamText returns a StreamTextResult synchronously (not a Promise)
    // The result object has methods like toDataStreamResponse() that can be called directly
    const result = streamText({
      model: this.client(this.model),
      messages: params.messages,
      tools: params.tools as Parameters<typeof streamText>[0]["tools"],
      maxOutputTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: params.temperature,
      system: params.system,
    });

    // Return the result directly - it already has toDataStreamResponse method
    return result as unknown as StreamResult;
  }

  async generateText(params: StreamChatParams): Promise<{ text: string }> {
    const result = await generateText({
      model: this.client(this.model),
      messages: params.messages,
      maxOutputTokens: params.maxTokens ?? 1024,
      temperature: params.temperature,
      system: params.system,
    });

    return { text: result.text };
  }
}

/**
 * Factory function for creating OpenAI provider
 */
export function createOpenAIProvider(
  config: ChatProviderConfig
): ChatProvider {
  return new OpenAIProvider(config);
}
