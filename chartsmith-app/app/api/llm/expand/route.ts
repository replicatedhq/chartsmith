import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/llm/expand
 * 
 * Expands a user prompt with additional context and clarity
 * This replaces pkg/llm/expand.go
 * 
 * Request body:
 * - prompt: string - The user's original prompt
 * - modelId?: string - Optional model override
 * 
 * Returns: JSON with expanded prompt
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt, modelId } = await req.json();
    
    // Auth check
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!prompt) {
      return new Response('Prompt required', { status: 400 });
    }
    
    // Get model instance
    const model = getModel(modelId);
    
    const systemPrompt = `You are a helpful assistant that expands user prompts to be more specific and actionable.
    
Given a user's prompt, expand it to include:
- Specific technical details
- Clear intent
- Relevant context

Keep the expansion concise but complete. Return only the expanded prompt, nothing else.`;
    
    logger.info('Expanding prompt via Vercel AI SDK', {
      modelId: modelId || 'default',
      promptLength: prompt.length,
    });
    
    // Use generateText for non-streaming completion
    const { text } = await generateText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });
    
    return Response.json({ expandedPrompt: text });
  } catch (error) {
    logger.error('Error in prompt expansion API', { 
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