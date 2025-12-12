import { WorkspaceContext, getWorkspaceContext } from '../context';

// Mock the workspace module
jest.mock('@/lib/workspace/workspace', () => ({
  getWorkspace: jest.fn(),
  listPlans: jest.fn(),
}));

// Mock the chat module
jest.mock('@/lib/workspace/chat', () => ({
  listMessagesForWorkspace: jest.fn(),
}));

import { getWorkspace, listPlans } from '@/lib/workspace/workspace';
import { listMessagesForWorkspace } from '@/lib/workspace/chat';

const mockGetWorkspace = getWorkspace as jest.MockedFunction<typeof getWorkspace>;
const mockListPlans = listPlans as jest.MockedFunction<typeof listPlans>;
const mockListMessagesForWorkspace = listMessagesForWorkspace as jest.MockedFunction<typeof listMessagesForWorkspace>;

describe('getWorkspaceContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should throw error when workspace not found', async () => {
      mockGetWorkspace.mockResolvedValue(undefined);

      await expect(getWorkspaceContext('non-existent-id')).rejects.toThrow(
        'Workspace not found: non-existent-id'
      );
    });

    it('should return context with system prompt for workspace without charts', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [],
      });
      mockListPlans.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context).toBeDefined();
      expect(context.systemPrompt).toContain('You are ChartSmith');
      expect(context.systemPrompt).toContain('Helm charts');
      expect(context.chartStructure).toBe('');
      expect(context.relevantFiles).toEqual([]);
    });

    it('should include chart structure in context', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [
          {
            id: 'chart-1',
            name: 'my-chart',
            files: [
              { id: 'file-1', filePath: 'Chart.yaml', content: 'name: my-chart', revisionNumber: 1 },
              { id: 'file-2', filePath: 'values.yaml', content: 'replicaCount: 1', revisionNumber: 1 },
            ],
          },
        ],
      });
      mockListPlans.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.chartStructure).toContain('File: Chart.yaml');
      expect(context.chartStructure).toContain('File: values.yaml');
      expect(context.systemPrompt).toContain('Current chart structure:');
    });

    it('should include file contents in context', async () => {
      const chartContent = 'name: my-chart\nversion: 1.0.0';
      const valuesContent = 'replicaCount: 1\nimage: nginx';

      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [
          {
            id: 'chart-1',
            name: 'my-chart',
            files: [
              { id: 'file-1', filePath: 'Chart.yaml', content: chartContent, revisionNumber: 1 },
              { id: 'file-2', filePath: 'values.yaml', content: valuesContent, revisionNumber: 1 },
            ],
          },
        ],
      });
      mockListPlans.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.relevantFiles).toHaveLength(2);
      expect(context.relevantFiles[0].path).toBe('Chart.yaml');
      expect(context.relevantFiles[0].content).toBe(chartContent);
      expect(context.relevantFiles[1].path).toBe('values.yaml');
      expect(context.relevantFiles[1].content).toBe(valuesContent);
      expect(context.systemPrompt).toContain(chartContent);
      expect(context.systemPrompt).toContain(valuesContent);
    });

    it('should limit relevant files to 10', async () => {
      const files = Array.from({ length: 15 }, (_, i) => ({
        id: `file-${i}`,
        filePath: `file-${i}.yaml`,
        content: `content-${i}`,
        revisionNumber: 1,
      }));

      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [
          {
            id: 'chart-1',
            name: 'my-chart',
            files,
          },
        ],
      });
      mockListPlans.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.relevantFiles).toHaveLength(10);
    });
  });

  describe('chart selection', () => {
    it('should use specified chartId when provided', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [
          {
            id: 'chart-1',
            name: 'chart-one',
            files: [{ id: 'file-1', filePath: 'Chart.yaml', content: 'name: chart-one', revisionNumber: 1 }],
          },
          {
            id: 'chart-2',
            name: 'chart-two',
            files: [{ id: 'file-2', filePath: 'Chart.yaml', content: 'name: chart-two', revisionNumber: 1 }],
          },
        ],
      });
      mockListPlans.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace', 'chart-2');

      expect(context.relevantFiles[0].content).toBe('name: chart-two');
    });

    it('should use first chart when chartId not provided', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [
          {
            id: 'chart-1',
            name: 'first-chart',
            files: [{ id: 'file-1', filePath: 'Chart.yaml', content: 'name: first-chart', revisionNumber: 1 }],
          },
          {
            id: 'chart-2',
            name: 'second-chart',
            files: [{ id: 'file-2', filePath: 'Chart.yaml', content: 'name: second-chart', revisionNumber: 1 }],
          },
        ],
      });
      mockListPlans.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.relevantFiles[0].content).toBe('name: first-chart');
    });
  });

  describe('plan and chat history', () => {
    it('should include plan description when plan exists', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [],
      });

      mockListPlans.mockResolvedValue([
        {
          id: 'plan-1',
          description: 'Add nginx ingress controller dependency',
          status: 'approved',
          workspaceId: 'test-workspace',
          chatMessageIds: ['chat-1'],
          createdAt: new Date('2025-01-01T12:00:00Z'),
          actionFiles: [],
          proceedAt: null,
        },
      ]);

      mockListMessagesForWorkspace.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.systemPrompt).toContain('Most recent plan:');
      expect(context.systemPrompt).toContain('Add nginx ingress controller dependency');
    });

    it('should include previous conversation context after plan', async () => {
      const planCreatedAt = new Date('2025-01-01T12:00:00Z');

      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [],
      });

      mockListPlans.mockResolvedValue([
        {
          id: 'plan-1',
          description: 'Add nginx dependency',
          status: 'approved',
          workspaceId: 'test-workspace',
          chatMessageIds: ['chat-1'],
          createdAt: planCreatedAt,
          actionFiles: [],
          proceedAt: null,
        },
      ]);

      mockListMessagesForWorkspace.mockResolvedValue([
        {
          id: 'msg-1',
          prompt: 'What version should I use?',
          response: 'Use version 4.12.0',
          createdAt: new Date('2025-01-01T13:00:00Z'), // After plan
          isIntentComplete: true,
          isCanceled: false,
          followupActions: null,
          responseRenderId: null,
          responsePlanId: null,
          responseConversionId: null,
          responseRollbackToRevisionNumber: null,
          revisionNumber: 1,
          isComplete: true,
          messageFromPersona: null,
        },
      ]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.systemPrompt).toContain('Previous conversation context:');
      expect(context.systemPrompt).toContain('User: What version should I use?');
      expect(context.systemPrompt).toContain('Assistant: Use version 4.12.0');
    });

    it('should limit previous chat messages to last 5', async () => {
      const planCreatedAt = new Date('2025-01-01T12:00:00Z');

      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [],
      });

      mockListPlans.mockResolvedValue([
        {
          id: 'plan-1',
          description: 'Test plan',
          status: 'approved',
          workspaceId: 'test-workspace',
          chatMessageIds: ['chat-1'],
          createdAt: planCreatedAt,
          actionFiles: [],
          proceedAt: null,
        },
      ]);

      // Create 10 messages after the plan
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        prompt: `Question ${i}`,
        response: `Answer ${i}`,
        createdAt: new Date(`2025-01-01T${13 + i}:00:00Z`),
        isIntentComplete: true,
        isCanceled: false,
        followupActions: null,
        responseRenderId: null,
        responsePlanId: null,
        responseConversionId: null,
        responseRollbackToRevisionNumber: null,
        revisionNumber: 1,
        isComplete: true,
        messageFromPersona: null,
      }));

      mockListMessagesForWorkspace.mockResolvedValue(messages);

      const context = await getWorkspaceContext('test-workspace');

      // Should only include last 5 messages
      expect(context.systemPrompt).toContain('Question 5');
      expect(context.systemPrompt).toContain('Question 9');
      expect(context.systemPrompt).not.toContain('Question 0');
      expect(context.systemPrompt).not.toContain('Question 4');
    });

    it('should handle empty plan description gracefully', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [],
      });

      mockListPlans.mockResolvedValue([
        {
          id: 'plan-1',
          description: null as unknown as string, // Simulate null description
          status: 'pending',
          workspaceId: 'test-workspace',
          chatMessageIds: ['chat-1'],
          createdAt: new Date(),
          actionFiles: [],
          proceedAt: null,
        },
      ]);

      mockListMessagesForWorkspace.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.systemPrompt).toContain('(No description)');
    });

    it('should handle plan fetch error gracefully', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [],
      });

      mockListPlans.mockRejectedValue(new Error('Database error'));

      // Should not throw, should return context without plan
      const context = await getWorkspaceContext('test-workspace');

      expect(context).toBeDefined();
      expect(context.systemPrompt).not.toContain('Most recent plan:');
    });
  });

  describe('system prompt structure', () => {
    it('should include ChartSmith introduction', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [],
      });
      mockListPlans.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.systemPrompt).toContain('You are ChartSmith');
      expect(context.systemPrompt).toContain('AI assistant specialized in creating and managing Helm charts');
    });

    it('should include chat instructions', async () => {
      mockGetWorkspace.mockResolvedValue({
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        currentRevisionNumber: 1,
        files: [],
        charts: [],
      });
      mockListPlans.mockResolvedValue([]);

      const context = await getWorkspaceContext('test-workspace');

      expect(context.systemPrompt).toContain('When answering questions:');
      expect(context.systemPrompt).toContain('Consider the chart structure');
      expect(context.systemPrompt).toContain('Reference specific files');
      expect(context.systemPrompt).toContain('Helm best practices');
    });
  });
});
