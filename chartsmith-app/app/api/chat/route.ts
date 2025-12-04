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
 * 
 * Request body:
 * {
 *   messages: Array<{ role: 'user' | 'assistant', content: string }>,
 *   provider?: 'openai' | 'anthropic',
 *   model?: string (e.g., 'openai/gpt-4o')
 * }
 * 
 * Response: AI SDK Text Stream (for use with useChat hook)
 */

import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { 
  getModel, 
  isValidProvider, 
  isValidModel,
  CHARTSMITH_SYSTEM_PROMPT,
} from '@/lib/ai';

// Set maximum streaming duration (must be a literal for Next.js config)
export const maxDuration = 60;

// Request body interface - using UIMessage from AI SDK v5
interface ChatRequestBody {
  messages: UIMessage[];
  provider?: string;
  model?: string;
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: ChatRequestBody = await request.json();
    const { messages, provider, model } = body;

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

    // Convert messages to core format and stream the response
    const result = streamText({
      model: modelInstance,
      system: CHARTSMITH_SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      // Note: Tools are NOT included in PR1 - they will be added in PR1.5
    });

    // Return the streaming response using Text Stream protocol (AI SDK v5)
    return result.toTextStreamResponse();

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

