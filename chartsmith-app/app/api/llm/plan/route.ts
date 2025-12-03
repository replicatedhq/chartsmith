import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { getWorkspace } from '@/lib/workspace/workspace';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

export async function POST(req: NextRequest) {
  try {
    const { prompt, workspaceId, chartContext, modelId, messages } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!workspaceId) {
      return new Response('Workspace ID required', { status: 400 });
    }
    
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return new Response('Workspace not found', { status: 404 });
    }
    
    const model = getModel(modelId);
    
    logger.info('Generating plan via Vercel AI SDK', {
      workspaceId,
      modelId: modelId || 'default',
      messageCount: messages?.length || 0,
    });
    
    let finalMessages;
    
    if (messages && Array.isArray(messages)) {
      finalMessages = messages;
    } else {
      const systemPrompt = `You are an expert Helm chart developer. Your task is to create a detailed plan for modifying a Helm chart based on the user's request.

The plan should:
1. Break down the request into specific, actionable steps
2. Identify which files need to be created, modified, or deleted
3. Explain the reasoning behind each change
4. Consider Helm best practices and Kubernetes conventions

Chart Context:
${chartContext || 'No chart context provided'}

Respond with a clear, structured plan that can be executed step-by-step.`;
      
      finalMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];
    }
    
    const result = streamText({
      model,
      messages: finalMessages,
      abortSignal: AbortSignal.timeout(120000),
    });
    
    return result.toTextStreamResponse();
  } catch (error) {
    return handleApiError(error, 'plan generation API');
  }
}