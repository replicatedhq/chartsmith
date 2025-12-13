'use server';

import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";

/**
 * Processes a chat message using the Vercel AI SDK API route
 * This is called by the work queue handler when a new_ai_sdk_chat event is received
 */
export async function processAIChatMessage(chatMessageId: string): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const apiKey = await getParam('ANTHROPIC_API_KEY');

    // Get a valid auth token for server-to-server communication
    // For now, we'll use a simple approach - the API route should accept requests from localhost
    const response = await fetch(`${appUrl}/api/chat/conversational`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: Add proper server-to-server authentication
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
