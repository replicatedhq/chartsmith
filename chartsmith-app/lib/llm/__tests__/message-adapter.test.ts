/**
 * Unit tests for the message adapter utilities.
 * These tests verify the conversion between database messages and AI SDK format.
 */

import { toAIMessage, toAIMessages, fromAIMessages, createMessageFromAI } from '../message-adapter';

describe('Message Adapter', () => {
  describe('toAIMessage', () => {
    it('converts database message to AI format', () => {
      const dbMessage = {
        id: 'msg-123',
        prompt: 'Hello, how do I use Helm?',
        response: 'Helm is a package manager for Kubernetes...',
        createdAt: new Date('2024-01-01'),
        isComplete: true,
        isIntentComplete: true,
        isCanceled: false,
      };

      const aiMessages = toAIMessage(dbMessage);

      expect(aiMessages).toHaveLength(2);
      expect(aiMessages[0].role).toBe('user');
      expect(aiMessages[0].content).toBe('Hello, how do I use Helm?');
      expect(aiMessages[1].role).toBe('assistant');
      expect(aiMessages[1].content).toBe('Helm is a package manager for Kubernetes...');
    });

    it('handles messages without response', () => {
      const dbMessage = {
        id: 'msg-123',
        prompt: 'Hello',
        response: '', // Empty response
        isComplete: false,
        isIntentComplete: false,
        isCanceled: false,
      };

      const aiMessages = toAIMessage(dbMessage);

      // Only user message should be created
      expect(aiMessages).toHaveLength(1);
      expect(aiMessages[0].role).toBe('user');
    });

    it('handles messages without prompt', () => {
      const dbMessage = {
        id: 'msg-123',
        prompt: '',
        response: 'Some response',
        isComplete: true,
        isIntentComplete: true,
        isCanceled: false,
      };

      const aiMessages = toAIMessage(dbMessage);

      // Only assistant message should be created
      expect(aiMessages).toHaveLength(1);
      expect(aiMessages[0].role).toBe('assistant');
    });
  });

  describe('toAIMessages', () => {
    it('skips messages with plan responses', () => {
      const messages = [
        {
          id: 'msg-1',
          prompt: 'Chat message',
          response: 'Chat response',
          isComplete: true,
          isIntentComplete: true,
          isCanceled: false,
        },
        {
          id: 'msg-2',
          prompt: 'Plan message',
          response: 'Plan response',
          responsePlanId: 'plan-123', // This should be skipped
          isComplete: true,
          isIntentComplete: true,
          isCanceled: false,
        },
      ];

      const aiMessages = toAIMessages(messages);

      // Only the chat message should be converted (2 AI messages: user + assistant)
      expect(aiMessages).toHaveLength(2);
      expect(aiMessages[0].content).toBe('Chat message');
      expect(aiMessages[1].content).toBe('Chat response');
    });

    it('skips messages with render responses', () => {
      const messages = [
        {
          id: 'msg-1',
          prompt: 'Chat message',
          response: 'Chat response',
          isComplete: true,
          isIntentComplete: true,
          isCanceled: false,
        },
        {
          id: 'msg-2',
          prompt: 'Render message',
          response: 'Render response',
          responseRenderId: 'render-123', // This should be skipped
          isComplete: true,
          isIntentComplete: true,
          isCanceled: false,
        },
      ];

      const aiMessages = toAIMessages(messages);

      expect(aiMessages).toHaveLength(2);
      expect(aiMessages[0].content).toBe('Chat message');
    });

    it('skips messages with conversion responses', () => {
      const messages = [
        {
          id: 'msg-1',
          prompt: 'Chat message',
          response: 'Chat response',
          isComplete: true,
          isIntentComplete: true,
          isCanceled: false,
        },
        {
          id: 'msg-2',
          prompt: 'Conversion message',
          response: 'Conversion response',
          responseConversionId: 'conversion-123', // This should be skipped
          isComplete: true,
          isIntentComplete: true,
          isCanceled: false,
        },
      ];

      const aiMessages = toAIMessages(messages);

      expect(aiMessages).toHaveLength(2);
      expect(aiMessages[0].content).toBe('Chat message');
    });
  });

  describe('fromAIMessages', () => {
    it('extracts prompt and response from AI messages', () => {
      const userMessage = {
        id: 'user-1',
        role: 'user' as const,
        content: 'What is Helm?',
      };
      const assistantMessage = {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'Helm is a package manager for Kubernetes.',
      };

      const result = fromAIMessages(userMessage, assistantMessage);

      expect(result.prompt).toBe('What is Helm?');
      expect(result.response).toBe('Helm is a package manager for Kubernetes.');
    });
  });

  describe('createMessageFromAI', () => {
    it('creates a database-compatible message object', () => {
      const userMessage = {
        id: 'user-1',
        role: 'user' as const,
        content: 'What is Helm?',
      };
      const assistantMessage = {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'Helm is a package manager for Kubernetes.',
      };

      const result = createMessageFromAI(userMessage, assistantMessage);

      expect(result.prompt).toBe('What is Helm?');
      expect(result.response).toBe('Helm is a package manager for Kubernetes.');
      expect(result.isComplete).toBe(true);
      expect(result.isIntentComplete).toBe(true);
    });
  });
});
