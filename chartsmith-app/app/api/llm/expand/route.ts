import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

export async function POST(req: NextRequest) {
  try {
    const { prompt, modelId } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!prompt) {
      return new Response('Prompt required', { status: 400 });
    }
    
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
    
    const { text } = await generateText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      abortSignal: AbortSignal.timeout(60000),
    });
    
    return Response.json({ expandedPrompt: text });
  } catch (error) {
    return handleApiError(error, 'prompt expansion API');
  }
}