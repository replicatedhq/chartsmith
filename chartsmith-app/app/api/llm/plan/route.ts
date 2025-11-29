import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { getWorkspace } from '@/lib/workspace/workspace';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/llm/plan
 * 
 * Generates a plan for chart modifications using Vercel AI SDK
 * This replaces the Go backend's direct Anthropic SDK usage
 * 
 * Request body:
 * - prompt: string - The user's request
 * - workspaceId: string - Workspace context
 * - chartContext: string - Chart structure and files
 * - modelId?: string - Optional model override
 * 
 * Returns: Streaming text response with plan description
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt, workspaceId, chartContext, modelId, messages } = await req.json();
    
    // Auth check
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    // Validate workspace access
    if (!workspaceId) {
      return new Response('Workspace ID required', { status: 400 });
    }
    
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return new Response('Workspace not found', { status: 404 });
    }
    
    // Get model instance
    const model = getModel(modelId);
    
    logger.info('Generating plan via Vercel AI SDK', {
      workspaceId,
      modelId: modelId || 'default',
      messageCount: messages?.length || 0,
    });
    
    // Support two modes:
    // 1. Simple mode: prompt + chartContext (for basic requests)
    // 2. Advanced mode: full messages array (for complex Go worker requests)
    let finalMessages;
    
    if (messages && Array.isArray(messages)) {
      // Advanced mode: Use messages array from Go worker
      finalMessages = messages;
    } else {
      // Simple mode: Build messages from prompt and chartContext
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
    
    // Stream plan generation using Vercel AI SDK
    const result = streamText({
      model,
      messages: finalMessages,
    });
    
    return result.toTextStreamResponse();
  } catch (error) {
    logger.error('Error in plan generation API', { 
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