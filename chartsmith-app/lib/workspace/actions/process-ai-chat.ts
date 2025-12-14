'use server';

import { logger } from "@/lib/utils/logger";

/**
 * Processes a chat message using the Vercel AI SDK API route
 * This is called by the work queue handler when a new_ai_sdk_chat event is received
 */
export async function processAIChatMessage(chatMessageId: string): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Use process.env.ANTHROPIC_API_KEY to match what the API route validates against
    // Both Go worker and Next.js should have ANTHROPIC_API_KEY in their environment
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set in environment');
    }

    const response = await fetch(`${appUrl}/api/chat/conversational`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ chatMessageId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to process chat: ${response.statusText} - ${error}`);
    }

    const result = await response.json();
    logger.info('Chat message processed successfully', { chatMessageId, result });
  } catch (err) {
    logger.error('Failed to process AI chat message', { err, chatMessageId });
    throw err;
  }
}
