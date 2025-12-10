import { POST as planPOST } from '@/app/api/llm/plan/route';
import { POST as executeActionPOST } from '@/app/api/llm/execute-action/route';
import { POST as cleanupValuesPOST } from '@/app/api/llm/cleanup-values/route';
import { POST as expandPOST } from '@/app/api/llm/expand/route';
import { POST as summarizePOST } from '@/app/api/llm/summarize/route';
import { POST as chatPOST } from '@/app/api/chat/route';
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
  const { getModel } = jest.requireMock('@/lib/llm/registry');
  const { checkApiAuth } = jest.requireMock('@/lib/auth/api-guard');
  const { getWorkspace } = jest.requireMock('@/lib/workspace/workspace');

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
    it('should return streaming response for valid request with messages', async () => {
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
      expect(checkApiAuth).toHaveBeenCalled();
      expect(getWorkspace).toHaveBeenCalledWith('test-workspace');
      expect(getModel).toHaveBeenCalled();
      expect(mockStreamText).toHaveBeenCalled();
    });

    it('should return 401 when not authorized', async () => {
      checkApiAuth.mockReturnValueOnce({
        isAuthorized: false,
        errorResponse: new Response('Unauthorized', { status: 401 }),
      });

      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'test-workspace',
          messages: [{ role: 'user', content: 'Test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await planPOST(request);
      expect(response.status).toBe(401);
    });

    it('should use custom modelId when provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'test-workspace',
          modelId: 'custom-model-id',
          messages: [{ role: 'user', content: 'Test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      await planPOST(request);
      expect(getModel).toHaveBeenCalledWith('custom-model-id');
    });

    it('should return 400 when workspaceId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 when messages is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'test-workspace',
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
          workspaceId: 'non-existent',
          messages: [{ role: 'user', content: 'Test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response.status).toBe(404);
    });

    it('should pass messages to streamText', async () => {
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

    it('should return 401 when not authorized', async () => {
      checkApiAuth.mockReturnValueOnce({
        isAuthorized: false,
        errorResponse: new Response('Unauthorized', { status: 401 }),
      });

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await executeActionPOST(request);
      expect(response.status).toBe(401);
    });

    it('should handle empty content messages', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Response',
        toolCalls: [],
      });

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: '' },
            { role: 'assistant', content: null },
          ],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      expect(response.status).toBe(200);
    });

    it('should return response without toolCalls when none generated', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'No tools needed',
        toolCalls: [],
      });

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Just respond without tools' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.content).toBe('No tools needed');
      expect(data.toolCalls).toBeUndefined();
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

  describe('/api/llm/cleanup-values', () => {
    it('should return cleaned YAML for valid request', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'cleaned: yaml',
      });

      const request = new NextRequest('http://localhost:3000/api/llm/cleanup-values', {
        method: 'POST',
        body: JSON.stringify({
          valuesYAML: 'key: value\nkey: duplicate',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await cleanupValuesPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('cleanedYAML');
      expect(mockGenerateText).toHaveBeenCalled();
    });

    it('should return 401 when not authorized', async () => {
      checkApiAuth.mockReturnValueOnce({
        isAuthorized: false,
        errorResponse: new Response('Unauthorized', { status: 401 }),
      });

      const request = new NextRequest('http://localhost:3000/api/llm/cleanup-values', {
        method: 'POST',
        body: JSON.stringify({
          valuesYAML: 'key: value',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await cleanupValuesPOST(request);
      expect(response.status).toBe(401);
    });

    it('should handle whitespace-only valuesYAML as empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/cleanup-values', {
        method: 'POST',
        body: JSON.stringify({
          valuesYAML: '   \n\t  ',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await cleanupValuesPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.cleanedYAML).toBe('');
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('should return empty result for empty valuesYAML', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/cleanup-values', {
        method: 'POST',
        body: JSON.stringify({
          valuesYAML: '',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await cleanupValuesPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.cleanedYAML).toBe('');
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('should use messages from Go if provided', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'cleaned: yaml',
      });

      const request = new NextRequest('http://localhost:3000/api/llm/cleanup-values', {
        method: 'POST',
        body: JSON.stringify({
          valuesYAML: 'key: value',
          messages: [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'Clean this' },
          ],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await cleanupValuesPOST(request);
      expect(response.status).toBe(200);
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
          ]),
        })
      );
    });
  });

  describe('/api/llm/expand', () => {
    it('should return expanded prompt for valid request', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Expanded prompt with more details',
      });

      const request = new NextRequest('http://localhost:3000/api/llm/expand', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Add nginx',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await expandPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('expandedPrompt');
      expect(data.expandedPrompt).toBe('Expanded prompt with more details');
      expect(mockGenerateText).toHaveBeenCalled();
    });

    it('should return 401 when not authorized', async () => {
      checkApiAuth.mockReturnValueOnce({
        isAuthorized: false,
        errorResponse: new Response('Unauthorized', { status: 401 }),
      });

      const request = new NextRequest('http://localhost:3000/api/llm/expand', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await expandPOST(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 when prompt is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/expand', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await expandPOST(request);
      expect(response.status).toBe(400);
    });

    it('should use custom modelId when provided', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Expanded',
      });

      const request = new NextRequest('http://localhost:3000/api/llm/expand', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test',
          modelId: 'custom-model',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      await expandPOST(request);
      expect(getModel).toHaveBeenCalledWith('custom-model');
    });

    it('should handle errors gracefully', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('AI SDK error'));

      const request = new NextRequest('http://localhost:3000/api/llm/expand', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await expandPOST(request);
      expect(response.status).toBe(500);
    });
  });

  describe('/api/llm/summarize', () => {
    it('should return summary for valid request', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'This is a summary of the content',
      });

      const request = new NextRequest('http://localhost:3000/api/llm/summarize', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Long content to summarize...',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await summarizePOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('summary');
      expect(data.summary).toBe('This is a summary of the content');
      expect(mockGenerateText).toHaveBeenCalled();
    });

    it('should return 401 when not authorized', async () => {
      checkApiAuth.mockReturnValueOnce({
        isAuthorized: false,
        errorResponse: new Response('Unauthorized', { status: 401 }),
      });

      const request = new NextRequest('http://localhost:3000/api/llm/summarize', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test content',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await summarizePOST(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 when content is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/summarize', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await summarizePOST(request);
      expect(response.status).toBe(400);
    });

    it('should use custom modelId when provided', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Summary',
      });

      const request = new NextRequest('http://localhost:3000/api/llm/summarize', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test',
          modelId: 'custom-model',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      await summarizePOST(request);
      expect(getModel).toHaveBeenCalledWith('custom-model');
    });

    it('should handle errors gracefully', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('AI SDK error'));

      const request = new NextRequest('http://localhost:3000/api/llm/summarize', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test content',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await summarizePOST(request);
      expect(response.status).toBe(500);
    });
  });

  describe('/api/chat', () => {
    it('should return streaming response for valid request', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          workspaceId: 'test-workspace',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await chatPOST(request);
      
      expect(response).toBeDefined();
      expect(checkApiAuth).toHaveBeenCalled();
      expect(getWorkspace).toHaveBeenCalledWith('test-workspace');
      expect(mockStreamText).toHaveBeenCalled();
    });

    it('should return 401 when not authorized', async () => {
      checkApiAuth.mockReturnValueOnce({
        isAuthorized: false,
        errorResponse: new Response('Unauthorized', { status: 401 }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          workspaceId: 'test-workspace',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await chatPOST(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 when workspaceId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await chatPOST(request);
      expect(response.status).toBe(400);
    });

    it('should return 404 when workspace not found', async () => {
      getWorkspace.mockResolvedValueOnce(null);
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          workspaceId: 'non-existent',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await chatPOST(request);
      expect(response.status).toBe(404);
    });

    it('should use custom modelId when provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          workspaceId: 'test-workspace',
          modelId: 'custom-chat-model',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      await chatPOST(request);
      expect(getModel).toHaveBeenCalledWith('custom-chat-model');
    });

    it('should include tools in streamText call', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'What is the latest kubernetes version?' }],
          workspaceId: 'test-workspace',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      await chatPOST(request);
      
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            latest_subchart_version: expect.any(Object),
            latest_kubernetes_version: expect.any(Object),
          }),
        })
      );
    });

    it('should pass messages to streamText', async () => {
      const testMessages = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Help me with Helm' },
      ];

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: testMessages,
          workspaceId: 'test-workspace',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      await chatPOST(request);
      
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: testMessages,
        })
      );
    });
  });

});

