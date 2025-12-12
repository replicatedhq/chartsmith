/**
 * @fileoverview Custom hook for AI SDK v5 chat integration with Chartsmith workspace.
 *
 * This hook wraps @ai-sdk/react's useChat hook with Chartsmith-specific
 * configuration. It handles workspace context, message persistence, and
 * integration with existing Jotai atoms for backward compatibility.
 *
 * Key Features:
 * - Message format conversion (AI SDK v5 UIMessage ↔ Chartsmith Message type)
 * - Real-time Jotai atom synchronization
 * - Historical message loading from database
 * - Role selector integration (auto/developer/operator)
 * - Message persistence callbacks
 *
 * @see https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
 */

'use client';

import { useChat } from '@ai-sdk/react';
import { UIMessage, DefaultChatTransport } from 'ai';
import { useAtom } from 'jotai';
import { useState, useEffect, useMemo, useRef } from 'react';
import { messagesAtom } from '@/atoms/workspace';
import { Session } from '@/lib/types/session';
import { Message } from '@/components/types';
import {
  messagesToUIMessages,
  uiMessageToMessage,
  extractTextFromParts,
  MessageMetadata
} from '@/lib/types/chat';
import { getWorkspaceMessagesAction } from '@/lib/workspace/actions/get-workspace-messages';

/**
 * Configuration options for the useAIChat hook.
 */
export interface UseAIChatOptions {
  /** Workspace ID for chat context */
  workspaceId: string;
  /** User session for authentication */
  session: Session;
  /** Optional initial messages (if not provided, loads from database) */
  initialMessages?: Message[];
  /**
   * Callback when a message pair (user + assistant) is completed.
   * Used for persisting messages to the database.
   */
  onMessageComplete?: (userMessage: Message, assistantMessage: Message) => void;
}

/**
 * Return value from the useAIChat hook.
 *
 * Combines AI SDK useChat return values with Chartsmith-specific features.
 */
export interface UseAIChatReturn {
  /** Chat messages in Chartsmith Message format (converted from AI SDK format) */
  messages: Message[];
  /** Current input value */
  input: string;
  /** Handler for input changes */
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Handler for form submission */
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Whether a request is in progress */
  isLoading: boolean;
  /** Error object if an error occurred */
  error: Error | undefined;
  /** Stop the current streaming request */
  stop: () => void;
  /** Regenerate the last assistant response */
  reload: () => void;

  /** Currently selected role (auto/developer/operator) */
  selectedRole: 'auto' | 'developer' | 'operator';
  /** Set the selected role */
  setSelectedRole: (role: 'auto' | 'developer' | 'operator') => void;
}

/**
 * Custom hook for AI SDK v5 chat integration with Chartsmith workspace.
 *
 * This hook wraps @ai-sdk/react's useChat hook with Chartsmith-specific
 * configuration. It handles workspace context, message persistence, and
 * integration with existing Jotai atoms.
 *
 * The hook automatically:
 * - Loads historical messages from the database if not provided
 * - Converts between AI SDK v5 UIMessage format and Chartsmith Message type
 * - Syncs messages to Jotai atoms for backward compatibility
 * - Handles message persistence via callbacks
 * - Manages role selection (auto/developer/operator)
 *
 * @param options - Configuration options for the chat hook
 * @param options.session - User session for authentication
 * @param options.workspaceId - Workspace ID for chat context
 * @param options.initialMessages - Optional initial messages (if not provided, loads from database)
 * @param options.onMessageComplete - Callback when a message pair (user + assistant) completes, used for persistence
 * @returns Chat hook interface compatible with useChat, plus Chartsmith-specific features
 *
 * @example
 * ```tsx
 * const { messages, input, handleSubmit, isLoading } = useAIChat({
 *   session,
 *   workspaceId: workspace.id,
 *   onMessageComplete: async (userMsg, assistantMsg) => {
 *     // Persist messages to database
 *     await saveMessages(userMsg, assistantMsg);
 *   },
 * });
 * ```
 *
 * @see https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
 */
export function useAIChat({ workspaceId, session, initialMessages, onMessageComplete }: UseAIChatOptions): UseAIChatReturn {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [selectedRole, setSelectedRole] = useState<'auto' | 'developer' | 'operator'>('auto');

  // Use refs to store callback and session to avoid re-triggering effects
  const onMessageCompleteRef = useRef(onMessageComplete);
  onMessageCompleteRef.current = onMessageComplete;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Store selectedRole in ref to access in transport without causing re-renders
  const selectedRoleRef = useRef(selectedRole);
  selectedRoleRef.current = selectedRole;

  // Load initial messages if not provided
  const [loadedMessages, setLoadedMessages] = useState<Message[]>(initialMessages || []);
  const [isLoadingHistory, setIsLoadingHistory] = useState(!initialMessages);

  // Track if we've already loaded history to prevent re-fetching
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Skip loading if no workspaceId (hook called with empty string when workspace not available)
    if (!workspaceId) {
      setIsLoadingHistory(false);
      return;
    }
    if (!initialMessages && isLoadingHistory && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // Load messages from server action
      getWorkspaceMessagesAction(sessionRef.current, workspaceId)
        .then((msgs) => {
          setLoadedMessages(msgs);
          setIsLoadingHistory(false);
        })
        .catch(() => {
          // Silently handle load failure - empty state is acceptable
          setIsLoadingHistory(false);
        });
    }
  }, [workspaceId, initialMessages, isLoadingHistory]);

  // Convert loaded messages from Chartsmith format to AI SDK v5 UIMessage format for useChat
  const initialUIMessages = useMemo(() => {
    return messagesToUIMessages(loadedMessages);
  }, [loadedMessages]);

  // Manage input state ourselves
  const [input, setInput] = useState('');

  // Create transport with memoization to avoid recreating on every render
  // We use DefaultChatTransport which handles the stream conversion from bytes to UIMessageChunk
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages: uiMessages }) => {
        // Convert UIMessages to simple format for our API and add extra fields
        const apiMessages = uiMessages.map(msg => ({
          role: msg.role,
          content: extractTextFromParts(msg.parts),
        }));

        return {
          body: {
            messages: apiMessages,
            workspaceId,
            role: selectedRoleRef.current,
          },
        };
      },
    });
  }, [workspaceId]);

  // Configure useChat hook with custom transport to proxy through our API route
  const chat = useChat({
    id: `chat-${workspaceId}`,
    messages: initialUIMessages,
    transport,
    onFinish: ({ message }) => {
      // When message finishes streaming, convert from AI SDK format and sync to Jotai atom
      const metadata: MessageMetadata = {
        workspaceId,
        userId: session.user.id,
      };

      // Try to find matching message in current state to preserve metadata (renderId, planId, etc.)
      const msgContent = extractTextFromParts(message.parts);
      const existingMessage = messages.find(m => {
        return m.prompt === msgContent || m.response === msgContent;
      });

      if (existingMessage) {
        // Preserve existing metadata
        Object.assign(metadata, {
          isIntentComplete: existingMessage.isIntentComplete,
          followupActions: existingMessage.followupActions,
          responseRenderId: existingMessage.responseRenderId,
          responsePlanId: existingMessage.responsePlanId,
          responseConversionId: existingMessage.responseConversionId,
          responseRollbackToRevisionNumber: existingMessage.responseRollbackToRevisionNumber,
          planId: existingMessage.planId,
          revisionNumber: existingMessage.revisionNumber,
          isApplied: existingMessage.isApplied,
          isApplying: existingMessage.isApplying,
          isIgnored: existingMessage.isIgnored,
          isCanceled: existingMessage.isCanceled,
        });
      }

      const convertedMessage = uiMessageToMessage(message, metadata);

      setMessages(prev => {
        const existing = prev.find(m => m.id === convertedMessage.id);
        if (existing) {
          return prev.map(m => m.id === convertedMessage.id ? convertedMessage : m);
        }
        return [...prev, convertedMessage];
      });
    },
    onError: () => {
      // Error is exposed via the hook's return value - no logging needed
    },
  });

  // Extract values from chat object
  const uiMessages = chat.messages;
  const isLoading = chat.status === 'streaming' || chat.status === 'submitted';
  const error = chat.error;
  const stop = () => chat.stop();
  const reload = () => chat.regenerate();

  // Track last synced messages to avoid unnecessary updates
  const lastSyncedMessagesRef = useRef<string>('');
  // Track which messages we've already called onMessageComplete for
  const completedMessageIdsRef = useRef<Set<string>>(new Set());

  // Sync AI SDK messages to Jotai atom in real-time as they stream
  // This ensures backward compatibility with components that read from the atom
  useEffect(() => {
    // Convert all AI SDK messages to Chartsmith Message format
    // AI SDK uses separate user/assistant messages, but we combine them into pairs
    const convertedMessages: Message[] = [];
    let currentUserMessage: Message | null = null;

    for (const uiMessage of uiMessages) {
      const metadata: MessageMetadata = {
        workspaceId,
        userId: sessionRef.current.user.id,
      };

      if (uiMessage.role === 'user') {
        // Save previous user message if exists
        if (currentUserMessage) {
          convertedMessages.push(currentUserMessage);
        }
        currentUserMessage = uiMessageToMessage(uiMessage, metadata);
      } else if (uiMessage.role === 'assistant') {
        if (currentUserMessage) {
          // Merge assistant response with user message
          const assistantContent = extractTextFromParts(uiMessage.parts);
          currentUserMessage.response = assistantContent;
          currentUserMessage.isComplete = chat.status === 'ready'; // Complete when status is ready

          // Preserve tool invocations from AI SDK message
          // In AI SDK v5, tool parts have type like 'tool-${name}' or 'dynamic-tool'
          const toolParts = uiMessage.parts?.filter(
            (part) => part.type.startsWith('tool-') || part.type === 'dynamic-tool'
          ) || [];

          if (toolParts.length > 0) {
            currentUserMessage.toolInvocations = toolParts.map((part: any) => ({
              toolCallId: part.toolCallId,
              toolName: part.toolName || part.type.replace('tool-', ''),
              args: part.input,
              result: part.output,
            }));
          }

          convertedMessages.push(currentUserMessage);

          // Call onMessageComplete callback if provided and message is complete
          // Use ref to get latest callback and track already-completed messages
          if (onMessageCompleteRef.current && currentUserMessage.isComplete && currentUserMessage.response) {
            const messageId = currentUserMessage.id;
            if (!completedMessageIdsRef.current.has(messageId)) {
              completedMessageIdsRef.current.add(messageId);
              // Create assistant message for callback
              const assistantMessage = uiMessageToMessage(uiMessage, metadata);
              onMessageCompleteRef.current(currentUserMessage, assistantMessage);
            }
          }

          currentUserMessage = null;
        } else {
          // Orphaned assistant message (shouldn't happen, but handle gracefully)
          const assistantMessage = uiMessageToMessage(uiMessage, metadata);
          convertedMessages.push(assistantMessage);
        }
      }
    }

    // Add last user message if exists (no response yet)
    if (currentUserMessage) {
      convertedMessages.push(currentUserMessage);
    }

    // Only update atom if messages actually changed (compare by stringified content)
    const messagesKey = JSON.stringify(convertedMessages.map(m => ({
      id: m.id,
      prompt: m.prompt,
      response: m.response,
      isComplete: m.isComplete,
    })));

    if (messagesKey !== lastSyncedMessagesRef.current) {
      lastSyncedMessagesRef.current = messagesKey;
      // IMPORTANT: Don't overwrite atom with empty messages if it already has data.
      // This prevents clearing server-loaded messages on initial render.
      // Only sync if we have messages to sync OR if the atom is already empty.
      setMessages(prev => {
        if (convertedMessages.length === 0 && prev.length > 0) {
          // Keep existing messages - don't clear them
          return prev;
        }
        return convertedMessages;
      });
    }
  }, [uiMessages, workspaceId, chat.status, setMessages]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  // Wrap handleSubmit to send message with role
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // AI SDK v5 sendMessage expects UIMessage format
    chat.sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input.trim() }],
    });

    setInput('');
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
    selectedRole,
    setSelectedRole,
  };
}
