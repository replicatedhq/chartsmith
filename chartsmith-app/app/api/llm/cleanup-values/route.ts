import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

export async function POST(req: NextRequest) {
  try {
    const { valuesYAML, modelId, messages } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!valuesYAML || valuesYAML.trim() === '') {
      logger.info('Empty valuesYAML provided, returning empty result');
      return Response.json({ cleanedYAML: '' });
    }
    
    const model = getModel(modelId);
    
    logger.info('Cleaning up values.yaml via Vercel AI SDK', {
      modelId: modelId || 'default',
      contentLength: valuesYAML.length,
    });
    
    // Use messages from Go if provided, otherwise build minimal request
    const finalMessages = messages && Array.isArray(messages) 
      ? messages 
      : [{ role: 'user' as const, content: `Clean up this values.yaml:\n---\n${valuesYAML}\n---` }];
    
    const { text } = await generateText({
      model,
      messages: finalMessages,
      abortSignal: AbortSignal.timeout(60000),
    });
    
    return Response.json({ cleanedYAML: text });
  } catch (error) {
    return handleApiError(error, 'cleanup values API');
  }
}