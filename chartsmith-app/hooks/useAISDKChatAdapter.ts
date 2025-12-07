/**
 * AI SDK Chat Adapter Hook
 *
 * This hook bridges the AI SDK useChat hook with the existing Chartsmith
 * message format and UI patterns. It provides:
 *
 * 1. Message format conversion (UIMessage → Message)
 * 2. Status flag mapping (submitted/streaming/ready → isThinking/isStreaming)
 * 3. Persona propagation to /api/chat endpoint
 * 4. Cancel state tracking with partial response persistence
 * 5. Integration with Jotai atoms for Centrifugo compatibility
 *
 * Usage:
 *   const chatState = useAISDKChatAdapter(workspaceId, revisionNumber, session, initialMessages);
 *   chatState.sendMessage("Create a deployment", "developer");
 */

"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { type Session } from "@/lib/types/session";
import { useAtom, atom } from "jotai";

import { type Message } from "@/components/types";
import { messagesAtom } from "@/atoms/workspace";
import {
  mapUIMessagesToMessages,
  mergeMessages,
  hasFileModifyingToolCalls,
  generateFollowupActions,
} from "@/lib/chat/messageMapper";
import { createAISDKChatMessageAction } from "@/lib/workspace/actions/create-ai-sdk-chat-message";
import { updateChatMessageResponseAction } from "@/lib/workspace/actions/update-chat-message-response";
import {
  STREAMING_THROTTLE_MS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
} from "@/lib/ai/config";

/**
 * Exported atom for tracking the currently streaming message ID
 * Used by useCentrifugo to skip updates for messages being streamed
 */
export const currentStreamingMessageIdAtom = atom<string | null>(null);

/**
 * Persona types matching ChatMessageFromPersona enum
 */
export type ChatPersona = "auto" | "developer" | "operator";

/**
 * Adapted chat state interface matching existing patterns
 */
export interface AdaptedChatState {
  /** Messages in existing Message format (historical + streaming) */
  messages: Message[];

  /** Send a message with optional persona - MUST pass persona to API */
  sendMessage: (content: string, persona?: ChatPersona) => Promise<void>;

  /** Whether currently waiting for response to start (status === 'submitted') */
  isThinking: boolean;

  /** Whether currently streaming a response (status === 'streaming') */
  isStreaming: boolean;

  /** Whether the current message was canceled */
  isCanceled: boolean;

  /** Cancel the current streaming response - sets isCanceled and persists partial */
  cancel: () => void;

  /** Current error, if any */
  error: Error | null;

  /** PR4: Currently selected provider */
  selectedProvider: string;

  /** PR4: Currently selected model */
  selectedModel: string;

  /** PR4: Switch to a different provider/model mid-conversation */
  switchProvider: (provider: string, model: string) => void;
}

/**
 * AI SDK Chat Adapter Hook
 *
 * Bridges AI SDK useChat with existing Chartsmith patterns.
 *
 * @param workspaceId - Current workspace ID
 * @param revisionNumber - Current revision number
 * @param session - User session for authentication
 * @param initialMessages - Historical messages from database (optional)
 * @returns AdaptedChatState matching existing ChatContainer patterns
 */
export function useAISDKChatAdapter(
  workspaceId: string,
  revisionNumber: number,
  session: Session,
  initialMessages: Message[] = []
): AdaptedChatState {
  // Track the current message being persisted
  const [currentChatMessageId, setCurrentChatMessageId] = useState<
    string | null
  >(null);
  const hasPersistedRef = useRef<Set<string>>(new Set());
  
  // Track if we've auto-sent the initial message (prevents duplicates)
  const hasAutoSentRef = useRef(false);

  // Track cancel state (AI SDK doesn't expose this)
  const [isCanceled, setIsCanceled] = useState(false);

  // PR4: Track selected provider/model for live switching
  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_PROVIDER);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // Jotai messages for real-time updates from Centrifugo
  const [jotaiMessages] = useAtom(messagesAtom);

  // Track streaming message ID for Centrifugo coordination
  const [, setCurrentStreamingMessageId] = useAtom(
    currentStreamingMessageIdAtom
  );

  // Store current persona for getChatBody (avoid stale closures)
  const currentPersonaRef = useRef<ChatPersona>("auto");

  // AI SDK chat hook
  const {
    messages: aiMessages,
    sendMessage: aiSendMessage,
    status,
    stop,
    error,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    experimental_throttle: STREAMING_THROTTLE_MS,
    onError: (err) => {
      console.error("[useAISDKChatAdapter] Error:", err);
    },
  });

  // Helper to get fresh body params WITH PERSONA (avoid stale closures)
  // NOTE: body is NOT passed to useChat - it would be captured at initialization
  // Instead, pass body in each sendMessage() call for fresh values
  // PR3.0: Include chatMessageId for plan creation
  // PR4: Use selected provider/model for live switching
  const getChatBody = useCallback(
    (messageId?: string) => ({
      provider: selectedProvider,
      model: selectedModel,
      workspaceId,
      revisionNumber,
      persona: currentPersonaRef.current, // CRITICAL: Include persona
      chatMessageId: messageId, // PR3.0: For plan creation
    }),
    [workspaceId, revisionNumber, selectedProvider, selectedModel]
  );

  // Auto-send: If there's an initial message without a response, send it to AI SDK
  // This handles the flow from landing page where createWorkspaceFromPromptAction
  // persists the user message to DB, then we need to get the AI response
  useEffect(() => {
    // Use ref check FIRST to prevent any possibility of double-send
    if (hasAutoSentRef.current) return;

    // Find the last user message that has no response
    const lastMessage = jotaiMessages.length > 0
      ? jotaiMessages[jotaiMessages.length - 1]
      : null;

    // Only auto-send if there's a user message without a response
    const needsResponse = lastMessage && !lastMessage.response && lastMessage.prompt;

    if (needsResponse && aiMessages.length === 0 && workspaceId) {
      // Mark as sent BEFORE calling sendMessage to prevent race conditions
      hasAutoSentRef.current = true;
      console.log('[useAISDKChatAdapter] Auto-sending initial message to AI:', lastMessage.prompt);
      
      // Set the current message ID for persistence tracking
      setCurrentChatMessageId(lastMessage.id);
      
      // Send to AI SDK with chatMessageId for plan creation
      aiSendMessage(
        { text: lastMessage.prompt },
        { body: getChatBody(lastMessage.id) }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jotaiMessages, aiMessages.length, workspaceId]); // Run when jotai messages update

  // Convert AI SDK messages to existing format
  const streamingMessages = useMemo(() => {
    return mapUIMessagesToMessages(aiMessages, {
      workspaceId,
      revisionNumber,
      isStreaming: status === "streaming",
      isCanceled,
    });
  }, [aiMessages, workspaceId, revisionNumber, status, isCanceled]);

  // Merge historical (from Jotai/DB) with streaming messages
  // Jotai messages are authoritative for historical data
  const mergedMessages = useMemo(() => {
    return mergeMessages(jotaiMessages, streamingMessages);
  }, [jotaiMessages, streamingMessages]);

  // Update streaming message ID for Centrifugo coordination
  useEffect(() => {
    if (status === "streaming" || status === "submitted") {
      setCurrentStreamingMessageId(currentChatMessageId);
    } else {
      setCurrentStreamingMessageId(null);
    }
  }, [status, currentChatMessageId, setCurrentStreamingMessageId]);

  // Persist response when streaming completes
  useEffect(() => {
    if (status === "ready" && currentChatMessageId && aiMessages.length > 0) {
      // Avoid double-persistence
      if (hasPersistedRef.current.has(currentChatMessageId)) {
        return;
      }

      const lastAssistant = aiMessages.filter((m) => m.role === "assistant").pop();
      if (lastAssistant) {
        const textContent =
          lastAssistant.parts
            ?.filter(
              (p): p is { type: "text"; text: string } => p.type === "text"
            )
            .map((p) => p.text)
            .join("\n") || "";

        // PR3.0: Generate rule-based followup actions
        const hasFileChanges = hasFileModifyingToolCalls(lastAssistant);
        const followupActions = generateFollowupActions(lastAssistant, hasFileChanges);

        hasPersistedRef.current.add(currentChatMessageId);

        updateChatMessageResponseAction(
          session,
          currentChatMessageId,
          textContent,
          true, // isIntentComplete
          followupActions // PR3.0: Pass followup actions
        )
          .then(() => {
            setCurrentChatMessageId(null);
          })
          .catch((err) => {
            console.error(
              "[useAISDKChatAdapter] Failed to persist response:",
              err
            );
            hasPersistedRef.current.delete(currentChatMessageId);
          });
      }
    }
  }, [status, currentChatMessageId, aiMessages, session]);

  // Send message handler - MUST include persona
  const sendMessage = useCallback(
    async (content: string, persona?: ChatPersona) => {
      if (!content.trim()) return;

      // Reset cancel state for new message
      setIsCanceled(false);

      // Store persona for getChatBody
      currentPersonaRef.current = persona ?? "auto";

      try {
        // 1. Persist user message to database (for history)
        const chatMessage = await createAISDKChatMessageAction(
          session,
          workspaceId,
          content.trim()
        );
        setCurrentChatMessageId(chatMessage.id);

        // 2. Send to AI SDK with fresh body params INCLUDING PERSONA and chatMessageId
        await aiSendMessage(
          { text: content.trim() },
          { body: getChatBody(chatMessage.id) } // PR3.0: Include chatMessageId for plan creation
        );
      } catch (err) {
        console.error("[useAISDKChatAdapter] Send failed:", err);
        throw err;
      }
    },
    [session, workspaceId, aiSendMessage, getChatBody]
  );

  // PR4: Switch provider/model mid-conversation
  const switchProvider = useCallback((provider: string, model: string) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
    console.log(`[useAISDKChatAdapter] Switched to provider: ${provider}, model: ${model}`);
  }, []);

  // Cancel handler - sets isCanceled AND calls stop()
  // Also persists partial response to database
  const cancel = useCallback(() => {
    setIsCanceled(true);
    stop();

    // Persist canceled state to database if we have a current message
    if (currentChatMessageId) {
      const lastAssistant = aiMessages.filter((m) => m.role === "assistant").pop();
      const partialResponse =
        lastAssistant?.parts
          ?.filter(
            (p): p is { type: "text"; text: string } => p.type === "text"
          )
          .map((p) => p.text)
          .join("\n") || "";

      hasPersistedRef.current.add(currentChatMessageId);

      updateChatMessageResponseAction(
        session,
        currentChatMessageId,
        partialResponse,
        true // isIntentComplete (message is done, even if canceled)
      ).catch((err) => {
        console.error(
          "[useAISDKChatAdapter] Failed to persist canceled message:",
          err
        );
      });
    }
  }, [stop, currentChatMessageId, aiMessages, session]);

  return {
    messages: mergedMessages,
    sendMessage,
    isThinking: status === "submitted",
    isStreaming: status === "streaming",
    isCanceled,
    cancel, // Use our wrapped cancel, not raw stop()
    error: error ?? null,
    // PR4: Live provider switching
    selectedProvider,
    selectedModel,
    switchProvider,
  };
}

