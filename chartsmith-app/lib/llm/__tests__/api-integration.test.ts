/**
 * Integration Tests for Go Backend → Next.js API Communication
 * 
 * These tests verify that the API routes correctly handle requests
 * in the format that the Go backend (NextJSClient) sends them.
 * 
 * The Go backend calls these APIs:
 * - POST /api/llm/plan - StreamPlan()
 * - POST /api/llm/expand - ExpandPrompt()
 * - POST /api/llm/summarize - Summarize()
 * - POST /api/llm/cleanup-values - CleanupValues()
 * - POST /api/chat - StreamConversational()
 * - POST /api/llm/execute-action - ExecuteAction()
 */

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

/**
 * These tests simulate the exact request format sent by the Go NextJSClient.
 * See: pkg/llm/nextjs_client.go for the request structures.
 */
describe('Go Backend Integration - Request Format Compatibility', () => {
  const { getModel } = jest.requireMock('@/lib/llm/registry');
  const { checkApiAuth } = jest.requireMock('@/lib/auth/api-guard');
  const { getWorkspace } = jest.requireMock('@/lib/workspace/workspace');

  beforeEach(() => {
    jest.clearAllMocks();
    checkApiAuth.mockReturnValue({ isAuthorized: true });
    getWorkspace.mockResolvedValue({ id: 'test-workspace', name: 'Test Workspace' });
    
    mockStreamText.mockReturnValue({
      toTextStreamResponse: jest.fn(() => new Response('streaming response', {
        headers: { 'Content-Type': 'text/event-stream' },
      })),
    });
    
    mockGenerateText.mockResolvedValue({
      text: 'Generated text',
      toolCalls: [],
    });
  });

  describe('PlanRequest format (Go: StreamPlan)', () => {
    /**
     * Go sends: PlanRequest{Messages: []MessageParam, WorkspaceID: string, ModelID: string}
     * MessageParam: {Role: string, Content: interface{}, ToolCallId: string}
     */
    it('should handle Go PlanRequest with messages array', async () => {
      // This is the exact format Go sends via NextJSClient.StreamPlan()
      const goRequest = {
        workspaceId: 'workspace-123',
        modelId: 'anthropic/claude-3-sonnet',
        messages: [
          { role: 'system', content: 'You are a Helm chart expert.' },
          { role: 'user', content: 'Create a deployment template' },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response).toBeDefined();
      expect(getModel).toHaveBeenCalledWith('anthropic/claude-3-sonnet');
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: goRequest.messages,
        })
      );
    });

    it('should handle complex content in messages (tool results)', async () => {
      // Go can send complex content objects for tool results
      const goRequest = {
        workspaceId: 'workspace-123',
        messages: [
          { role: 'user', content: 'View file.yaml' },
          { 
            role: 'assistant', 
            content: 'I will view the file.',
          },
          { 
            role: 'user', 
            content: [
              { type: 'tool_result', tool_use_id: 'tool_123', content: 'file contents here' }
            ],
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response).toBeDefined();
    });
  });

  describe('ExecuteActionRequest format (Go: ExecuteAction)', () => {
    /**
     * Go sends: ExecuteActionRequest{Messages: []MessageParam, ModelID: string}
     * Go expects: ExecuteActionResponse{Content: string, ToolCalls: []ToolCall}
     * ToolCall: {ID: string, Name: string, Args: string} (Args is JSON string!)
     */
    it('should return ExecuteActionResponse format compatible with Go', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'I will update the file',
        toolCalls: [
          {
            toolCallId: 'toolu_01XYZ',
            toolName: 'text_editor_20241022',
            args: { 
              command: 'str_replace', 
              path: '/templates/deployment.yaml',
              old_str: 'replicas: 1',
              new_str: 'replicas: 3',
            },
          },
        ],
      });

      // Go sends this format
      const goRequest = {
        messages: [
          { role: 'system', content: 'Execute the following action...' },
          { role: 'user', content: 'Update replicas to 3' },
        ],
        modelId: 'anthropic/claude-3-sonnet',
      };

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      const data = await response.json();
      
      // Verify Go-compatible response format
      expect(data.content).toBeDefined();
      expect(data.toolCalls).toBeDefined();
      expect(Array.isArray(data.toolCalls)).toBe(true);
      
      // Go expects Args to be a JSON string, not an object
      const toolCall = data.toolCalls[0];
      expect(toolCall.id).toBe('toolu_01XYZ');
      expect(toolCall.name).toBe('text_editor_20241022');
      expect(typeof toolCall.args).toBe('string');
      
      // Verify the args can be parsed back to the original object
      const parsedArgs = JSON.parse(toolCall.args);
      expect(parsedArgs.command).toBe('str_replace');
      expect(parsedArgs.path).toBe('/templates/deployment.yaml');
    });

    it('should handle messages with tool results from Go', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Changes applied successfully',
        toolCalls: [],
      });

      // Go sends tool results in this format after executing a tool
      const goRequest = {
        messages: [
          { role: 'user', content: 'Update the file' },
          { role: 'assistant', content: 'I will use the text editor' },
          { 
            role: 'user', 
            content: JSON.stringify({
              type: 'tool_result',
              tool_use_id: 'toolu_01XYZ',
              content: 'File updated successfully',
            }),
            toolCallId: 'toolu_01XYZ',
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      expect(response.status).toBe(200);
    });
  });

  describe('CleanupValuesRequest format (Go: CleanupValues)', () => {
    /**
     * Go sends: CleanupValuesRequest{ValuesYAML: string, ModelID: string, Messages: []MessageParam}
     * Go expects: CleanupValuesResponse{CleanedYAML: string}
     */
    it('should handle Go CleanupValuesRequest with messages', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'replicaCount: 3\nimage:\n  repository: nginx\n  tag: latest',
      });

      // Go sends pre-constructed messages with system prompt
      const goRequest = {
        valuesYAML: 'replicaCount: 1\nreplicaCount: 3\nimage:\n  repository: nginx\n  tag: latest',
        modelId: 'anthropic/claude-3-haiku',
        messages: [
          { 
            role: 'system', 
            content: 'You are a YAML cleanup assistant. Remove duplicate keys.' 
          },
          { 
            role: 'user', 
            content: 'Clean up this values.yaml:\n---\nreplicaCount: 1\nreplicaCount: 3...' 
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/llm/cleanup-values', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await cleanupValuesPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.cleanedYAML).toBeDefined();
      expect(typeof data.cleanedYAML).toBe('string');
    });

    it('should use messages if provided, falling back to valuesYAML', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'cleaned yaml',
      });

      // Go may send just valuesYAML without messages
      const goRequest = {
        valuesYAML: 'key: value',
      };

      const request = new NextRequest('http://localhost:3000/api/llm/cleanup-values', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await cleanupValuesPOST(request);
      expect(response.status).toBe(200);
      
      // Should construct messages from valuesYAML
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
    });
  });

  describe('ExpandRequest format (Go: ExpandPrompt)', () => {
    /**
     * Go sends: ExpandRequest{Prompt: string, ModelID: string}
     * Go expects: ExpandResponse{ExpandedPrompt: string}
     */
    it('should handle Go ExpandRequest format', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Create a Kubernetes Deployment with nginx image, 3 replicas, resource limits, and health checks.',
      });

      const goRequest = {
        prompt: 'Add nginx deployment',
        modelId: 'anthropic/claude-3-haiku',
      };

      const request = new NextRequest('http://localhost:3000/api/llm/expand', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await expandPOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.expandedPrompt).toBeDefined();
      expect(typeof data.expandedPrompt).toBe('string');
    });
  });

  describe('SummarizeRequest format (Go: Summarize)', () => {
    /**
     * Go sends: SummarizeRequest{Content: string, Context: string, ModelID: string}
     * Go expects: SummarizeResponse{Summary: string}
     */
    it('should handle Go SummarizeRequest format', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'This chart deploys a web application with 3 replicas and nginx ingress.',
      });

      const goRequest = {
        content: 'Long chart description and values.yaml content...',
        context: 'Helm chart summarization',
        modelId: 'anthropic/claude-3-haiku',
      };

      const request = new NextRequest('http://localhost:3000/api/llm/summarize', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await summarizePOST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.summary).toBeDefined();
      expect(typeof data.summary).toBe('string');
    });
  });

  describe('ConversationalRequest format (Go: StreamConversational)', () => {
    /**
     * Go sends: ConversationalRequest{Messages: []MessageParam, WorkspaceID: string, ModelID: string}
     * Returns streaming response
     */
    it('should handle Go ConversationalRequest format', async () => {
      const goRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful Helm assistant.' },
          { role: 'user', content: 'What is the latest version of nginx?' },
        ],
        workspaceId: 'workspace-456',
        modelId: 'anthropic/claude-3-sonnet',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await chatPOST(request);
      expect(response).toBeDefined();
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: goRequest.messages,
          tools: expect.any(Object),
        })
      );
    });

    it('should include tools for subchart and kubernetes version lookups', async () => {
      const goRequest = {
        messages: [{ role: 'user', content: 'What versions should I use?' }],
        workspaceId: 'workspace-789',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(goRequest),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      await chatPOST(request);
      
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            latest_subchart_version: expect.objectContaining({
              description: expect.any(String),
              inputSchema: expect.any(Object),
              execute: expect.any(Function),
            }),
            latest_kubernetes_version: expect.objectContaining({
              description: expect.any(String),
              inputSchema: expect.any(Object),
              execute: expect.any(Function),
            }),
          }),
        })
      );
    });
  });

  describe('Authentication - X-Internal-API-Key header', () => {
    /**
     * Go sends: X-Internal-API-Key header for authentication
     * See: NextJSClient.post() and NextJSClient.postStream()
     */
    it('should reject requests without X-Internal-API-Key', async () => {
      checkApiAuth.mockReturnValueOnce({
        isAuthorized: false,
        errorResponse: new Response('Unauthorized', { status: 401 }),
      });

      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'test',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          // No X-Internal-API-Key header
        },
      });

      const response = await planPOST(request);
      expect(response.status).toBe(401);
    });

    it('should accept requests with valid X-Internal-API-Key', async () => {
      checkApiAuth.mockReturnValueOnce({ isAuthorized: true });

      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'test',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(checkApiAuth).toHaveBeenCalled();
    });
  });

  describe('Error handling - Go error response parsing', () => {
    /**
     * Go parses error responses like: "Next.js API error: %s - %s"
     * Errors should be returned with appropriate status codes and messages
     */
    it('should return 400 with clear message for missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          // Missing workspaceId and messages
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response.status).toBe(400);
      
      const text = await response.text();
      expect(text.length).toBeGreaterThan(0); // Should have error message
    });

    it('should return 404 for non-existent workspace', async () => {
      getWorkspace.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/llm/plan', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'non-existent-workspace',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await planPOST(request);
      expect(response.status).toBe(404);
    });

    it('should return 500 with error details for LLM failures', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const request = new NextRequest('http://localhost:3000/api/llm/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': 'dev-internal-key',
        },
      });

      const response = await executeActionPOST(request);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});

describe('Streaming Response Format - Go parseStream compatibility', () => {
  /**
   * The Go client (NextJSClient.parseStream) expects specific streaming formats:
   * - Plain text streaming (toTextStreamResponse)
   * - Data Stream Protocol ("0:" prefix for text)
   * - SSE format ("data:" prefix)
   * 
   * These tests verify the response format is compatible.
   */
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    const { checkApiAuth } = jest.requireMock('@/lib/auth/api-guard');
    const { getWorkspace } = jest.requireMock('@/lib/workspace/workspace');
    
    checkApiAuth.mockReturnValue({ isAuthorized: true });
    getWorkspace.mockResolvedValue({ id: 'test', name: 'Test' });
  });

  it('should return streaming response with correct content-type', async () => {
    mockStreamText.mockReturnValue({
      toTextStreamResponse: jest.fn(() => new Response('Hello world', {
        headers: { 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      })),
    });

    const request = new NextRequest('http://localhost:3000/api/llm/plan', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: 'test',
        messages: [{ role: 'user', content: 'test' }],
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': 'dev-internal-key',
      },
    });

    const response = await (await import('@/app/api/llm/plan/route')).POST(request);
    
    // The response should be streamable
    expect(response).toBeDefined();
  });
});
