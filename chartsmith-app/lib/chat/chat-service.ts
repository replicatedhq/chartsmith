/**
 * Chat Service
 *
 * Main orchestrator for chat functionality.
 * Coordinates context building, message building, and provider streaming.
 * Uses dependency injection for testability.
 */

import type {
  ChatProvider,
  StreamResult,
  WorkspaceContext,
  HttpClient,
} from "./providers/types";
import { defaultHttpClient } from "./providers/types";
import { buildMessages, getSystemPrompt } from "./message-builder";
import { getToolSet } from "./tools";

/**
 * Dependencies for the chat service
 */
export interface ChatServiceDependencies {
  provider: ChatProvider;
  httpClient?: HttpClient;
  tools?: Record<string, unknown>;
}

/**
 * Parameters for streaming a response
 */
export interface StreamResponseParams {
  context: WorkspaceContext;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Chat Service class
 */
export class ChatService {
  private provider: ChatProvider;
  private httpClient: HttpClient;
  private tools: Record<string, unknown>;

  constructor(deps: ChatServiceDependencies) {
    this.provider = deps.provider;
    this.httpClient = deps.httpClient ?? defaultHttpClient;
    this.tools = deps.tools ?? getToolSet(this.httpClient);
  }

  /**
   * Stream a chat response
   *
   * @param params - Parameters including context and user message
   * @returns StreamResult from the AI SDK
   */
  async streamResponse(params: StreamResponseParams): Promise<StreamResult> {
    const { context, userMessage, maxTokens, temperature } = params;

    // Build messages from context
    const messages = buildMessages(context, {
      userMessage,
      includeSystemPrompt: true,
    });

    // Get system prompt
    const system = getSystemPrompt();

    // Stream from provider
    const result = await this.provider.streamChat({
      messages,
      tools: this.tools,
      maxTokens,
      temperature,
      system,
    });

    return result;
  }

  /**
   * Get the provider ID for logging/debugging
   */
  getProviderId(): string {
    return this.provider.providerId;
  }
}

/**
 * Factory function to create a chat service with dependencies
 *
 * @param deps - Service dependencies
 * @returns Configured ChatService instance
 */
export function createChatService(deps: ChatServiceDependencies): ChatService {
  return new ChatService(deps);
}

/**
 * Create a chat service with default configuration
 *
 * Uses environment variables for provider selection and API keys.
 */
export async function createDefaultChatService(): Promise<ChatService> {
  // Dynamic import to avoid circular dependencies
  const { getDefaultProvider } = await import("./providers");

  const provider = getDefaultProvider();
  const httpClient = defaultHttpClient;
  const tools = getToolSet(httpClient);

  return new ChatService({
    provider,
    httpClient,
    tools,
  });
}
