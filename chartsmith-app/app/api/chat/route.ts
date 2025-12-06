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
import { createBufferedTools } from '@/lib/ai/tools/bufferedTools';
import { BufferedToolCall } from '@/lib/ai/tools/toolInterceptor';
import { createPlanFromToolCalls } from '@/lib/ai/plan';
import { getSystemPromptForPersona } from '@/lib/ai/prompts';
import { classifyIntent, routeFromIntent } from '@/lib/ai/intent';

// Set maximum streaming duration (must be a literal for Next.js config)
export const maxDuration = 60;

// Persona types matching ChatMessageFromPersona enum
type ChatPersona = 'auto' | 'developer' | 'operator';

// Request body interface - using UIMessage from AI SDK v5
// PR1.5: Added workspaceId and revisionNumber for tool support
// PR2.0: Added persona for prompt selection
// PR3.0: Added chatMessageId for plan creation association
interface ChatRequestBody {
  messages: UIMessage[];
  provider?: string;
  model?: string;
  workspaceId?: string;      // Required for tool operations
  revisionNumber?: number;   // Required for tool operations
  persona?: ChatPersona;     // PR2.0: Persona for prompt selection
  chatMessageId?: string;    // PR3.0: For plan creation association
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: ChatRequestBody = await request.json();
    const { messages, provider, model, workspaceId, revisionNumber, persona, chatMessageId } = body;
    
    // Debug logging for tool setup
    // PR2.0: Added persona to logging
    // PR3.0: Added chatMessageId to logging
    console.log('[/api/chat] Request received:', { 
      hasMessages: !!messages?.length, 
      provider, 
      model, 
      workspaceId, 
      revisionNumber,
      persona: persona ?? 'auto',
      chatMessageId,
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

    // PR3.0: Buffer for collecting tool calls during streaming
    const bufferedToolCalls: BufferedToolCall[] = [];
    
    // Create tools if workspace context is provided (PR1.5)
    // PR3.0: Use buffered tools when chatMessageId is provided (plan workflow)
    // Otherwise use regular tools (legacy behavior for non-plan messages)
    const tools = workspaceId
      ? (chatMessageId
          ? createBufferedTools(authHeader, workspaceId, revisionNumber ?? 0, (toolCall) => {
              bufferedToolCalls.push(toolCall);
            }, chatMessageId)
          : createTools(authHeader, workspaceId, revisionNumber ?? 0, chatMessageId))
      : undefined;
    
    console.log('[/api/chat] Tools created:', { 
      hasTools: !!tools, 
      toolNames: tools ? Object.keys(tools) : [],
      useBufferedTools: !!chatMessageId,
    });

    // PR2.0: Select system prompt based on persona
    // - 'developer': Technical deep-dive, best practices, CI/CD considerations
    // - 'operator': Practical usage, values configuration, troubleshooting
    // - 'auto' (default): General Chartsmith assistant
    const systemPrompt = getSystemPromptForPersona(persona);
    
    console.log('[/api/chat] Using persona:', persona ?? 'auto');

    // PR3.0: Intent classification before AI SDK processing
    // Only classify if we have a workspace context (non-initial messages)
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage && workspaceId) {
      const userPrompt = typeof lastUserMessage.content === 'string' 
        ? lastUserMessage.content 
        : (lastUserMessage.parts?.find(p => p.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
      const isInitialPrompt = revisionNumber === 0 && messages.filter(m => m.role === 'user').length === 1;

      try {
        const intent = await classifyIntent(
          authHeader,
          userPrompt,
          isInitialPrompt,
          persona ?? 'auto'
        );

        const route = routeFromIntent(intent, isInitialPrompt, revisionNumber ?? 0);
        console.log('[/api/chat] Intent classification result:', { intent, route });

        switch (route.type) {
          case "off-topic":
            // Return polite decline without calling AI SDK
            console.log('[/api/chat] Declining off-topic message');
            return new Response(
              JSON.stringify({
                message: "I'm designed to help with Helm charts. Could you rephrase your question to be about Helm chart development or operations?"
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );

          case "proceed":
            // Note: Full proceed handling will be implemented in Phase 3 with plan workflow
            // For now, let AI SDK handle it (user saying "proceed" without a plan)
            console.log('[/api/chat] Proceed intent detected, passing to AI SDK');
            break;

          case "render":
            // Note: Render handling would typically trigger render pipeline
            // For now, let AI SDK acknowledge the render request
            console.log('[/api/chat] Render intent detected, passing to AI SDK');
            break;

          case "ai-sdk":
            // Continue to AI SDK processing below
            break;
        }
      } catch (err) {
        // Fail-open: If intent classification fails, continue to AI SDK
        console.error('[/api/chat] Intent classification failed, proceeding with AI SDK:', err);
      }
    }

    // Convert messages to core format and stream the response
    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      tools, // PR1.5: Tools for chart operations
      stopWhen: stepCountIs(5), // Allow up to 5 tool calls per request (AI SDK v5 replacement for maxSteps)
      // PR3.0: Create plan from buffered tool calls after streaming completes
      onFinish: async ({ finishReason, usage }) => {
        console.log('[/api/chat] Stream finished:', {
          finishReason,
          usage,
          chatMessageId,
          workspaceId,
          bufferedToolCallCount: bufferedToolCalls.length,
        });

        // If we have buffered tool calls, create a plan
        if (bufferedToolCalls.length > 0 && workspaceId && chatMessageId) {
          try {
            const planId = await createPlanFromToolCalls(
              authHeader,
              workspaceId,
              chatMessageId,
              bufferedToolCalls
            );
            console.log('[/api/chat] Created plan:', planId);
          } catch (err) {
            console.error('[/api/chat] Failed to create plan:', err);
            // Plan creation failure is logged but doesn't fail the response
            // User can retry or the plan can be created manually
          }
        }
      },
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

