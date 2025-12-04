/**
 * Chat API Route Tests
 * 
 * Tests for the /api/chat endpoint.
 * These tests verify request validation and error handling
 * without making actual API calls to OpenRouter.
 */

// Suppress console.error during error handling tests (expected errors)
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

// Mock the AI SDK before importing the route
jest.mock('ai', () => ({
  streamText: jest.fn(),
  convertToModelMessages: jest.fn((messages) => messages),
  UIMessage: {},
}));

jest.mock('@/lib/ai', () => ({
  getModel: jest.fn(() => ({ modelId: 'test-model' })),
  isValidProvider: jest.fn((p) => ['anthropic', 'openai'].includes(p)),
  isValidModel: jest.fn((m) => m.startsWith('anthropic/') || m.startsWith('openai/')),
  CHARTSMITH_SYSTEM_PROMPT: 'Test system prompt',
  MAX_STREAMING_DURATION: 60,
}));

import { POST } from '../route';
import { streamText } from 'ai';
import { getModel, isValidProvider, isValidModel } from '@/lib/ai';

describe('POST /api/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock streamText to return a mock response
    (streamText as jest.Mock).mockReturnValue({
      toTextStreamResponse: () => new Response('streamed response', {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    });
  });

  describe('Request Validation', () => {
    it('should return 400 if messages array is missing', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details).toContain('messages');
    });

    it('should return 400 if messages is not an array', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: 'not an array' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for invalid provider', async () => {
      (isValidProvider as jest.Mock).mockReturnValue(false);

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          provider: 'invalid-provider',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid provider');
    });

    it('should return 400 for invalid model', async () => {
      (isValidModel as jest.Mock).mockReturnValue(false);

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'invalid/model',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid model');
    });
  });

  describe('Successful Requests', () => {
    beforeEach(() => {
      (isValidProvider as jest.Mock).mockReturnValue(true);
      (isValidModel as jest.Mock).mockReturnValue(true);
    });

    it('should accept valid request with messages only', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(streamText).toHaveBeenCalled();
    });

    it('should accept valid request with provider', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          provider: 'anthropic',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(getModel).toHaveBeenCalledWith('anthropic', undefined);
    });

    it('should accept valid request with provider and model', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          provider: 'anthropic',
          model: 'anthropic/claude-sonnet-4',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(getModel).toHaveBeenCalledWith('anthropic', 'anthropic/claude-sonnet-4');
    });

    it('should return streaming response', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const response = await POST(request);

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for missing API key error', async () => {
      (isValidProvider as jest.Mock).mockReturnValue(true);
      (getModel as jest.Mock).mockImplementation(() => {
        throw new Error('OPENROUTER_API_KEY environment variable is not set');
      });

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Configuration error');
    });

    it('should return 500 for unexpected errors', async () => {
      (isValidProvider as jest.Mock).mockReturnValue(true);
      (isValidModel as jest.Mock).mockReturnValue(true);
      // Reset getModel to succeed, but streamText fails
      (getModel as jest.Mock).mockReturnValue({ modelId: 'test-model' });
      (streamText as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected network error');
      });

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process request');
      expect(data.details).toContain('network error');
    });
  });
});

