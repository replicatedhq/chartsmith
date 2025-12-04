/**
 * Provider Factory and Exports
 *
 * Central module for creating and accessing chat providers.
 * Supports Anthropic, OpenAI (future), and Mock providers.
 */

import type { ChatProvider, ChatProviderConfig } from "./types";
import { AnthropicProvider, createAnthropicProvider } from "./anthropic";
import { OpenAIProvider, createOpenAIProvider } from "./openai";
import { MockProvider, createMockProvider } from "./mock";

export type ProviderType = "anthropic" | "openai" | "mock";

export interface CreateProviderOptions extends ChatProviderConfig {
  type: ProviderType;
}

/**
 * Create a chat provider based on type and configuration
 *
 * @param options - Provider type and configuration
 * @returns Configured chat provider instance
 * @throws Error if provider type is unknown or configuration is invalid
 */
export function createProvider(options: CreateProviderOptions): ChatProvider {
  const { type, ...config } = options;

  switch (type) {
    case "anthropic":
      return createAnthropicProvider(config);

    case "openai":
      return createOpenAIProvider(config);

    case "mock":
      return createMockProvider();

    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Get the default provider based on environment configuration
 *
 * Uses CHAT_PROVIDER env var, defaults to "anthropic"
 */
export function getDefaultProvider(): ChatProvider {
  const providerType = (process.env.CHAT_PROVIDER ?? "anthropic") as ProviderType;
  const apiKey = getApiKeyForProvider(providerType);

  return createProvider({
    type: providerType,
    apiKey,
  });
}

/**
 * Get the API key for a specific provider from environment variables
 */
function getApiKeyForProvider(type: ProviderType): string {
  switch (type) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? "";

    case "openai":
      return process.env.OPENAI_API_KEY ?? "";

    case "mock":
      return "mock-api-key";

    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

// Re-export types and classes for direct access
export type {
  ChatProvider,
  ChatProviderConfig,
  StreamChatParams,
  StreamResult,
  HttpClient,
  ChatServiceDeps,
  WorkspaceContext,
  ChatMessage,
} from "./types";

export { defaultHttpClient } from "./types";
export { AnthropicProvider, createAnthropicProvider } from "./anthropic";
export { OpenAIProvider, createOpenAIProvider } from "./openai";
export { MockProvider, createMockProvider } from "./mock";
export type { MockResponse, MockCallRecord, MockProviderConfig } from "./mock";
