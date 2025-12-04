/**
 * AI SDK Chat API Route
 * 
 * This is the NEW chat endpoint using Vercel AI SDK's streamText.
 * It runs PARALLEL to the existing Go-based chat system.
 * 
 * The existing chat system (via createChatMessageAction → PostgreSQL queue → Go worker)
 * continues to work for workspace operations. This new endpoint provides:
 * - Direct streaming responses via AI SDK Text Stream protocol
 * - Multi-provider support via OpenRouter
 * - Standard useChat hook compatibility
 * - Tool support for chart operations (PR1.5)
 * 
 * Request body:
 * {
 *   messages: Array<{ role: 'user' | 'assistant', content: string }>,
 *   provider?: 'openai' | 'anthropic',
 *   model?: string (e.g., 'openai/gpt-4o'),
 *   workspaceId?: string (required for tool operations),
 *   revisionNumber?: number (required for tool operations)
 * }
 * 
 * Response: AI SDK Text Stream (for use with useChat hook)
 */

import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { 
  getModel, 
  isValidProvider, 
  isValidModel,
} from '@/lib/ai';
import { createTools } from '@/lib/ai/tools';
import { CHARTSMITH_TOOL_SYSTEM_PROMPT } from '@/lib/ai/prompts';

// Set maximum streaming duration (must be a literal for Next.js config)
export const maxDuration = 60;

// Request body interface - using UIMessage from AI SDK v5
// PR1.5: Added workspaceId and revisionNumber for tool support
interface ChatRequestBody {
  messages: UIMessage[];
  provider?: string;
  model?: string;
  workspaceId?: string;      // Required for tool operations
  revisionNumber?: number;   // Required for tool operations
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: ChatRequestBody = await request.json();
    const { messages, provider, model, workspaceId, revisionNumber } = body;
    
    // Debug logging for tool setup
    console.log('[/api/chat] Request received:', { 
      hasMessages: !!messages?.length, 
      provider, 
      model, 
      workspaceId, 
      revisionNumber 
    });
    
    // Extract auth header for forwarding to Go backend (PR1.5)
    const authHeader = request.headers.get('Authorization') || undefined;

    // Validate messages array
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request', 
          details: 'messages array is required' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate provider if specified
    if (provider && !isValidProvider(provider)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid provider', 
          details: `Provider '${provider}' is not supported. Use 'openai' or 'anthropic'.` 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate model if specified
    if (model && !isValidModel(model)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid model', 
          details: `Model '${model}' is not supported.` 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the model instance
    const modelInstance = getModel(provider, model);

    // Create tools if workspace context is provided (PR1.5)
    // Tools require workspaceId to operate on files
    const tools = workspaceId 
      ? createTools(authHeader, workspaceId, revisionNumber || 1)
      : undefined;
    
    console.log('[/api/chat] Tools created:', { 
      hasTools: !!tools, 
      toolNames: tools ? Object.keys(tools) : [] 
    });

    // Convert messages to core format and stream the response
    const result = streamText({
      model: modelInstance,
      system: CHARTSMITH_TOOL_SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      tools, // PR1.5: Tools for chart operations
      stopWhen: stepCountIs(5), // Allow up to 5 tool calls per request (AI SDK v5 replacement for maxSteps)
    });

    // Return the streaming response using UI Message Stream protocol (AI SDK v5)
    // This format properly handles tool calls and results
    return result.toUIMessageStreamResponse();

  } catch (error) {
    console.error('Chat API error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check for missing API key
      if (error.message.includes('OPENROUTER_API_KEY')) {
        return new Response(
          JSON.stringify({ 
            error: 'Configuration error', 
            details: 'AI service is not configured. Please contact support.' 
          }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check for invalid provider/model errors
      if (error.name === 'InvalidProviderError' || error.name === 'InvalidModelError') {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid configuration', 
            details: error.message 
          }),
          { 
            status: 400, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Generic error response
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

