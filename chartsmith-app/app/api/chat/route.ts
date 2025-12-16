/**
 * Chat API route using Vercel AI SDK.
 * Handles streaming chat responses for conversational interactions.
 */

import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { getChatModel } from '@/lib/llm/model-provider';
import { chatOnlySystemPrompt } from '@/lib/llm/prompts';
import { userIdFromExtensionToken } from '@/lib/auth/extension-token';

export async function POST(req: NextRequest) {
  try {
    // Authenticate request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = await userIdFromExtensionToken(authHeader.split(' ')[1]);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { messages, workspaceId } = await req.json();

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const model = await getChatModel();
    const result = streamText({
      model,
      system: chatOnlySystemPrompt,
      messages,
    });

    // Use toUIMessageStreamResponse for integration with useChat hook (AI SDK v5)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
