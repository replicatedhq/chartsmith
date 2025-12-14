/**
 * useChatPersistence Hook
 * 
 * React hook for managing chat message persistence.
 * Handles loading history and saving completed messages.
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { ChatPersistenceService, SimpleMessage } from '@/lib/services/chat-persistence';

interface UseChatPersistenceOptions {
  workspaceId: string;
  enabled?: boolean;
}

interface UseChatPersistenceReturn {
  /** Load chat history */
  loadHistory: () => Promise<SimpleMessage[]>;
  /** Save completed message pair */
  saveMessage: (userMsg: SimpleMessage, assistantMsg: SimpleMessage) => Promise<void>;
  /** Whether history is loading */
  isLoadingHistory: boolean;
  /** Initial messages loaded from history */
  initialMessages: SimpleMessage[];
  /** Error from persistence operations */
  error: Error | null;
}

/**
 * Hook for managing chat message persistence
 */
export function useChatPersistence({
  workspaceId,
  enabled = true,
}: UseChatPersistenceOptions): UseChatPersistenceReturn {
  const serviceRef = useRef<ChatPersistenceService | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [initialMessages, setInitialMessages] = useState<SimpleMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Initialize service
  useEffect(() => {
    if (enabled && workspaceId) {
      serviceRef.current = new ChatPersistenceService(workspaceId);
    }
  }, [workspaceId, enabled]);

  // Load history on mount
  useEffect(() => {
    if (!enabled || !workspaceId) {
      setIsLoadingHistory(false);
      return;
    }

    const loadInitialHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const service = new ChatPersistenceService(workspaceId);
        const history = await service.loadHistory();
        setInitialMessages(history);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load history'));
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadInitialHistory();
  }, [workspaceId, enabled]);

  const loadHistory = useCallback(async (): Promise<SimpleMessage[]> => {
    if (!serviceRef.current) {
      return [];
    }
    try {
      const history = await serviceRef.current.loadHistory();
      setInitialMessages(history);
      return history;
    } catch (err) {
      throw err;
    }
  }, []);

  const saveMessage = useCallback(
    async (userMsg: SimpleMessage, assistantMsg: SimpleMessage): Promise<void> => {
      if (!serviceRef.current || !enabled) {
        return;
      }
      try {
        await serviceRef.current.saveMessagePair(userMsg, assistantMsg);
        setError(null);
      } catch (err) {
        // Don't throw - persistence failure shouldn't break chat
        setError(err instanceof Error ? err : new Error('Failed to save'));
      }
    },
    [enabled]
  );

  return {
    loadHistory,
    saveMessage,
    isLoadingHistory,
    initialMessages,
    error,
  };
}
