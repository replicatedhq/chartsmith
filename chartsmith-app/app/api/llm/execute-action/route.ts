import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/llm/execute-action
 * 
 * Executes file actions with text_editor tool support
 * This replaces pkg/llm/execute-action.go
 * 
 * Request body:
 * - messages: array - Full conversation history
 * - modelId?: string - Optional model override
 * 
 * Returns: JSON response with content and tool calls
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, modelId } = await req.json();
    
    // Auth check
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!messages || !Array.isArray(messages)) {
      return new Response('Messages array required', { status: 400 });
    }
    
    // Get model instance
    const model = getModel(modelId);
    
    logger.info('Execute action via Vercel AI SDK', {
      modelId: modelId || 'default',
      messageCount: messages.length,
    });
    
    // Messages are already in the correct format from Go worker
    // Just ensure content is stringified if needed
    const coreMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));
    
    // Define text_editor tool for file operations using the same pattern as chat/route.ts
    const tools = {
      text_editor_20241022: {
        description: 'A tool for viewing, creating, and editing files',
        inputSchema: z.object({
          command: z.enum(['view', 'str_replace', 'create']).describe('The command to execute'),
          path: z.string().describe('The file path'),
          old_str: z.string().optional().describe('The string to replace (for str_replace)'),
          new_str: z.string().optional().describe('The new string (for str_replace or create)'),
        }),
        execute: async ({ command, path, old_str, new_str }: any) => {
          // Dummy execute - actual execution happens in Go worker
          // We just return a placeholder to satisfy the SDK
          return { success: true, command, path };
        },
      },
    };
    
    // Use generateText to get tool calls structured
    const result = await generateText({
      model,
      messages: coreMessages,
      tools,
      maxSteps: 1, // Only get the first tool call, don't execute
    });
    
    // Extract tool calls
    // The SDK returns tool calls with 'args' property for the parsed arguments
    // Based on debug logs, the structure has 'input' field
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
    logger.error('Error in execute-action API', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.constructor.name : typeof error
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
