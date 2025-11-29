import { streamText, tool } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/llm/conversational
 * 
 * Handles conversational chat with tool calling support
 * This replaces pkg/llm/conversational.go
 * 
 * Request body:
 * - messages: array - Full conversation history
 * - modelId?: string - Optional model override
 * 
 * Returns: Streaming text response with tool calls
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, modelId } = await req.json();
    
    // Auth check
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!messages || !Array.isArray(messages)) {
      return new Response('Messages array required', { status: 400 });
    }
    
    // Get model instance
    const model = getModel(modelId);
    
    logger.info('Conversational chat via Vercel AI SDK', {
      modelId: modelId || 'default',
      messageCount: messages.length,
    });
    
    // Tools are disabled for conversational chat
    // They can be enabled in the future if needed
    const tools = undefined;
    
    // Stream conversational response
    const result = streamText({
      model,
      messages,
    });
    
    return result.toTextStreamResponse();
  } catch (error) {
    logger.error('Error in conversational API', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    });
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error)
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}