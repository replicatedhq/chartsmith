/**
 * Custom streaming chat hook for ChartSmith.
 * 
 * This hook replaces the AI SDK's `useChat` hook with a custom implementation
 * that provides better control over streaming, cancellation, and error handling.
 * 
 * ## Why Custom Instead of AI SDK's useChat
 * 
 * 1. **Stop Button Support**: Reliable request cancellation via AbortController
 * 2. **Streaming Format**: Direct control over SSE parsing for AI SDK format
 * 3. **Workspace Integration**: Seamless integration with Jotai atoms
 * 4. **Reduced Dependencies**: No need for @ai-sdk/react package
 * 5. **Error Handling**: Graceful handling of abort vs. network errors
 * 
 * ## Performance Optimizations
 * 
 * - **Token Batching**: Collects tokens for 16ms before rendering (60fps)
 * - **requestAnimationFrame**: Uses rAF for smooth UI updates
 * - **Performance Metrics**: Tracks time-to-first-token and render counts
 * 
 * ## Streaming Protocol
 * 
 * The backend uses AI SDK's `streamText` which outputs SSE in this format:
 * ```
 * 0:"Hello"        # Text chunk
 * 0:" world"       # Another text chunk
 * ```
 * 
 * ## Usage Example
 * 
 * ```tsx
 * const {
 *   messages,
 *   input,
 *   handleInputChange,
 *   handleSubmit,
 *   isLoading,
 *   error,
 *   stop,
 * } = useStreamingChat({
 *   api: '/api/chat',
 *   body: { workspaceId: 'abc123' },
 *   onError: (err) => console.error(err),
 *   onFinish: (msg) => console.log('Complete:', msg),
 * });
 * ```
 * 
 * @module hooks/useStreamingChat
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Performance Constants
// ============================================================================

/** Batch interval for token updates (16ms = 60fps) */
const TOKEN_BATCH_INTERVAL_MS = 16;

/** Enable performance logging in development */
const ENABLE_PERF_LOGGING = process.env.NODE_ENV === 'development';

/**
 * Message status for optimistic UI updates
 */
export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error';

/**
 * Represents a single chat message in the conversation.
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Role of the message sender */
  role: 'user' | 'assistant';
  /** Text content of the message */
  content: string;
  /** Timestamp when the message was created */
  createdAt: Date;
  /** Current status of the message for UI feedback */
  status?: MessageStatus;
  /** Whether this is a new message (for animation purposes) */
  isNew?: boolean;
}

/**
 * Configuration options for the useStreamingChat hook.
 */
export interface UseStreamingChatOptions {
  /** API endpoint URL for chat requests */
  api: string;
  /** Additional body parameters to include in each request */
  body?: Record<string, any>;
  /** Callback fired when an error occurs */
  onError?: (error: Error) => void;
  /** Callback fired when a response completes successfully */
  onFinish?: (message: ChatMessage) => void;
}

/**
 * Custom React hook for streaming chat with AI.
 * 
 * Provides state management for chat messages, input handling,
 * streaming response parsing, and request cancellation.
 * 
 * @param options - Configuration options for the hook
 * @returns Object containing chat state and control functions
 * 
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { messages, input, handleSubmit, isLoading, stop } = useStreamingChat({
 *     api: '/api/chat',
 *   });
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={input} onChange={handleInputChange} />
 *       {isLoading && <button onClick={stop}>Stop</button>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useStreamingChat(options: UseStreamingChatOptions) {
  const { api, body: extraBody, onError, onFinish } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Ref to store the current AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ref to track the current assistant message ID for cleanup
  const currentAssistantIdRef = useRef<string | null>(null);
  
  // Performance tracking refs
  const requestStartTimeRef = useRef<number>(0);
  const firstTokenReceivedRef = useRef<boolean>(false);
  const renderCountRef = useRef<number>(0);
  
  // Token batching refs for smoother streaming
  const pendingTokensRef = useRef<string>('');
  const batchTimeoutRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Cleanup on unmount - abort any in-progress requests
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clean up any pending animation frames or timeouts
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle input field changes.
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  /**
   * Stop the current streaming request.
   * Aborts the fetch request and keeps any partial response received.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  /**
   * Flush pending tokens to the UI using requestAnimationFrame for smooth updates.
   * This batches rapid token updates to reduce re-renders and improve performance.
   */
  const flushPendingTokens = useCallback((
    assistantMessageId: string, 
    accumulatedContent: string
  ) => {
    // Cancel any pending timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    
    // Use requestAnimationFrame for smooth UI updates
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      renderCountRef.current++;
      
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: accumulatedContent }
            : msg
        )
      );
      
      rafIdRef.current = null;
    });
  }, []);

  /**
   * Send a message to the AI and stream the response.
   * 
   * Performance optimizations:
   * - Batches token updates every 16ms (60fps) to reduce re-renders
   * - Uses requestAnimationFrame for smooth UI updates
   * - Tracks time-to-first-token and render count metrics
   * 
   * @param messageText - Optional message text (uses input state if not provided)
   */
  const sendMessage = useCallback(async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Reset performance tracking
    requestStartTimeRef.current = performance.now();
    firstTokenReceivedRef.current = false;
    renderCountRef.current = 0;
    pendingTokensRef.current = '';

    // Clear input immediately for better UX
    setInput('');
    setError(null);
    setIsLoading(true);

    // Add user message to the conversation with 'sending' status for optimistic UI
    const userMessageId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: textToSend,
      createdAt: new Date(),
      status: 'sending',
      isNew: true,
    };

    setMessages(prev => [...prev, userMessage]);

    // Create placeholder assistant message that will be updated as we stream
    const assistantMessageId = `assistant-${Date.now()}`;
    currentAssistantIdRef.current = assistantMessageId;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
      status: 'streaming',
      isNew: true,
    };

    // Brief delay before showing assistant placeholder for smoother UX
    setTimeout(() => {
      setMessages(prev => {
        // Update user message status to complete and add assistant message
        return prev.map(msg => 
          msg.id === userMessageId 
            ? { ...msg, status: 'complete' as MessageStatus, isNew: false }
            : msg
        ).concat([assistantMessage]);
      });
    }, 150);

    try {
      // Build the full message history for the API
      const allMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Make the streaming request
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: allMessages,
          ...extraBody,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Read and parse the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let lastFlushTime = performance.now();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });

          // Parse Server-Sent Events format from AI SDK
          // Format: 0:"text content"
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:')) {
              // Text chunk from AI SDK streaming format
              // Remove the '0:' prefix and surrounding quotes
              const text = line.substring(3).replace(/^"|"$/g, '');
              if (text) {
                // Track time to first token
                if (!firstTokenReceivedRef.current) {
                  firstTokenReceivedRef.current = true;
                  const timeToFirstToken = performance.now() - requestStartTimeRef.current;
                  if (ENABLE_PERF_LOGGING) {
                    console.log(`[useStreamingChat] Time to first token: ${timeToFirstToken.toFixed(2)}ms`);
                  }
                }
                
                accumulatedContent += text;
                pendingTokensRef.current = accumulatedContent;
                
                // Batch updates: only flush if enough time has passed (16ms = 60fps)
                const now = performance.now();
                if (now - lastFlushTime >= TOKEN_BATCH_INTERVAL_MS) {
                  flushPendingTokens(assistantMessageId, accumulatedContent);
                  lastFlushTime = now;
                } else if (!batchTimeoutRef.current) {
                  // Schedule a flush for the remaining time
                  const remainingTime = TOKEN_BATCH_INTERVAL_MS - (now - lastFlushTime);
                  batchTimeoutRef.current = window.setTimeout(() => {
                    flushPendingTokens(assistantMessageId, pendingTokensRef.current);
                    lastFlushTime = performance.now();
                    batchTimeoutRef.current = null;
                  }, remainingTime);
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Final flush to ensure all content is displayed
      if (pendingTokensRef.current) {
        flushPendingTokens(assistantMessageId, accumulatedContent);
      }

      // Log performance metrics
      if (ENABLE_PERF_LOGGING) {
        const totalTime = performance.now() - requestStartTimeRef.current;
        console.log(`[useStreamingChat] Streaming complete:`, {
          totalTime: `${totalTime.toFixed(2)}ms`,
          renderCount: renderCountRef.current,
          contentLength: accumulatedContent.length,
          avgTokensPerRender: Math.round(accumulatedContent.length / Math.max(1, renderCountRef.current)),
        });
      }

      // Update message status to complete
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, status: 'complete' as MessageStatus, isNew: false }
            : msg
        )
      );

      setIsLoading(false);
      abortControllerRef.current = null;
      currentAssistantIdRef.current = null;

      // Call onFinish callback with the completed message
      if (onFinish && accumulatedContent) {
        onFinish({
          id: assistantMessageId,
          role: 'assistant',
          content: accumulatedContent,
          createdAt: new Date(),
          status: 'complete',
        });
      }
    } catch (err) {
      // Clean up any pending batched updates
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      
      // Handle abort errors gracefully - user clicked stop
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled - keep the partial message if there's content
        // First flush any pending tokens
        if (pendingTokensRef.current) {
          flushPendingTokens(assistantMessageId, pendingTokensRef.current);
        }
        
        setMessages(prev => {
          const assistantMsg = prev.find(msg => msg.id === assistantMessageId);
          if (assistantMsg && !assistantMsg.content) {
            // Remove empty assistant message
            return prev.filter(msg => msg.id !== assistantMessageId);
          }
          return prev;
        });
        setIsLoading(false);
        abortControllerRef.current = null;
        currentAssistantIdRef.current = null;
        return;
      }

      // Handle other errors
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      setError(error);
      setIsLoading(false);
      abortControllerRef.current = null;
      currentAssistantIdRef.current = null;

      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));

      if (onError) {
        onError(error);
      }
    }
  }, [input, messages, isLoading, api, extraBody, onError, onFinish, flushPendingTokens]);

  /**
   * Handle form submission.
   * Prevents default form behavior and sends the current input.
   */
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  }, [sendMessage]);

  /**
   * Clear all messages from the conversation.
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    /** Array of chat messages in the conversation */
    messages,
    /** Current input field value */
    input,
    /** Handler for input field changes */
    handleInputChange,
    /** Handler for form submission */
    handleSubmit,
    /** Whether a request is currently in progress */
    isLoading,
    /** Current error, if any */
    error,
    /** Function to set input value directly */
    setInput,
    /** Function to stop the current streaming request */
    stop,
    /** Function to clear all messages */
    clearMessages,
  };
}
