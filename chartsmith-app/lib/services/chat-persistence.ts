/**
 * Chat Persistence Service
 * 
 * Service for persisting AI SDK chat messages to the database.
 * Handles conversion between AI SDK message format and our database schema.
 */

import { CoreMessage } from 'ai';

/**
 * Service for persisting AI SDK chat messages
 */
export class ChatPersistenceService {
  private workspaceId: string;
  private apiBase: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.apiBase = '/api/workspace';
  }

  /**
   * Extract text content from AI SDK message content.
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
   * AI SDK sends user and assistant messages separately.
   * We need to pair them for our schema.
   */
  async saveMessagePair(
    userMessage: CoreMessage,
    assistantMessage: CoreMessage
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
  async savePartialMessage(message: CoreMessage): Promise<{ id: string }> {
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
   * Load chat history and convert to AI SDK format
   */
  async loadHistory(): Promise<CoreMessage[]> {
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
    const messages: CoreMessage[] = [];

    // Convert each stored message to AI SDK format
    // Each stored message may have prompt and/or response
    for (const msg of Array.isArray(data) ? data : (data.messages || [])) {
      if (msg.prompt) {
        messages.push({
          role: 'user',
          content: msg.prompt,
        } as CoreMessage);
      }
      if (msg.response) {
        messages.push({
          role: 'assistant',
          content: msg.response,
        } as CoreMessage);
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
