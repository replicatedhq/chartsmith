'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for AI chat using the Vercel AI SDK streaming endpoint.
 *
 * This parses the data stream protocol from toDataStreamResponse()
 * which includes tool calls and multi-step responses.
 *
 * Usage:
 * ```tsx
 * const { messages, sendMessage, isLoading, error } = useAIChat({
 *   workspaceId: 'workspace-123',
 *   context: 'Chart structure: ...',
 * });
 * ```
 */

export interface UseAIChatOptions {
  /** Workspace ID for context */
  workspaceId?: string;
  /** Additional context to send with messages (e.g., chart structure, files) */
  context?: string;
  /** Callback when a message is finished */
  onFinish?: (message: ChatMessage) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface UseAIChatReturn {
  /** All messages in the conversation */
  messages: ChatMessage[];
  /** Send a new message */
  sendMessage: (content: string) => Promise<void>;
  /** Whether the chat is currently loading/streaming */
  isLoading: boolean;
  /** Current status of the chat */
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  /** Any error that occurred */
  error: Error | undefined;
  /** Stop the current generation */
  stop: () => void;
  /** Set messages programmatically */
  setMessages: (messages: ChatMessage[]) => void;
  /** Clear all messages */
  clearMessages: () => void;
  /** Input value (for controlled input) */
  input: string;
  /** Set input value */
  setInput: (value: string) => void;
  /** Handle input change */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Handle form submit */
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}


export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { context, onFinish, onError } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready');
  const [error, setError] = useState<Error | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setStatus('submitted');
      setError(undefined);
      setInput('');

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            context,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        setStatus('streaming');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          // Update the assistant message with accumulated content
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedContent;
            }
            return newMessages;
          });
        }

        // Final update
        const finalMessage: ChatMessage = {
          ...assistantMessage,
          content: accumulatedContent,
        };

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = accumulatedContent;
          }
          return newMessages;
        });

        setStatus('ready');
        onFinish?.(finalMessage);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, don't treat as error
          setStatus('ready');
          return;
        }

        const errorInstance = err instanceof Error ? err : new Error('Unknown error');
        setError(errorInstance);
        setStatus('error');
        onError?.(errorInstance);

        // Remove the empty assistant message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages, context, isLoading, onFinish, onError]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setStatus('ready');
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(undefined);
    setStatus('ready');
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (input.trim()) {
        sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  return {
    messages,
    sendMessage,
    isLoading,
    status,
    error,
    stop,
    setMessages,
    clearMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
  };
}

/**
 * Helper to extract text content from a message
 */
export function getTextContent(message: ChatMessage): string {
  return message.content;
}
