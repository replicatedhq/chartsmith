/**
 * Legacy Chat Hook Wrapper
 *
 * This hook wraps the existing Go worker chat path to match the
 * AdaptedChatState interface, enabling feature flag switching
 * between legacy and AI SDK chat implementations.
 *
 * The legacy path:
 * 1. createChatMessageAction persists user message
 * 2. Go worker picks up from PostgreSQL queue
 * 3. Centrifugo pushes updates to messagesAtom
 */

"use client";

import { useCallback } from "react";
import { useAtom } from "jotai";
import { type Session } from "@/lib/types/session";

import { type Message } from "@/components/types";
import {
  messagesAtom,
  workspaceAtom,
  isRenderingAtom,
} from "@/atoms/workspace";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { type AdaptedChatState, type ChatPersona } from "./useAISDKChatAdapter";
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from "@/lib/ai/config";

/**
 * Wraps the legacy Go worker chat path to match AdaptedChatState interface
 *
 * @param session - User session for authentication
 * @returns AdaptedChatState compatible with ChatContainer
 */
export function useLegacyChat(session: Session): AdaptedChatState {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [workspace] = useAtom(workspaceAtom);
  const [isRendering] = useAtom(isRenderingAtom);

  /**
   * Send message via legacy Go worker path
   *
   * This calls createChatMessageAction which:
   * 1. Persists to workspace_chat table
   * 2. Triggers enqueueWork("new_intent") for Go worker processing
   * 3. Go worker handles LLM call and updates via Centrifugo
   */
  const sendMessage = useCallback(
    async (content: string, persona?: ChatPersona) => {
      if (!content.trim() || !workspace) return;

      const chatMessage = await createChatMessageAction(
        session,
        workspace.id,
        content.trim(),
        persona ?? "auto"
      );

      // Add message to local state immediately for optimistic UI
      // Centrifugo will update with response as Go worker processes
      setMessages((prev) => [...prev, chatMessage]);
    },
    [session, workspace, setMessages]
  );

  /**
   * Cancel is not implemented for legacy path
   *
   * The Go worker path doesn't support mid-stream cancellation in the same way.
   * The isRendering state is managed entirely by Go worker via Centrifugo.
   */
  const cancel = useCallback(() => {
    console.warn(
      "[useLegacyChat] Cancel not implemented for legacy path - use AI SDK for cancellation support"
    );
  }, []);

  return {
    messages,
    sendMessage,
    // Legacy path doesn't have explicit "thinking" state
    // isRendering covers both thinking and streaming
    isThinking: false,
    isStreaming: isRendering,
    // Legacy path doesn't track canceled state this way
    // (cancellation goes through different flow)
    isCanceled: false,
    cancel,
    error: null,
    // PR4: Legacy path doesn't support live provider switching
    // Return defaults for interface compatibility
    selectedProvider: DEFAULT_PROVIDER,
    selectedModel: DEFAULT_MODEL,
    switchProvider: () => {
      console.warn("[useLegacyChat] Provider switching not supported in legacy path");
    },
  };
}

