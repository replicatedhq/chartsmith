import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

export async function POST(req: NextRequest) {
  try {
    const { messages, modelId } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!messages || !Array.isArray(messages)) {
      return new Response('Messages array required', { status: 400 });
    }
    
    const model = getModel(modelId);
    
    logger.info('Conversational chat via Vercel AI SDK', {
      modelId: modelId || 'default',
      messageCount: messages.length,
    });
    
    const result = streamText({
      model,
      messages,
      abortSignal: AbortSignal.timeout(120000),
    });
    
    return result.toTextStreamResponse();
  } catch (error) {
    return handleApiError(error, 'conversational API');
  }
}