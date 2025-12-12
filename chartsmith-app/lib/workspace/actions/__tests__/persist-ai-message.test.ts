/**
 * Tests for persistAIResponseAction
 *
 * These tests verify the behavior of the action that persists
 * AI SDK streaming responses to the database.
 */

describe('persistAIResponseAction', () => {
  let mockQuery: jest.Mock;
  let mockGetDB: jest.Mock;
  let mockGetParam: jest.Mock;
  let mockLoggerError: jest.Mock;
  let persistAIResponseAction: (chatMessageId: string, response: string) => Promise<void>;

  beforeEach(async () => {
    jest.resetModules();

    mockQuery = jest.fn();
    mockGetDB = jest.fn().mockReturnValue({ query: mockQuery });
    mockGetParam = jest.fn().mockResolvedValue('postgresql://localhost:5432/test');
    mockLoggerError = jest.fn();

    // Set up mocks before importing the module
    jest.doMock('@/lib/data/db', () => ({
      getDB: mockGetDB,
    }));

    jest.doMock('@/lib/data/param', () => ({
      getParam: mockGetParam,
    }));

    jest.doMock('@/lib/utils/logger', () => ({
      logger: {
        error: mockLoggerError,
        info: jest.fn(),
        debug: jest.fn(),
      },
    }));

    // Import the action after mocking
    const importedModule = await import('../persist-ai-message');
    persistAIResponseAction = importedModule.persistAIResponseAction;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('successful persistence', () => {
    it('should update chat message with response', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await persistAIResponseAction('chat-123', 'This is the AI response');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE workspace_chat'),
        ['This is the AI response', 'chat-123']
      );
    });

    it('should set is_intent_complete to true', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await persistAIResponseAction('chat-123', 'Response');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_intent_complete = true'),
        expect.any(Array)
      );
    });

    it('should set is_intent_conversational to true', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await persistAIResponseAction('chat-123', 'Response');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_intent_conversational = true'),
        expect.any(Array)
      );
    });

    it('should handle long responses', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const longResponse = 'A'.repeat(10000);
      await persistAIResponseAction('chat-123', longResponse);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [longResponse, 'chat-123']
      );
    });

    it('should handle responses with special characters', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const specialResponse = `Here's some YAML:\n\`\`\`yaml\nkey: value\narray:\n  - item1\n  - item2\n\`\`\``;
      await persistAIResponseAction('chat-123', specialResponse);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [specialResponse, 'chat-123']
      );
    });

    it('should handle responses with markdown', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const markdownResponse = `# Heading\n\n**Bold** and *italic*\n\n1. First\n2. Second`;
      await persistAIResponseAction('chat-123', markdownResponse);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [markdownResponse, 'chat-123']
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(persistAIResponseAction('chat-123', 'Response')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should log error when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      try {
        await persistAIResponseAction('chat-123', 'Response');
      } catch {
        // Expected to throw
      }

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to persist AI response',
        expect.objectContaining({ chatMessageId: 'chat-123' })
      );
    });

    it('should include chatMessageId in error log', async () => {
      const dbError = new Error('Query error');
      mockQuery.mockRejectedValue(dbError);

      try {
        await persistAIResponseAction('specific-chat-id', 'Response');
      } catch {
        // Expected to throw
      }

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ chatMessageId: 'specific-chat-id' })
      );
    });
  });

  describe('database connection', () => {
    it('should get DB_URI parameter', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await persistAIResponseAction('chat-123', 'Response');

      expect(mockGetParam).toHaveBeenCalledWith('DB_URI');
    });

    it('should use DB connection from getDB', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await persistAIResponseAction('chat-123', 'Response');

      expect(mockGetDB).toHaveBeenCalled();
    });
  });
});
