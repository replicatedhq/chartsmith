/**
 * Chartsmith Chat Hook
 *
 * Custom hook for chat functionality that integrates with the /api/chat endpoint.
 * This is a simplified implementation that works with Vercel AI SDK v5.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { workspaceAtom, messagesAtom } from "@/atoms/workspace";
import type { Message } from "@/components/types";

/**
 * Options for the Chartsmith chat hook
 */
export interface UseChartsmithChatOptions {
  /**
   * Authentication token for API requests
   */
  authToken?: string;

  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Callback when streaming completes
   */
  onFinish?: (response: string) => void;
}

/**
 * Return type for the Chartsmith chat hook
 */
export interface UseChartsmithChatReturn {
  /**
   * Send a message to the chat
   */
  sendMessage: (content: string) => Promise<void>;

  /**
   * Current messages in the conversation
   */
  messages: Message[];

  /**
   * Whether the chat is currently streaming a response
   */
  isLoading: boolean;

  /**
   * Current error, if any
   */
  error: Error | undefined;

  /**
   * Stop the current streaming response
   */
  stop: () => void;

  /**
   * The current input value (for controlled input)
   */
  input: string;

  /**
   * Set the input value
   */
  setInput: (value: string) => void;

  /**
   * Current streaming response text
   */
  streamingResponse: string;
}

/**
 * Custom hook for Chartsmith chat functionality
 *
 * This hook provides a simple interface to the /api/chat endpoint
 * with streaming support.
 */
export function useChartsmithChat(
  options: UseChartsmithChatOptions = {}
): UseChartsmithChatReturn {
  const { authToken, onError, onFinish } = options;
  const [workspace] = useAtom(workspaceAtom);
  const [existingMessages] = useAtom(messagesAtom);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [streamingResponse, setStreamingResponse] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Stop the current streaming response
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  /**
   * Send a message to the chat
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!workspace?.id) {
        console.error("No workspace ID available");
        return;
      }

      if (!content.trim()) {
        return;
      }

      setIsLoading(true);
      setError(undefined);
      setStreamingResponse("");

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({
            workspaceId: workspace.id,
            message: content.trim(),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          setStreamingResponse(fullResponse);
        }

        onFinish?.(fullResponse);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled, don't set error
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [workspace?.id, authToken, onError, onFinish]
  );

  return {
    sendMessage,
    messages: existingMessages,
    isLoading,
    error,
    stop,
    input,
    setInput,
    streamingResponse,
  };
}

/**
 * Feature flag check for using the new Vercel AI SDK chat
 */
export function useVercelAiSdkEnabled(): boolean {
  // Check feature flag from environment
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_USE_VERCEL_AI_SDK === "true";
  }
  return false;
}
