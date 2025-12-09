/**
 * Abstraction layer for chat functionality.
 * 
 * This hook provides a consistent interface for chat operations,
 * allowing us to swap implementations without changing components.
 * Currently returns the legacy implementation; will be updated in
 * future PRs to use Vercel AI SDK's useChat hook.
 */

import { isAISDKChatEnabled } from '@/lib/config/feature-flags';

// TODO: Import actual chat types from existing implementation
// For now, using placeholder types
interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
}

interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  // TODO: Add more properties as needed (e.g., submit, reload, stop)
}

/**
 * Chat hook abstraction.
 * 
 * @returns Chat state and handlers
 */
export function useAIChat(): UseAIChatReturn {
  const isEnabled = isAISDKChatEnabled();
  
  if (isEnabled) {
    // TODO: Return useChat implementation (PR#6)
    throw new Error('AI SDK chat not yet implemented');
  }
  
  // Return legacy implementation
  // TODO: Import and return actual legacy hook/atoms
  // For now, return empty shell
  return {
    messages: [],
    isLoading: false,
    error: null,
  };
}

