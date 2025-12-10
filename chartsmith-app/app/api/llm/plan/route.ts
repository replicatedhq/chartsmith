import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { getWorkspace } from '@/lib/workspace/workspace';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, modelId, messages } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!workspaceId) {
      return new Response('Workspace ID required', { status: 400 });
    }
    
    if (!messages || !Array.isArray(messages)) {
      return new Response('Messages required', { status: 400 });
    }
    
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return new Response('Workspace not found', { status: 404 });
    }
    
    const model = getModel(modelId);
    
    logger.info('Generating plan via Vercel AI SDK', {
      workspaceId,
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
    return handleApiError(error, 'plan generation API');
  }
}
