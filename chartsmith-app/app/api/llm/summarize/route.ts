import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

export async function POST(req: NextRequest) {
  try {
    const { content, modelId } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!content) {
      return new Response('Content required', { status: 400 });
    }
    
    const model = getModel(modelId);
    
    logger.info('Summarizing content via Vercel AI SDK', {
      modelId: modelId || 'default',
      contentLength: content.length,
    });
    
    // Go sends the full prompt with summarization instructions embedded
    const { text } = await generateText({
      model,
      messages: [
        { role: 'user', content },
      ],
      abortSignal: AbortSignal.timeout(60000),
    });
    
    return Response.json({ summary: text });
  } catch (error) {
    return handleApiError(error, 'summarization API');
  }
}