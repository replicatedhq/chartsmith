import { PromptType, PromptRole, PromptIntent } from '../prompt-type';

// Mock the AI SDK and provider
jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('@/lib/ai/provider', () => ({
  intentModel: 'mock-model',
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { generateText } from 'ai';
import { promptType } from '../prompt-type';

const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

describe('promptType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PromptType enum', () => {
    it('should have Plan and Chat values', () => {
      expect(PromptType.Plan).toBe('plan');
      expect(PromptType.Chat).toBe('chat');
    });
  });

  describe('PromptRole enum', () => {
    it('should have Packager and User values', () => {
      expect(PromptRole.Packager).toBe('packager');
      expect(PromptRole.User).toBe('user');
    });
  });

  describe('promptType function', () => {
    it('should return Plan when response contains "plan"', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'plan',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: [],
        response: { id: '', timestamp: new Date(), modelId: '', headers: {} },
        request: {},
        providerMetadata: {},
        rawResponse: undefined,
        logprobs: undefined,
        reasoning: undefined,
        reasoningDetails: undefined,
        sources: undefined,
        experimental_providerMetadata: {},
        files: [],
        steps: [],
        rawCall: {},
        responseMessages: [],
        toJsonResponse: () => new Response(),
      } as any);

      const result = await promptType('Please modify the Chart.yaml to add a new dependency');
      expect(result).toBe(PromptType.Plan);
    });

    it('should return Plan when response contains "PLAN" (case insensitive)', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'PLAN',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: [],
        response: { id: '', timestamp: new Date(), modelId: '', headers: {} },
        request: {},
        providerMetadata: {},
        rawResponse: undefined,
        logprobs: undefined,
        reasoning: undefined,
        reasoningDetails: undefined,
        sources: undefined,
        experimental_providerMetadata: {},
        files: [],
        steps: [],
        rawCall: {},
        responseMessages: [],
        toJsonResponse: () => new Response(),
      } as any);

      const result = await promptType('Add a new deployment template');
      expect(result).toBe(PromptType.Plan);
    });

    it('should return Chat when response does not contain "plan"', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'chat',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: [],
        response: { id: '', timestamp: new Date(), modelId: '', headers: {} },
        request: {},
        providerMetadata: {},
        rawResponse: undefined,
        logprobs: undefined,
        reasoning: undefined,
        reasoningDetails: undefined,
        sources: undefined,
        experimental_providerMetadata: {},
        files: [],
        steps: [],
        rawCall: {},
        responseMessages: [],
        toJsonResponse: () => new Response(),
      } as any);

      const result = await promptType('What is a Helm chart?');
      expect(result).toBe(PromptType.Chat);
    });

    it('should return Chat for any non-plan response', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'This is a conversational question about Helm',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: [],
        response: { id: '', timestamp: new Date(), modelId: '', headers: {} },
        request: {},
        providerMetadata: {},
        rawResponse: undefined,
        logprobs: undefined,
        reasoning: undefined,
        reasoningDetails: undefined,
        sources: undefined,
        experimental_providerMetadata: {},
        files: [],
        steps: [],
        rawCall: {},
        responseMessages: [],
        toJsonResponse: () => new Response(),
      } as any);

      const result = await promptType('How do values.yaml files work?');
      expect(result).toBe(PromptType.Chat);
    });

    it('should call generateText with correct parameters', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'chat',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: [],
        response: { id: '', timestamp: new Date(), modelId: '', headers: {} },
        request: {},
        providerMetadata: {},
        rawResponse: undefined,
        logprobs: undefined,
        reasoning: undefined,
        reasoningDetails: undefined,
        sources: undefined,
        experimental_providerMetadata: {},
        files: [],
        steps: [],
        rawCall: {},
        responseMessages: [],
        toJsonResponse: () => new Response(),
      } as any);

      const testMessage = 'Test message';
      await promptType(testMessage);

      expect(mockGenerateText).toHaveBeenCalledWith({
        model: 'mock-model',
        system: expect.stringContaining('You are ChartSmith'),
        prompt: testMessage,
        maxOutputTokens: 1024,
      });
    });

    it('should throw error when generateText fails', async () => {
      const testError = new Error('API Error');
      mockGenerateText.mockRejectedValue(testError);

      await expect(promptType('Test message')).rejects.toThrow('API Error');
    });
  });
});
