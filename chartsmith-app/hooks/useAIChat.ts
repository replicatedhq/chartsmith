'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAtom } from 'jotai';
import { workspaceAtom } from '@/atoms/workspace';
import { useCallback, useState, useRef } from 'react';
import { createChatMessageAction } from '@/lib/workspace/actions/create-chat-message';
import { persistAIResponseAction } from '@/lib/workspace/actions/persist-ai-message';
import { Session } from '@/lib/types/session';

interface UseAIChatProps {
  session: Session;
  workspaceId: string;
}

/**
 * Extract text content from AI SDK message parts.
 * Messages in AI SDK v5 have a parts array with different part types.
 */
function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts) return '';
  return message.parts
    .filter(part => part.type === 'text' && part.text)
    .map(part => part.text)
    .join('');
}

export function useAIChat({ session, workspaceId }: UseAIChatProps) {
  const [workspace] = useAtom(workspaceAtom);
  const [input, setInput] = useState('');
  // Track the current chat message ID for persisting responses
  const currentChatMessageIdRef = useRef<string | null>(null);

  const {
    messages,
    status,
    error,
    stop,
    sendMessage,
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        workspaceId,
        chartId: workspace?.charts[0]?.id,
      },
    }),
    onFinish: async ({ message }) => {
      // Persist the completed assistant message to database for history
      if (message.role === 'assistant' && currentChatMessageIdRef.current) {
        try {
          const responseText = getMessageText(message);
          if (responseText) {
            await persistAIResponseAction(
              currentChatMessageIdRef.current,
              responseText
            );
          }
        } catch (err) {
          console.error('Failed to persist AI response:', err);
        } finally {
          currentChatMessageIdRef.current = null;
        }
      }
    },
  });

  const handleSubmit = useCallback(async (e: React.FormEvent, role?: string) => {
    e.preventDefault();
    if (!input.trim() || status === 'streaming') return;

    const messageText = input.trim();
    setInput(''); // Clear input immediately

    // Persist user message to database before sending and store the ID
    const chatMessage = await createChatMessageAction(session, workspaceId, messageText, role || 'auto');
    currentChatMessageIdRef.current = chatMessage.id;

    // Send message using AI SDK
    sendMessage({ text: messageText });
  }, [input, status, session, workspaceId, sendMessage]);

  const isLoading = status === 'streaming' || status === 'submitted';

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    stop,
    sendMessage,
  };
}
