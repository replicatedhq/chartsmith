/**
 * Custom hook for Chartsmith chat functionality.
 * 
 * Wraps the Vercel AI SDK's useChat hook with Chartsmith-specific
 * configuration and integration with Jotai state management.
 * 
 * This hook handles:
 * - Streaming chat messages via AI SDK
 * - Workspace context injection
 * - Role-based system prompts (auto/developer/operator)
 * - Message persistence after streaming completes
 * 
 * Note: Plans, renders, and other complex workflows continue to use
 * the existing Centrifugo-based approach through the Go backend.
 */

'use client';

import { useChat, UseChatOptions } from '@ai-sdk/react';
import { useAtom } from 'jotai';
import { useCallback, useMemo } from 'react';

import { workspaceAtom } from '@/atoms/workspace';
import { ChatRole, ChartContext } from '@/lib/llm/system-prompts';

export interface UseChartsmithChatOptions {
  /**
   * The role/perspective for the chat (auto, developer, operator).
   * Affects the system prompt used by the LLM.
   */
  role?: ChatRole;
  
  /**
   * Callback fired when the AI finishes responding.
   */
  onFinish?: UseChatOptions['onFinish'];
  
  /**
   * Callback fired when an error occurs.
   */
  onError?: UseChatOptions['onError'];
}

export interface UseChartsmithChatReturn {
  /**
   * The current chat messages.
   */
  messages: ReturnType<typeof useChat>['messages'];
  
  /**
   * The current input value.
   */
  input: string;
  
  /**
   * Set the input value.
   */
  setInput: (input: string) => void;
  
  /**
   * Handle input change events.
   */
  handleInputChange: ReturnType<typeof useChat>['handleInputChange'];
  
  /**
   * Handle form submission.
   */
  handleSubmit: ReturnType<typeof useChat>['handleSubmit'];
  
  /**
   * Whether the chat is currently loading/streaming.
   */
  isLoading: boolean;
  
  /**
   * Any error that occurred.
   */
  error: Error | undefined;
  
  /**
   * Stop the current generation.
   */
  stop: ReturnType<typeof useChat>['stop'];
  
  /**
   * Reload the last message.
   */
  reload: ReturnType<typeof useChat>['reload'];
  
  /**
   * Append a message to the chat.
   */
  append: ReturnType<typeof useChat>['append'];
  
  /**
   * Set the messages directly.
   */
  setMessages: ReturnType<typeof useChat>['setMessages'];
}

/**
 * Hook for managing Chartsmith chat with AI SDK streaming.
 * 
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const {
 *     messages,
 *     input,
 *     handleInputChange,
 *     handleSubmit,
 *     isLoading,
 *   } = useChartsmithChat({ role: 'developer' });
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {messages.map(m => (
 *         <div key={m.id}>{m.content}</div>
 *       ))}
 *       <input value={input} onChange={handleInputChange} />
 *       <button type="submit" disabled={isLoading}>Send</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useChartsmithChat(
  options: UseChartsmithChatOptions = {}
): UseChartsmithChatReturn {
  const { role = 'auto', onFinish, onError } = options;
  
  const [workspace] = useAtom(workspaceAtom);
  
  // Build chart context from the current workspace
  const chartContext: ChartContext | undefined = useMemo(() => {
    if (!workspace?.charts?.length) {
      return undefined;
    }
    
    const chart = workspace.charts[0];
    
    return {
      structure: chart.files?.map(f => `File: ${f.filePath}`).join('\n') || '',
      relevantFiles: chart.files?.slice(0, 10).map(f => ({
        filePath: f.filePath,
        content: f.content || '',
      })),
    };
  }, [workspace]);
  
  // Configure useChat with Chartsmith-specific settings
  const chat = useChat({
    api: '/api/chat',
    body: {
      workspaceId: workspace?.id,
      role,
      chartContext,
    },
    onFinish,
    onError: useCallback((error: Error) => {
      console.error('Chartsmith chat error:', error);
      onError?.(error);
    }, [onError]),
  });
  
  return {
    messages: chat.messages,
    input: chat.input,
    setInput: chat.setInput,
    handleInputChange: chat.handleInputChange,
    handleSubmit: chat.handleSubmit,
    isLoading: chat.isLoading,
    error: chat.error,
    stop: chat.stop,
    reload: chat.reload,
    append: chat.append,
    setMessages: chat.setMessages,
  };
}

