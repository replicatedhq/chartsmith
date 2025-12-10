/**
 * Tests for ChatPersistenceService
 */

import { ChatPersistenceService } from '../chat-persistence';

describe('ChatPersistenceService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('loadHistory', () => {
    it('loads and converts messages to AI SDK format', async () => {
      const mockData = [
        {
          id: 'msg1',
          prompt: 'Hello',
          response: 'Hi there!',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const service = new ChatPersistenceService('workspace123');
      const messages = await service.loadHistory();

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'Hello',
      });
      expect(messages[1]).toEqual({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('returns empty array for 404', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const service = new ChatPersistenceService('workspace123');
      const messages = await service.loadHistory();

      expect(messages).toEqual([]);
    });

    it('handles messages array wrapped in object', async () => {
      const mockData = {
        messages: [
          {
            id: 'msg1',
            prompt: 'Test',
            response: 'Response',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const service = new ChatPersistenceService('workspace123');
      const messages = await service.loadHistory();

      expect(messages).toHaveLength(2);
    });
  });

  describe('saveMessagePair', () => {
    it('saves user and assistant message together', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'new-msg-id' }),
      });

      const service = new ChatPersistenceService('workspace123');
      const userMsg = { role: 'user' as const, content: 'Hello' };
      const assistantMsg = { role: 'assistant' as const, content: 'Hi!' };

      const result = await service.saveMessagePair(userMsg, assistantMsg);

      expect(fetch).toHaveBeenCalledWith(
        '/api/workspace/workspace123/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Hello',
            response: 'Hi!',
          }),
        })
      );
      expect(result).toEqual({ id: 'new-msg-id' });
    });

    it('handles array content format', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'new-msg-id' }),
      });

      const service = new ChatPersistenceService('workspace123');
      const userMsg = {
        role: 'user' as const,
        content: [{ type: 'text', text: 'Hello' }],
      };
      const assistantMsg = {
        role: 'assistant' as const,
        content: [{ type: 'text', text: 'Hi!' }],
      };

      await service.saveMessagePair(userMsg, assistantMsg);

      expect(fetch).toHaveBeenCalledWith(
        '/api/workspace/workspace123/messages',
        expect.objectContaining({
          body: JSON.stringify({
            prompt: 'Hello',
            response: 'Hi!',
          }),
        })
      );
    });
  });

  describe('updateMessage', () => {
    it('updates an existing message', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const service = new ChatPersistenceService('workspace123');
      await service.updateMessage('msg1', 'Updated response');

      expect(fetch).toHaveBeenCalledWith(
        '/api/workspace/workspace123/messages/msg1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ response: 'Updated response' }),
        })
      );
    });
  });
});
