/**
 * Chartsmith Chat Hook
 *
 * Wrapper around Vercel AI SDK's useChat hook with Chartsmith-specific configuration.
 * Provides workspace integration and maps to the existing Message format.
 */

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAtom } from "jotai";
import { useMemo, useState } from "react";
import { workspaceAtom } from "@/atoms/workspace";
import type { Message } from "@/components/types";

/**
 * Options for the Chartsmith chat hook
 */
export interface UseChartsmithChatOptions {
  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Callback when streaming completes
   */
  onFinish?: () => void;
}

/**
 * Return type for the Chartsmith chat hook
 */
export interface UseChartsmithChatReturn {
  /**
   * Send a message to the chat
   */
  sendMessage: (content: string) => void;

  /**
   * Current messages in Chartsmith format
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
   * Raw AI SDK messages (for advanced use cases)
   */
  rawMessages: ReturnType<typeof useChat>["messages"];
}

/**
 * Extract text content from AI SDK message parts
 */
function getTextFromParts(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

/**
 * Check if an assistant message has any content (text or tool calls)
 */
function hasAssistantContent(msg: { parts: Array<{ type: string }> }): boolean {
  return msg.parts.some(
    (part) => part.type === "text" || part.type === "tool-invocation"
  );
}

/**
 * Convert AI SDK messages to Chartsmith Message format
 */
function convertToChartsmithMessages(
  aiMessages: ReturnType<typeof useChat>["messages"],
  isStreamingComplete: boolean
): Message[] {
  const result: Message[] = [];

  for (let i = 0; i < aiMessages.length; i++) {
    const msg = aiMessages[i];

    if (msg.role === "user") {
      // Get user message text
      const userText = getTextFromParts(msg.parts);

      // Look for the next assistant message as the response
      const nextMsg = aiMessages[i + 1];
      const hasAssistantResponse = nextMsg?.role === "assistant";
      const responseText = hasAssistantResponse
        ? getTextFromParts(nextMsg.parts)
        : undefined;

      // Determine if this message exchange is complete:
      // 1. If there's a following user message, this exchange is definitely complete
      // 2. If this is the last exchange, check streaming status
      const followingUserMsg = aiMessages.slice(i + 2).find((m) => m.role === "user");
      const isLastExchange = !followingUserMsg;

      const isComplete = hasAssistantResponse && (
        // Has text content
        (responseText !== undefined && responseText !== "") ||
        // Has tool invocations (AI used tools)
        hasAssistantContent(nextMsg) ||
        // Is a past exchange (not the current streaming one)
        !isLastExchange ||
        // Is the last exchange and streaming is done
        (isLastExchange && isStreamingComplete)
      );

      // Build response text - use actual text or fallback for tool-only responses
      let response: string | undefined;
      if (responseText && responseText !== "") {
        response = responseText;
      } else if (isComplete) {
        response = "Chart files created.";
      }

      result.push({
        id: msg.id,
        prompt: userText,
        response,
        isComplete,
        isIntentComplete: isComplete,
        createdAt: new Date(),
      });

      // Skip the assistant message since we included it as response
      if (hasAssistantResponse) {
        i++;
      }
    }
  }

  return result;
}

/**
 * Custom hook for Chartsmith chat functionality
 *
 * Uses Vercel AI SDK's useChat hook internally with Chartsmith configuration.
 */
export function useChartsmithChat(
  options: UseChartsmithChatOptions = {}
): UseChartsmithChatReturn {
  const { onError, onFinish } = options;
  const [workspace] = useAtom(workspaceAtom);

  // Manage input state locally since useChat doesn't provide it
  const [input, setInput] = useState("");

  // Create transport with workspace ID in body
  // Memoize to avoid recreating on every render
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          workspaceId: workspace?.id,
        },
      }),
    [workspace?.id]
  );

  const {
    messages: aiMessages,
    status,
    error,
    stop,
    sendMessage: aiSendMessage,
  } = useChat({
    transport,
    onError: (err) => {
      console.error("[useChartsmithChat] Error:", err);
      onError?.(err);
    },
    onFinish: () => {
      onFinish?.();
    },
  });

  // Determine loading state from status
  const isLoading = status === "submitted" || status === "streaming";
  const isStreamingComplete = status === "ready" || status === "error";

  // Convert AI SDK messages to Chartsmith format
  const messages = convertToChartsmithMessages(aiMessages, isStreamingComplete);

  // Wrapper for sendMessage that accepts just a string
  const sendMessage = (content: string) => {
    if (!workspace?.id) {
      console.error("[useChartsmithChat] No workspace ID available");
      return;
    }
    if (!content.trim()) {
      return;
    }
    aiSendMessage({ text: content.trim() });
  };

  return {
    sendMessage,
    messages,
    isLoading,
    error,
    stop,
    input,
    setInput,
    rawMessages: aiMessages,
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
