/**
 * AI Chat Mock Tests
 * 
 * These tests demonstrate how to test AI SDK functionality WITHOUT
 * making real API calls. Tests run in milliseconds and are deterministic.
 * 
 * This is the testing pattern for PR1/PR1.5 implementation.
 */

import {
  createMockTextResponse,
  createMockToolCall,
  createMockAIModel,
  chartsmithMockResponses,
  expectToolCall,
  createMockConversation,
} from './ai-mock-utils';

describe('AI Mock Utilities', () => {
  describe('createMockTextResponse', () => {
    it('creates a valid text response', () => {
      const response = createMockTextResponse('Hello, I can help with your Helm chart!');
      
      expect(response.text).toBe('Hello, I can help with your Helm chart!');
      expect(response.finishReason).toBe('stop');
      expect(response.usage.promptTokens).toBe(10);
      expect(response.usage.completionTokens).toBeGreaterThan(0);
    });
  });

  describe('createMockToolCall', () => {
    it('creates a valid tool call for view', () => {
      const toolCall = createMockToolCall('view', { path: 'values.yaml' });
      
      expect(toolCall.type).toBe('tool-call');
      expect(toolCall.toolName).toBe('view');
      expect(toolCall.args).toEqual({ path: 'values.yaml' });
      expect(toolCall.toolCallId).toMatch(/^mock-tool-call-/);
    });

    it('creates a valid tool call for str_replace', () => {
      const toolCall = createMockToolCall('str_replace', {
        path: 'values.yaml',
        old_str: 'replicas: 1',
        new_str: 'replicas: 3',
      });
      
      expect(toolCall.toolName).toBe('str_replace');
      expect(toolCall.args.old_str).toBe('replicas: 1');
      expect(toolCall.args.new_str).toBe('replicas: 3');
    });
  });

  describe('chartsmithMockResponses', () => {
    it('creates view file response', () => {
      const response = chartsmithMockResponses.viewFile('Chart.yaml', '');
      
      expect(response.toolName).toBe('view');
      expect(response.args.path).toBe('Chart.yaml');
    });

    it('creates str_replace response', () => {
      const response = chartsmithMockResponses.strReplace(
        'values.yaml',
        'old content',
        'new content'
      );
      
      expect(response.toolName).toBe('str_replace');
    });

    it('creates conversational response', () => {
      const response = chartsmithMockResponses.conversational(
        "I've updated the replica count in your deployment."
      );
      
      expect(response.text).toContain('replica count');
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('createMockAIModel', () => {
    it('returns text responses in sequence', async () => {
      const mockModel = createMockAIModel({
        responses: [
          { type: 'text', content: 'First response' },
          { type: 'text', content: 'Second response' },
        ],
      });

      const result1 = await mockModel.doGenerate();
      expect(result1.text).toBe('First response');

      const result2 = await mockModel.doGenerate();
      expect(result2.text).toBe('Second response');
    });

    it('returns tool calls', async () => {
      const mockModel = createMockAIModel({
        responses: [
          { type: 'tool-call', tool: 'view', args: { path: 'values.yaml' } },
        ],
      });

      const result = await mockModel.doGenerate();
      
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe('view');
      expect(result.finishReason).toBe('tool-calls');
    });
  });

  describe('expectToolCall', () => {
    it('finds and validates tool calls', () => {
      const toolCalls = [
        { toolName: 'view', args: { path: 'Chart.yaml' } },
        { toolName: 'str_replace', args: { path: 'values.yaml', old_str: 'a', new_str: 'b' } },
      ];

      const viewCall = expectToolCall(toolCalls, 'view', { path: 'Chart.yaml' });
      expect(viewCall.toolName).toBe('view');
    });

    it('throws when tool not found', () => {
      const toolCalls = [
        { toolName: 'view', args: { path: 'Chart.yaml' } },
      ];

      expect(() => expectToolCall(toolCalls, 'create')).toThrow(
        'Expected tool "create" to be called'
      );
    });
  });

  describe('createMockConversation', () => {
    it('creates valid conversation history', () => {
      const conversation = createMockConversation([
        { role: 'user', content: 'Add a redis dependency' },
        { role: 'assistant', content: "I'll add redis to your chart." },
        { role: 'user', content: 'Thanks!' },
      ]);

      expect(conversation).toHaveLength(3);
      expect(conversation[0].role).toBe('user');
      expect(conversation[1].role).toBe('assistant');
      expect(conversation[2].content).toBe('Thanks!');
    });
  });
});

/**
 * Example: Testing a Chat Handler (PR1 pattern)
 */
describe('Chat Handler Pattern (PR1 Example)', () => {
  async function mockChatHandler(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    model: ReturnType<typeof createMockAIModel>
  ) {
    const result = await model.doGenerate();
    return result;
  }

  it('handles user asking to view a file', async () => {
    const mockModel = createMockAIModel({
      responses: [
        { type: 'tool-call', tool: 'view', args: { path: 'values.yaml' } },
      ],
    });

    const result = await mockChatHandler(
      [{ role: 'user', content: 'Show me the values.yaml file' }],
      mockModel
    );

    expect(result.toolCalls).toHaveLength(1);
    expectToolCall(result.toolCalls, 'view', { path: 'values.yaml' });
  });

  it('handles conversational responses', async () => {
    const mockModel = createMockAIModel({
      responses: [
        { type: 'text', content: 'Your Helm chart looks good!' },
      ],
    });

    const result = await mockChatHandler(
      [{ role: 'user', content: 'What does my chart do?' }],
      mockModel
    );

    expect(result.text).toContain('Helm chart');
    expect(result.finishReason).toBe('stop');
  });
});
