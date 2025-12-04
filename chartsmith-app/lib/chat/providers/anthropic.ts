/**
 * Anthropic Provider Implementation
 *
 * Uses the Vercel AI SDK's Anthropic provider for chat completions.
 * API key is injected via constructor for testability.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, generateText } from "ai";
import type {
  ChatProvider,
  ChatProviderConfig,
  StreamChatParams,
  StreamResult,
} from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 8192;

export class AnthropicProvider implements ChatProvider {
  readonly providerId = "anthropic";
  private client: ReturnType<typeof createAnthropic>;
  private model: string;

  constructor(config: ChatProviderConfig) {
    if (!config.apiKey) {
      throw new Error("Anthropic API key is required");
    }

    this.client = createAnthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async streamChat(params: StreamChatParams): Promise<StreamResult> {
    const result = streamText({
      model: this.client(this.model),
      messages: params.messages,
      tools: params.tools as Parameters<typeof streamText>[0]["tools"],
      maxOutputTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: params.temperature,
      system: params.system,
    });

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
 * Factory function for creating Anthropic provider
 */
export function createAnthropicProvider(
  config: ChatProviderConfig
): ChatProvider {
  return new AnthropicProvider(config);
}
