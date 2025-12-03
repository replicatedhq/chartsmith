import { POST as planPOST } from '@/app/api/llm/plan/route';
import { POST as executeActionPOST } from '@/app/api/llm/execute-action/route';
import { POST as conversationalPOST } from '@/app/api/llm/conversational/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/llm/registry', () => ({
  getModel: jest.fn(() => ({
    provider: 'mock-provider',
  })),
}));

jest.mock('@/lib/auth/api-guard', () => ({
  checkApiAuth: jest.fn(() => ({
    isAuthorized: true,
  })),
}));

jest.mock('@/lib/workspace/workspace', () => ({
  getWorkspace: jest.fn(() => ({
    id: 'test-workspace',
    name: 'Test Workspace',
  })),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock AI SDK
const mockStreamText = jest.fn();
const mockGenerateText = jest.fn();

jest.mock('ai', () => ({
  streamText: (...args: any[]) => mockStreamText(...args),
  generateText: (...args: any[]) => mockGenerateText(...args),
}));

describe('LLM API Routes', () => {
  const { getModel } = require('@/lib/llm/registry');
  const { checkApiAuth } = require('@/lib/auth/api-guard');
  const { getWorkspace } = require('@/lib/workspace/workspace');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    checkApiAuth.mockReturnValue({ isAuthorized: true });
    getWorkspace.mockResolvedValue({ id: 'test-workspace', name: 'Test Workspace' });
    
    // Mock streamText response
    mockStreamText.mockReturnValue({
      toTextStreamResponse: jest.fn(() => new Response('streaming response', {
        headers: { 'Content-Type': 'text/event-stream' },
      })),
    });
    
    // Mock generateText response
    mockGenerateText.mockResolvedValue({
      text: 'Generated text',
      toolCalls: [],
    });
  });

  describe('/api/llm/plan', () => {
    it('should return streaming response for valid request', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
          workspaceId: 'test-workspace',
          chartContext: 'Test chart context',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      
      expect(response).toBeDefined();
      expect(checkApiAuth).toHaveBeenCalled();
      expect(getWorkspace).toHaveBeenCalledWith('test-workspace');
      expect(getModel).toHaveBeenCalled();
      expect(mockStreamText).toHaveBeenCalled();
    });

    it('should return 400 when workspaceId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response.status).toBe(400);
    });

    it('should return 404 when workspace not found', async () => {
      getWorkspace.mockResolvedValueOnce(null);
      
      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
          workspaceId: 'non-existent',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response.status).toBe(404);
    });

    it('should handle messages array mode', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'test-workspace',
          messages: [
            { role: 'system', content: 'System message' },
            { role: 'user', content: 'User message' },
          ],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response).toBeDefined();
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
    });
  });

  describe('/api/llm/execute-action', () => {
    it('should return ExecuteActionResponse format', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Action executed',
        toolCalls: [
          {
            toolCallId: 'call_123',
            toolName: 'text_editor_20241022',
            args: { command: 'view', path: 'test.yaml' },
          },
        ],
      });

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Update test.yaml' },
          ],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('toolCalls');
      expect(Array.isArray(data.toolCalls)).toBe(true);
      if (data.toolCalls && data.toolCalls.length > 0) {
        expect(data.toolCalls[0]).toHaveProperty('id');
        expect(data.toolCalls[0]).toHaveProperty('name');
        expect(data.toolCalls[0]).toHaveProperty('args');
        expect(typeof data.toolCalls[0].args).toBe('string'); // Must be JSON string
      }
    });

    it('should return 400 when messages array is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      expect(response.status).toBe(400);
    });

    it('should handle tool calls correctly', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Action executed',
        toolCalls: [
          {
            toolCallId: 'call_abc',
            toolName: 'text_editor_20241022',
            input: { command: 'str_replace', path: 'test.yaml', old_str: 'old', new_str: 'new' },
          },
        ],
      });

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Update file' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      const data = await response.json();
      
      expect(data.toolCalls).toBeDefined();
      expect(data.toolCalls[0].id).toBe('call_abc');
      expect(data.toolCalls[0].name).toBe('text_editor_20241022');
      expect(() => JSON.parse(data.toolCalls[0].args)).not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('AI SDK error'));

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
    });
  });

  describe('/api/llm/conversational', () => {
    it('should return streaming response', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/conversational', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' },
          ],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await conversationalPOST(request);
      
      expect(response).toBeDefined();
      expect(mockStreamText).toHaveBeenCalled();
    });

    it('should return 400 when messages array is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/conversational', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await conversationalPOST(request);
      expect(response.status).toBe(400);
    });

    it('should handle model override', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/conversational', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          modelId: 'custom-model',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await conversationalPOST(request);
      expect(getModel).toHaveBeenCalledWith('custom-model');
    });
  });
});

