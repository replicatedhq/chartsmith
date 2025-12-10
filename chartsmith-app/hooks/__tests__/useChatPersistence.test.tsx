/**
 * Tests for useChatPersistence hook
 * 
 * Note: These tests use jsdom environment for React hooks
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useChatPersistence } from '../useChatPersistence';

// Mock the ChatPersistenceService
jest.mock('@/lib/services/chat-persistence', () => ({
  ChatPersistenceService: jest.fn().mockImplementation(() => ({
    loadHistory: jest.fn().mockResolvedValue([]),
    saveMessagePair: jest.fn().mockResolvedValue({ id: 'msg1' }),
  })),
}));

describe('useChatPersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads history on mount', async () => {
    const { result } = renderHook(() =>
      useChatPersistence({ workspaceId: 'ws123' })
    );

    expect(result.current.isLoadingHistory).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
    });

    expect(result.current.initialMessages).toEqual([]);
  });

  it('provides saveMessage function', async () => {
    const { result } = renderHook(() =>
      useChatPersistence({ workspaceId: 'ws123' })
    );

    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
    });

    expect(typeof result.current.saveMessage).toBe('function');
  });

  it('does not load when disabled', () => {
    const { result } = renderHook(() =>
      useChatPersistence({ workspaceId: 'ws123', enabled: false })
    );

    expect(result.current.isLoadingHistory).toBe(false);
  });

  it('handles errors gracefully', async () => {
    const { ChatPersistenceService } = require('@/lib/services/chat-persistence');
    ChatPersistenceService.mockImplementation(() => ({
      loadHistory: jest.fn().mockRejectedValue(new Error('Failed to load')),
      saveMessagePair: jest.fn().mockResolvedValue({ id: 'msg1' }),
    }));

    const { result } = renderHook(() =>
      useChatPersistence({ workspaceId: 'ws123' })
    );

    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
