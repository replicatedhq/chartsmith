/**
 * Unit tests for chat message format conversion functions.
 */

import { CoreMessage } from 'ai';
import { Message } from '@/components/types';
import {
  aiMessageToMessage,
  messageToAIMessages,
  messagesToAIMessages,
  MessageMetadata,
} from '../chat';

describe('chat message conversion', () => {
  describe('aiMessageToMessage', () => {
    it('should convert user message correctly', () => {
      const aiMessage: CoreMessage = {
        role: 'user',
        content: 'Hello, world!',
      } as CoreMessage;

      const metadata: MessageMetadata = {
        workspaceId: 'ws-123',
        userId: 'user-456',
      };

      const result = aiMessageToMessage(aiMessage, metadata);

      expect(result.prompt).toBe('Hello, world!');
      expect(result.response).toBeUndefined();
      expect(result.isComplete).toBe(true);
      expect(result.workspaceId).toBe('ws-123');
      expect(result.userId).toBe('user-456');
      expect(result.id).toBeDefined();
    });

    it('should convert assistant message correctly', () => {
      const aiMessage: CoreMessage = {
        role: 'assistant',
        content: 'Hi there!',
      } as CoreMessage;

      const result = aiMessageToMessage(aiMessage);

      expect(result.prompt).toBe('');
      expect(result.response).toBe('Hi there!');
      expect(result.isComplete).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('should handle array content format', () => {
      const aiMessage: CoreMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: ' world!' },
        ],
      } as CoreMessage;

      const result = aiMessageToMessage(aiMessage);

      expect(result.prompt).toBe('Hello world!');
    });

    it('should preserve metadata', () => {
      const aiMessage: CoreMessage = {
        role: 'user',
        content: 'Test',
      } as CoreMessage;

      const metadata: MessageMetadata = {
        workspaceId: 'ws-123',
        responsePlanId: 'plan-456',
        responseRenderId: 'render-789',
        isApplied: true,
      };

      const result = aiMessageToMessage(aiMessage, metadata);

      expect(result.workspaceId).toBe('ws-123');
      expect(result.responsePlanId).toBe('plan-456');
      expect(result.responseRenderId).toBe('render-789');
      expect(result.isApplied).toBe(true);
    });

    it('should throw error for unsupported role', () => {
      const aiMessage = {
        role: 'system',
        content: 'System message',
      } as CoreMessage;

      expect(() => aiMessageToMessage(aiMessage)).toThrow('Unsupported message role');
    });
  });

  describe('messageToAIMessages', () => {
    it('should convert message with prompt only', () => {
      const message: Message = {
        id: 'msg-123',
        prompt: 'Hello',
        response: undefined,
        isComplete: true,
      };

      const result = messageToAIMessages(message);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello');
    });

    it('should convert message with response', () => {
      const message: Message = {
        id: 'msg-123',
        prompt: 'Hello',
        response: 'Hi there!',
        isComplete: true,
      };

      const result = messageToAIMessages(message);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello');
      expect(result[1].role).toBe('assistant');
      expect(result[1].content).toBe('Hi there!');
    });

    it('should handle empty message', () => {
      const message: Message = {
        id: 'msg-123',
        prompt: '',
        response: '',
        isComplete: true,
      };

      const result = messageToAIMessages(message);

      expect(result).toHaveLength(0);
    });
  });

  describe('messagesToAIMessages', () => {
    it('should convert empty array', () => {
      const result = messagesToAIMessages([]);
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

      const result = messagesToAIMessages(messages);

      expect(result).toHaveLength(4); // 2 user + 2 assistant
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello');
      expect(result[1].role).toBe('assistant');
      expect(result[1].content).toBe('Hi');
      expect(result[2].role).toBe('user');
      expect(result[2].content).toBe('How are you?');
      expect(result[3].role).toBe('assistant');
      expect(result[3].content).toBe('Good!');
    });
  });
});

