/**
 * Chat Persistence Service
 *
 * Service for persisting chat messages to the database.
 * Handles conversion between various message formats and our database schema.
 *
 * Note: This service accepts messages in simple {role, content} format
 * for compatibility with both AI SDK v5 and our internal APIs.
 */

/**
 * Simple message format for API communication.
 * Compatible with AI SDK's CoreMessage and our internal APIs.
 */
export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string }>;
}

/**
 * Service for persisting chat messages
 */
export class ChatPersistenceService {
  private workspaceId: string;
  private apiBase: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.apiBase = '/api/workspace';
  }

  /**
   * Extract text content from message content.
   * Handles both string and array formats.
   */
  private extractContent(content: string | Array<{ type: string; text?: string }>): string {
    if (typeof content === 'string') {
      return content;
    }
    return content
      .map(c => c.type === 'text' ? (c.text || '') : '')
      .join('');
  }

  /**
   * Save a completed message pair to the database
   *
   * Messages are sent as user and assistant separately.
   * We need to pair them for our schema.
   */
  async saveMessagePair(
    userMessage: SimpleMessage,
    assistantMessage: SimpleMessage
  ): Promise<{ id: string }> {
    const userContent = this.extractContent(userMessage.content);
    const assistantContent = this.extractContent(assistantMessage.content);

    const response = await fetch(
      `${this.apiBase}/${this.workspaceId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userContent,
          response: assistantContent,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save message: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Save a single message (for streaming in-progress saves)
   */
  async savePartialMessage(message: SimpleMessage): Promise<{ id: string }> {
    const content = this.extractContent(message.content);
    const isUser = message.role === 'user';

    const response = await fetch(
      `${this.apiBase}/${this.workspaceId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: isUser ? content : undefined,
          response: !isUser ? content : undefined,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save message: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Load chat history and convert to simple message format
   */
  async loadHistory(): Promise<SimpleMessage[]> {
    const response = await fetch(
      `${this.apiBase}/${this.workspaceId}/messages`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return []; // No history yet
      }
      throw new Error(`Failed to load history: ${response.status}`);
    }

    const data = await response.json();
    const messages: SimpleMessage[] = [];

    // Convert each stored message to simple format
    // Each stored message may have prompt and/or response
    for (const msg of Array.isArray(data) ? data : (data.messages || [])) {
      if (msg.prompt) {
        messages.push({
          role: 'user',
          content: msg.prompt,
        });
      }
      if (msg.response) {
        messages.push({
          role: 'assistant',
          content: msg.response,
        });
      }
    }

    return messages;
  }

  /**
   * Update an existing message (for when streaming completes)
   */
  async updateMessage(
    messageId: string,
    content: string
  ): Promise<void> {
    const response = await fetch(
      `${this.apiBase}/${this.workspaceId}/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: content }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update message: ${response.status}`);
    }
  }
}
