/**
 * Chat Provider Abstraction Layer
 *
 * This module defines the core interfaces for the chat provider system,
 * enabling dependency injection and easy provider switching.
 */

import type { CoreMessage, LanguageModelUsage } from "ai";

/**
 * Configuration for a chat provider
 */
export interface ChatProviderConfig {
  apiKey: string;
  model?: string;
}

/**
 * Parameters for streaming a chat response
 */
export interface StreamChatParams {
  messages: CoreMessage[];
  tools?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

/**
 * Result from a chat stream operation
 */
export interface StreamResult {
  textStream: ReadableStream<string>;
  text: Promise<string>;
  usage: Promise<LanguageModelUsage>;
  toDataStreamResponse: () => Response;
  toTextStreamResponse: () => Response;
}

/**
 * Core interface that all chat providers must implement
 */
export interface ChatProvider {
  /**
   * Stream a chat response from the provider
   */
  streamChat(params: StreamChatParams): Promise<StreamResult>;

  /**
   * Generate a non-streaming response (for simple operations like intent classification)
   */
  generateText(params: StreamChatParams): Promise<{ text: string }>;

  /**
   * Provider identifier
   */
  readonly providerId: string;
}

/**
 * HTTP client interface for tool implementations
 * Allows dependency injection for testing
 */
export interface HttpClient {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, body: unknown): Promise<T>;
}

/**
 * Default HTTP client implementation using fetch
 */
export const defaultHttpClient: HttpClient = {
  async get<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  },
  async post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  },
};

/**
 * Dependencies that can be injected into the chat service
 */
export interface ChatServiceDeps {
  provider: ChatProvider;
  httpClient?: HttpClient;
}

/**
 * Workspace context passed to chat service
 */
export interface WorkspaceContext {
  workspaceId: string;
  chartStructure: string;
  relevantFiles: Array<{
    filePath: string;
    content: string;
  }>;
  recentPlan?: {
    id: string;
    description: string;
  };
  previousMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

/**
 * Chat message from database
 */
export interface ChatMessage {
  id: string;
  workspaceId: string;
  prompt: string;
  response?: string;
}
