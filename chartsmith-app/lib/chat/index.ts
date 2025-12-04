/**
 * Chat Module Exports
 *
 * Central export for all chat functionality.
 */

// Chat Service
export { ChatService, createChatService, createDefaultChatService } from "./chat-service";
export type { ChatServiceDependencies, StreamResponseParams } from "./chat-service";

// Context Builder
export {
  buildChatContext,
  estimateContextTokens,
} from "./context-builder";
export type {
  WorkspaceData,
  RelevantFile,
  PlanData,
  ChatMessageData,
  BuildContextParams,
} from "./context-builder";

// Message Builder
export {
  buildMessages,
  getSystemPrompt,
  buildIntentClassificationMessages,
  formatToolResult,
} from "./message-builder";
export type { BuildMessagesOptions } from "./message-builder";

// Prompts
export {
  CHAT_SYSTEM_PROMPT,
  INTENT_CLASSIFICATION_PROMPT,
  CHAT_INSTRUCTIONS,
  buildSystemPrompt,
} from "./prompts/system";

// Providers
export {
  createProvider,
  getDefaultProvider,
  createAnthropicProvider,
  createMockProvider,
  AnthropicProvider,
  MockProvider,
  defaultHttpClient,
} from "./providers";
export type {
  ProviderType,
  CreateProviderOptions,
  ChatProvider,
  ChatProviderConfig,
  StreamChatParams,
  StreamResult,
  HttpClient,
  WorkspaceContext,
  ChatMessage,
  MockResponse,
  MockCallRecord,
  MockProviderConfig,
} from "./providers";

// Tools
export {
  createConfiguredRegistry,
  getToolSet,
  defaultToolSet,
  ToolRegistry,
  createToolRegistry,
  kubernetesVersionTool,
  createSubchartVersionTool,
  executeKubernetesVersion,
  executeSubchartVersion,
} from "./tools";
export type {
  ToolDefinition,
  ToolFactory,
  ToolDependencies,
  KubernetesVersionInput,
  SubchartVersionInput,
} from "./tools";
