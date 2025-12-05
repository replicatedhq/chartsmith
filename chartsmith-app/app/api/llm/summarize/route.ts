import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

export async function POST(req: NextRequest) {
  try {
    const { content, context, modelId } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!content) {
      return new Response('Content required', { status: 400 });
    }
    
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
      abortSignal: AbortSignal.timeout(60000),
    });
    
    return Response.json({ summary: text });
  } catch (error) {
    return handleApiError(error, 'summarization API');
  }
}