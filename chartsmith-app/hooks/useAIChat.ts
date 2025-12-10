/**
 * @fileoverview Custom hook for AI SDK chat integration with Chartsmith workspace.
 * 
 * This hook wraps @ai-sdk/react's useChat hook with Chartsmith-specific
 * configuration. It handles workspace context, message persistence, and
 * integration with existing Jotai atoms for backward compatibility.
 * 
 * Key Features:
 * - Message format conversion (AI SDK ↔ Chartsmith Message type)
 * - Real-time Jotai atom synchronization
 * - Historical message loading from database
 * - Role selector integration (auto/developer/operator)
 * - Message persistence callbacks
 * 
 * @see https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
 */

'use client';

import { useChat } from '@ai-sdk/react';
import { useAtom } from 'jotai';
import { useState, useEffect, useMemo } from 'react';
import { messagesAtom } from '@/atoms/workspace';
import { Session } from '@/lib/types/session';
import { Message } from '@/components/types';
import { 
  messagesToAIMessages, 
  aiMessageToMessage,
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
 * Custom hook for AI SDK chat integration with Chartsmith workspace.
 *
 * This hook wraps @ai-sdk/react's useChat hook with Chartsmith-specific
 * configuration. It handles workspace context, message persistence, and
 * integration with existing Jotai atoms.
 *
 * The hook automatically:
 * - Loads historical messages from the database if not provided
 * - Converts between AI SDK message format and Chartsmith Message type
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
  
  // Load initial messages if not provided
  const [loadedMessages, setLoadedMessages] = useState<Message[]>(initialMessages || []);
  const [isLoadingHistory, setIsLoadingHistory] = useState(!initialMessages);
  
  useEffect(() => {
    if (!initialMessages && isLoadingHistory) {
      // Load messages from server action
      getWorkspaceMessagesAction(session, workspaceId)
        .then((msgs) => {
          setLoadedMessages(msgs);
          setIsLoadingHistory(false);
        })
        .catch((err) => {
          console.error('Failed to load messages:', err);
          setIsLoadingHistory(false);
        });
    }
  }, [workspaceId, session, initialMessages, isLoadingHistory]);
  
  // Convert loaded messages from Chartsmith format to AI SDK format for useChat
  const initialAIMessages = useMemo(() => {
    return messagesToAIMessages(loadedMessages);
  }, [loadedMessages]);
  
  // Manage input state ourselves (AI SDK v5 doesn't provide input state)
  const [input, setInput] = useState('');
  
  // Configure useChat hook with custom transport to proxy through our API route
  const chat = useChat({
    id: `chat-${workspaceId}`,
    messages: initialAIMessages,
    transport: {
      async sendMessage({ messages, data }) {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            workspaceId,
            role: selectedRole,
            ...data,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.body;
      },
    },
    onFinish: ({ message }) => {
      // When message finishes streaming, convert from AI SDK format and sync to Jotai atom
      const metadata: MessageMetadata = {
        workspaceId,
        userId: session.user.id,
      };
      
      // Try to find matching message in current state to preserve metadata (renderId, planId, etc.)
      const msgContent = extractContent((message as any).content || '');
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
      
      const convertedMessage = aiMessageToMessage(message as any, metadata);
      
      setMessages(prev => {
        const existing = prev.find(m => m.id === convertedMessage.id);
        if (existing) {
          return prev.map(m => m.id === convertedMessage.id ? convertedMessage : m);
        }
        return [...prev, convertedMessage];
      });
    },
    onError: (error) => {
      console.error('Chat error:', error);
      // Error is exposed via return value
    },
  });
  
  // Extract values from chat object
  const aiMessages = chat.messages;
  const isLoading = chat.status === 'streaming' || chat.status === 'submitted';
  const error = chat.error;
  const stop = () => chat.stop();
  const reload = () => chat.regenerate();
  
  // Helper to extract content from AI SDK message
  function extractContent(content: string | Array<{ type: string; text?: string }>): string {
    if (typeof content === 'string') {
      return content;
    }
    return content
      .map(c => c.type === 'text' ? (c.text || '') : '')
      .join('');
  }
  
  // Sync AI SDK messages to Jotai atom in real-time as they stream
  // This ensures backward compatibility with components that read from the atom
  useEffect(() => {
    // Convert all AI SDK messages to Chartsmith Message format
    // AI SDK uses separate user/assistant messages, but we combine them into pairs
    const convertedMessages: Message[] = [];
    let currentUserMessage: Message | null = null;
    
    for (const aiMessage of aiMessages) {
      const metadata: MessageMetadata = {
        workspaceId,
        userId: session.user.id,
      };
      
      if (aiMessage.role === 'user') {
        // Save previous user message if exists
        if (currentUserMessage) {
          convertedMessages.push(currentUserMessage);
        }
        currentUserMessage = aiMessageToMessage(aiMessage, metadata);
      } else if (aiMessage.role === 'assistant') {
        if (currentUserMessage) {
          // Merge assistant response with user message
          const assistantContent = extractContent((aiMessage as any).content || '');
          currentUserMessage.response = assistantContent;
          currentUserMessage.isComplete = chat.status === 'ready'; // Complete when status is ready
          
          // Preserve tool invocations from AI SDK message
          const toolInvocations = (aiMessage as any).toolInvocations?.map((inv: any) => ({
            toolCallId: inv.toolCallId || inv.id,
            toolName: inv.toolName || inv.name,
            args: inv.args,
            result: inv.result,
          }));
          if (toolInvocations && toolInvocations.length > 0) {
            currentUserMessage.toolInvocations = toolInvocations;
          }
          
          convertedMessages.push(currentUserMessage);
          
          // Call onMessageComplete callback if provided and message is complete
          if (onMessageComplete && currentUserMessage.isComplete && currentUserMessage.response) {
            // Create assistant message for callback
            const assistantMessage = aiMessageToMessage(aiMessage, metadata);
            onMessageComplete(currentUserMessage, assistantMessage);
          }
          
          currentUserMessage = null;
        } else {
          // Orphaned assistant message (shouldn't happen, but handle gracefully)
          const assistantMessage = aiMessageToMessage(aiMessage, metadata);
          convertedMessages.push(assistantMessage);
        }
      }
    }
    
    // Add last user message if exists (no response yet)
    if (currentUserMessage) {
      convertedMessages.push(currentUserMessage);
    }
    
    // Update atom with converted messages
    setMessages(convertedMessages);
  }, [aiMessages, workspaceId, session.user.id, chat.status, setMessages, onMessageComplete]);
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };
  
  // Wrap handleSubmit to send message with role
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    chat.sendMessage({
      content: input.trim(),
      role: 'user',
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
