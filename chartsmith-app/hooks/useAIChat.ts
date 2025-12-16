"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useCallback, useEffect, useState, ChangeEvent } from "react";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/workspace";
import { Session } from "@/lib/types/session";
import { authorizeExtensionAction } from "@/lib/auth/actions/authorize-extension";
import { Message } from "@/components/types";

interface UseAIChatOptions {
  session: Session;
  workspaceId: string;
}

/**
 * Hook for AI chat using Vercel AI SDK v5.
 * Provides streaming chat with integration to existing atom state.
 */
export function useAIChat({ session, workspaceId }: UseAIChatOptions) {
  const [, setMessages] = useAtom(messagesAtom);
  const [extensionToken, setExtensionToken] = useState<string | null>(null);
  const [input, setInput] = useState("");

  // Get extension token on mount
  useEffect(() => {
    const getToken = async () => {
      try {
        const { token } = await authorizeExtensionAction(session);
        setExtensionToken(token);
      } catch (error) {
        console.error("Failed to get extension token:", error);
      }
    };
    getToken();
  }, [session]);

  // Create transport with auth headers
  const transport = new DefaultChatTransport({
    api: "/api/chat",
    headers: extensionToken
      ? { Authorization: `Bearer ${extensionToken}` }
      : undefined,
    body: { workspaceId },
  });

  const chat = useChat({
    transport,
    onFinish: (response: { message: UIMessage }) => {
      const message = response.message;
      // Convert AI SDK message to our Message format and update atom
      const textContent = message.parts
        ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("") || "";

      const newMessage: Message = {
        id: message.id,
        prompt: "", // The prompt is tracked separately
        response: textContent,
        isComplete: true,
        createdAt: new Date(), // UIMessage v5 doesn't have createdAt
        workspaceId,
        userId: session.user.id,
      };

      setMessages((prev) => {
        // Check if message already exists (from streaming)
        const existingIndex = prev.findIndex((m) => m.id === message.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...newMessage };
          return updated;
        }
        return [...prev, newMessage];
      });

      // Note: DB persistence will be added in Phase 7
      // For now, messages are only tracked in atom state
    },
    onError: (error: Error) => {
      console.error("Chat error:", error);
    },
  });

  // Handle input change
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  // Custom submit handler that sends the message
  const handleSubmit = useCallback(
    async (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();

      if (!extensionToken) {
        console.error("Extension token not ready");
        return;
      }

      if (!input.trim()) {
        return;
      }

      const userPrompt = input;

      // Add user message to atom state before sending
      const userMessage: Message = {
        id: `user-${Date.now()}`, // Temporary ID
        prompt: userPrompt,
        response: undefined,
        isComplete: false,
        createdAt: new Date(),
        workspaceId,
        userId: session.user.id,
      };

      setMessages((prev) => [...prev, userMessage]);

      // Clear input
      setInput("");

      // Send message using v5 API
      chat.sendMessage({ text: userPrompt });
    },
    [chat, extensionToken, input, setMessages, workspaceId, session.user.id]
  );

  return {
    messages: chat.messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chat.status === "streaming" || chat.status === "submitted",
    error: chat.error,
    setInput,
    status: chat.status,
    // Expose raw chat object for advanced use cases
    _chat: chat,
  };
}
