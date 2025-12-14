'use server';

import { logger } from "@/lib/utils/logger";

/**
 * Processes a chat message using the Vercel AI SDK API route
 * This is called by the work queue handler when a new_ai_sdk_chat event is received
 */
export async function processAIChatMessage(chatMessageId: string): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Use dedicated internal API token for worker->Next.js authentication
    // This is separate from ANTHROPIC_API_KEY to avoid leaking the LLM key
    const internalToken = process.env.INTERNAL_API_TOKEN;

    if (!internalToken) {
      throw new Error('INTERNAL_API_TOKEN not set in environment');
    }

    const response = await fetch(`${appUrl}/api/chat/conversational`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalToken}`,
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
