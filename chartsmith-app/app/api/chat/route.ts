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

    const result = streamText({
      model: getChatModel(),
      system: chatOnlySystemPrompt,
      messages,
    });

    // Use toTextStreamResponse for simple text streaming (curl-friendly)
    // Switch to toUIMessageStreamResponse when integrating with useChat hook
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
