/**
 * Intent classification API route using Groq (Llama).
 * Classifies user messages to determine how to handle them.
 * Ported from pkg/llm/intent.go
 */

import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getIntentModel } from '@/lib/llm/model-provider';
import { commonSystemPrompt, endUserSystemPrompt } from '@/lib/llm/prompts';
import { userIdFromExtensionToken } from '@/lib/auth/extension-token';

/**
 * Intent classification result.
 * Mirrors the Go workspacetypes.Intent struct.
 */
export interface Intent {
  isConversational: boolean;
  isPlan: boolean;
  isOffTopic: boolean;
  isChartDeveloper: boolean;
  isChartOperator: boolean;
  isProceed: boolean;
  isRender: boolean;
}

/**
 * Persona type for message classification.
 */
export type ChatMessageFromPersona = 'auto' | 'developer' | 'operator';

/**
 * Request body for intent classification.
 */
interface IntentRequest {
  message: string;
  isInitialPrompt?: boolean;
  persona?: ChatMessageFromPersona;
}

/**
 * Build the classification prompt based on persona.
 */
function buildClassificationPrompt(
  message: string,
  persona: ChatMessageFromPersona
): string {
  const basePrompt = persona === 'operator' ? endUserSystemPrompt : commonSystemPrompt;

  if (persona === 'operator') {
    return `${basePrompt}

Given this, my request is:

${message}

Determine if the prompt is a question, a request for information, or a request to perform an action.

You will respond with a JSON object containing the following fields:
- isConversational: true if the prompt is a question or request for information, false otherwise
- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
- isOffTopic: true if the prompt is off topic, false otherwise
- isChartOperator: true if it's possible to answer this question as if it was asked by the chart operator and can be completed without making any changes to the chart templates or files, false if otherwise

Important: Do not respond with anything other than the JSON object.`;
  }

  if (persona === 'developer') {
    return `${basePrompt}

Given this, my request is:

${message}

Determine if the prompt is a question, a request for information, or a request to perform an action.

You will respond with a JSON object containing the following fields:
- isConversational: true if the prompt is a question or request for information, false otherwise
- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
- isOffTopic: true if the prompt is off topic, false otherwise
- isChartDeveloper: true if it's possible to answer this question as if it was asked by the chat developer, false if otherwise
- isProceed: true if the prompt is a clear request to execute previous instructions with no requested changes, false otherwise
- isRender: true if the prompt is a request to render or test or validate the chart, false otherwise

Important: Do not respond with anything other than the JSON object.`;
  }

  // Default: auto persona
  return `${basePrompt}

Given this, my request is:

${message}

Determine if the prompt is a question, a request for information, or a request to perform an action.

You will respond with a JSON object containing the following fields:
- isConversational: true if the prompt is a question or request for information, false otherwise
- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
- isOffTopic: true if the prompt is off topic, false otherwise
- isChartDeveloper: true if the question is related to planning a change to the chart, false otherwise
- isChartOperator: true if the question is about how to use the Helm chart in a Kubernetes cluster, false otherwise
- isProceed: true if the prompt is a clear request to execute previous instructions with no requested changes, false otherwise
- isRender: true if the prompt is a request to render or test or validate the chart, false otherwise

Important: Do not respond with anything other than the JSON object.`;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = await userIdFromExtensionToken(authHeader.split(' ')[1]);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: IntentRequest = await req.json();
    const { message, isInitialPrompt = false, persona = 'auto' } = body;

    // Validate required fields
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prompt = buildClassificationPrompt(message, persona);

    const model = await getIntentModel();
    const result = await generateText({
      model,
      prompt,
    });

    // Parse the JSON response
    let intent: Intent;
    try {
      const parsed = JSON.parse(result.text);
      intent = {
        isConversational: Boolean(parsed.isConversational),
        isPlan: Boolean(parsed.isPlan),
        isOffTopic: Boolean(parsed.isOffTopic),
        isChartDeveloper: Boolean(parsed.isChartDeveloper),
        isChartOperator: Boolean(parsed.isChartOperator),
        isProceed: Boolean(parsed.isProceed),
        isRender: Boolean(parsed.isRender),
      };
    } catch {
      // If parsing fails, default to conversational
      intent = {
        isConversational: true,
        isPlan: false,
        isOffTopic: false,
        isChartDeveloper: false,
        isChartOperator: false,
        isProceed: false,
        isRender: false,
      };
    }

    // For initial prompts, always assume it's a plan (but could still be off-topic)
    if (isInitialPrompt) {
      intent.isPlan = true;
      intent.isProceed = false;
    }

    return Response.json(intent);
  } catch (error) {
    console.error('Intent classification error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
