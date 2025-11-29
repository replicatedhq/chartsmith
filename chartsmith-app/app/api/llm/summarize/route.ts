import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/llm/summarize
 * 
 * Summarizes file content or changes
 * This replaces pkg/llm/summarize.go
 * 
 * Request body:
 * - content: string - Content to summarize
 * - context?: string - Additional context
 * - modelId?: string - Optional model override
 * 
 * Returns: JSON with summary
 */
export async function POST(req: NextRequest) {
  try {
    const { content, context, modelId } = await req.json();
    
    // Auth check
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!content) {
      return new Response('Content required', { status: 400 });
    }
    
    // Get model instance
    const model = getModel(modelId);
    
    const systemPrompt = `You are a technical writer who creates concise, accurate summaries of Helm chart changes and Kubernetes configurations.

Create a clear, brief summary that captures the key points and changes.${context ? `\n\nContext: ${context}` : ''}`;
    
    logger.info('Summarizing content via Vercel AI SDK', {
      modelId: modelId || 'default',
      contentLength: content.length,
    });
    
    const { text } = await generateText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Summarize this:\n\n${content}` },
      ],
    });
    
    return Response.json({ summary: text });
  } catch (error) {
    logger.error('Error in summarization API', { 
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