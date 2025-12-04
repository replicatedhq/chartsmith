/**
 * Chat Components Module
 * 
 * This module exports the AI SDK-based chat components.
 * These components form the NEW parallel chat system (PR1).
 * 
 * The existing Go-based chat system (ChatContainer, ChatMessage, etc.)
 * remains unchanged and continues to work for workspace operations.
 */

export { AIChat } from './AIChat';
export type { AIChatProps } from './AIChat';

export { AIMessageList } from './AIMessageList';
export type { AIMessageListProps } from './AIMessageList';

export { ProviderSelector } from './ProviderSelector';
export type { ProviderSelectorProps } from './ProviderSelector';

