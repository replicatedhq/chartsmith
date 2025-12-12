/**
 * Unit tests for chat message format conversion functions.
 *
 * These tests cover conversion between AI SDK v5 UIMessage format
 * and our internal Message format.
 */

import { UIMessage } from 'ai';
import { Message } from '@/components/types';
import {
  uiMessageToMessage,
  messageToUIMessages,
  messagesToUIMessages,
  extractTextFromParts,
  MessageMetadata,
  // Legacy aliases for backward compatibility
  aiMessageToMessage,
  messageToAIMessages,
  messagesToAIMessages,
} from '../chat';

describe('chat message conversion', () => {
  describe('extractTextFromParts', () => {
    it('should extract text from parts array', () => {
      const parts: UIMessage['parts'] = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world!' },
      ];

      const result = extractTextFromParts(parts);

      expect(result).toBe('Hello world!');
    });

    it('should return empty string for empty parts', () => {
      const result = extractTextFromParts([]);
      expect(result).toBe('');
    });

    it('should return empty string for undefined parts', () => {
      const result = extractTextFromParts(undefined as any);
      expect(result).toBe('');
    });

    it('should filter non-text parts', () => {
      const parts: UIMessage['parts'] = [
        { type: 'text', text: 'Hello' },
        { type: 'reasoning', reasoning: 'thinking...' } as any,
        { type: 'text', text: ' world!' },
      ];

      const result = extractTextFromParts(parts);

      expect(result).toBe('Hello world!');
    });
  });

  describe('uiMessageToMessage', () => {
    it('should convert user message correctly', () => {
      const uiMessage: UIMessage = {
        id: 'msg-123',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, world!' }],
      };

      const metadata: MessageMetadata = {
        workspaceId: 'ws-123',
        userId: 'user-456',
      };

      const result = uiMessageToMessage(uiMessage, metadata);

      expect(result.prompt).toBe('Hello, world!');
      expect(result.response).toBeUndefined();
      expect(result.isComplete).toBe(true);
      expect(result.workspaceId).toBe('ws-123');
      expect(result.userId).toBe('user-456');
      expect(result.id).toBe('msg-123');
    });

    it('should convert assistant message correctly', () => {
      const uiMessage: UIMessage = {
        id: 'msg-456',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi there!' }],
      };

      const result = uiMessageToMessage(uiMessage);

      expect(result.prompt).toBe('');
      expect(result.response).toBe('Hi there!');
      expect(result.isComplete).toBe(true);
      expect(result.id).toBe('msg-456');
    });

    it('should handle multiple text parts', () => {
      const uiMessage: UIMessage = {
        id: 'msg-789',
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: ' world!' },
        ],
      };

      const result = uiMessageToMessage(uiMessage);

      expect(result.prompt).toBe('Hello world!');
    });

    it('should preserve metadata', () => {
      const uiMessage: UIMessage = {
        id: 'msg-123',
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
      };

      const metadata: MessageMetadata = {
        workspaceId: 'ws-123',
        responsePlanId: 'plan-456',
        responseRenderId: 'render-789',
        isApplied: true,
      };

      const result = uiMessageToMessage(uiMessage, metadata);

      expect(result.workspaceId).toBe('ws-123');
      expect(result.responsePlanId).toBe('plan-456');
      expect(result.responseRenderId).toBe('render-789');
      expect(result.isApplied).toBe(true);
    });

    it('should throw error for unsupported role', () => {
      const uiMessage = {
        id: 'msg-123',
        role: 'system',
        parts: [{ type: 'text', text: 'System message' }],
      } as UIMessage;

      expect(() => uiMessageToMessage(uiMessage)).toThrow('Unsupported message role');
    });

    it('should generate id if not provided', () => {
      const uiMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
      } as UIMessage;

      const result = uiMessageToMessage(uiMessage);

      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(0);
    });
  });

  describe('messageToUIMessages', () => {
    it('should convert message with prompt only', () => {
      const message: Message = {
        id: 'msg-123',
        prompt: 'Hello',
        response: undefined,
        isComplete: true,
      };

      const result = messageToUIMessages(message);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].parts).toEqual([{ type: 'text', text: 'Hello' }]);
    });

    it('should convert message with response', () => {
      const message: Message = {
        id: 'msg-123',
        prompt: 'Hello',
        response: 'Hi there!',
        isComplete: true,
      };

      const result = messageToUIMessages(message);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[0].parts).toEqual([{ type: 'text', text: 'Hello' }]);
      expect(result[1].role).toBe('assistant');
      expect(result[1].parts).toEqual([{ type: 'text', text: 'Hi there!' }]);
    });

    it('should handle empty message', () => {
      const message: Message = {
        id: 'msg-123',
        prompt: '',
        response: '',
        isComplete: true,
      };

      const result = messageToUIMessages(message);

      expect(result).toHaveLength(0);
    });

    it('should generate correct message IDs', () => {
      const message: Message = {
        id: 'msg-123',
        prompt: 'Hello',
        response: 'Hi',
        isComplete: true,
      };

      const result = messageToUIMessages(message);

      expect(result[0].id).toBe('msg-123-user');
      expect(result[1].id).toBe('msg-123-assistant');
    });
  });

  describe('messagesToUIMessages', () => {
    it('should convert empty array', () => {
      const result = messagesToUIMessages([]);
      expect(result).toHaveLength(0);
    });

    it('should convert multiple messages', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          prompt: 'Hello',
          response: 'Hi',
          isComplete: true,
        },
        {
          id: 'msg-2',
          prompt: 'How are you?',
          response: 'Good!',
          isComplete: true,
        },
      ];

      const result = messagesToUIMessages(messages);

      expect(result).toHaveLength(4); // 2 user + 2 assistant
      expect(result[0].role).toBe('user');
      expect(result[0].parts).toEqual([{ type: 'text', text: 'Hello' }]);
      expect(result[1].role).toBe('assistant');
      expect(result[1].parts).toEqual([{ type: 'text', text: 'Hi' }]);
      expect(result[2].role).toBe('user');
      expect(result[2].parts).toEqual([{ type: 'text', text: 'How are you?' }]);
      expect(result[3].role).toBe('assistant');
      expect(result[3].parts).toEqual([{ type: 'text', text: 'Good!' }]);
    });
  });

  describe('legacy aliases', () => {
    it('aiMessageToMessage should work as alias for uiMessageToMessage', () => {
      const uiMessage: UIMessage = {
        id: 'msg-123',
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
      };

      const result = aiMessageToMessage(uiMessage);

      expect(result.prompt).toBe('Test');
    });

    it('messageToAIMessages should work as alias for messageToUIMessages', () => {
      const message: Message = {
        id: 'msg-123',
        prompt: 'Hello',
        response: undefined,
        isComplete: true,
      };

      const result = messageToAIMessages(message);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });

    it('messagesToAIMessages should work as alias for messagesToUIMessages', () => {
      const result = messagesToAIMessages([]);
      expect(result).toHaveLength(0);
    });
  });
});
