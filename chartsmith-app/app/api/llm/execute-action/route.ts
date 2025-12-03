import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
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
    
    logger.info('Execute action via Vercel AI SDK', {
      modelId: modelId || 'default',
      messageCount: messages.length,
    });
    
    const coreMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));
    
    const tools = {
      text_editor_20241022: {
        description: 'A tool for viewing, creating, and editing files',
        inputSchema: z.object({
          command: z.enum(['view', 'str_replace', 'create']).describe('The command to execute'),
          path: z.string().describe('The file path'),
          old_str: z.string().optional().describe('The string to replace (for str_replace). Must not be empty.'),
          new_str: z.string().optional().describe('The new string (for str_replace or create)'),
        }).refine(
          (data) => {
            if (data.command === 'str_replace' && (!data.old_str || data.old_str === '')) {
              return false;
            }
            return true;
          },
          { message: 'str_replace command requires non-empty old_str' }
        ),
        execute: async ({ command, path }: any) => {
          return { success: true, command, path };
        },
      },
    };
    
    const result = await generateText({
      model,
      messages: coreMessages,
      tools,
      maxSteps: 1,
      abortSignal: AbortSignal.timeout(120000),
    });
    
    const toolCalls = result.toolCalls.map(tc => ({
      id: tc.toolCallId,
      name: tc.toolName,
      args: JSON.stringify((tc as any).args || (tc as any).input || {}),
    }));

    return new Response(JSON.stringify({
      content: result.text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleApiError(error, 'execute-action API');
  }
}
