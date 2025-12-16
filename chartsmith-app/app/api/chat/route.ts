/**
 * Chat API route using Vercel AI SDK.
 * Handles streaming chat responses with intent-based routing.
 * Routes to plan generation or conversational chat based on message intent.
 */

import { streamText, type CoreMessage } from 'ai';
import { NextRequest } from 'next/server';
import { getChatModel } from '@/lib/llm/model-provider';
import {
  chatOnlySystemPrompt,
  initialPlanSystemPrompt,
  updatePlanSystemPrompt,
  initialPlanInstructions,
  updatePlanInstructions,
} from '@/lib/llm/prompts';
import { userIdFromExtensionToken } from '@/lib/auth/extension-token';
import { getWorkspace } from '@/lib/workspace/workspace';
import { type Intent } from './intent/route';

/**
 * Request body for chat.
 */
interface ChatRequest {
  messages: CoreMessage[];
  workspaceId?: string;
  skipIntentClassification?: boolean;
  isUpdate?: boolean;
  relevantFiles?: { path: string; content: string }[];
}

/**
 * Build chart structure string from workspace files.
 */
function getChartStructure(files: { filePath: string }[]): string {
  return files.map((file) => `File: ${file.filePath}`).join('\n');
}

/**
 * Build the plan prompt with chart context.
 */
function buildPlanPrompt(
  chartStructure: string,
  isUpdate: boolean,
  relevantFiles?: { path: string; content: string }[]
): string {
  const verb = isUpdate ? 'edit' : 'create';
  let prompt = `Chart structure:\n${chartStructure}\n\n`;

  if (isUpdate && relevantFiles && relevantFiles.length > 0) {
    for (const file of relevantFiles) {
      prompt += `File: ${file.path}\nContent:\n${file.content}\n\n`;
    }
  }

  prompt += `Describe the plan only (do not write code) to ${verb} a helm chart based on the previous discussion.`;

  return prompt;
}

/**
 * Classify the intent of the last message.
 */
async function classifyIntent(
  message: string,
  authHeader: string,
  baseUrl: string
): Promise<Intent> {
  try {
    const response = await fetch(`${baseUrl}/api/chat/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      // Default to conversational on error
      return {
        isConversational: true,
        isPlan: false,
        isOffTopic: false,
        isChartDeveloper: false,
        isChartOperator: false,
        isProceed: false,
        isRender: false,
      };
    }

    return response.json();
  } catch {
    // Default to conversational on error
    return {
      isConversational: true,
      isPlan: false,
      isOffTopic: false,
      isChartDeveloper: false,
      isChartOperator: false,
      isProceed: false,
      isRender: false,
    };
  }
}

/**
 * Handle plan generation request.
 */
async function handlePlanRequest(
  messages: CoreMessage[],
  workspaceId: string,
  isUpdate: boolean,
  relevantFiles: { path: string; content: string }[]
): Promise<Response> {
  // Get workspace and chart context
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    return new Response(JSON.stringify({ error: 'Workspace not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build chart structure from workspace files
  const allFiles = workspace.charts?.flatMap((chart) => chart.files || []) || [];
  const chartStructure = getChartStructure(allFiles);

  // Choose system prompt and instructions based on whether this is an update
  const systemPrompt = isUpdate ? updatePlanSystemPrompt : initialPlanSystemPrompt;
  const instructions = isUpdate ? updatePlanInstructions : initialPlanInstructions;

  // Build the context message
  const contextPrompt = buildPlanPrompt(chartStructure, isUpdate, relevantFiles);

  // Build full message list with context
  const fullMessages: CoreMessage[] = [
    { role: 'assistant', content: instructions },
    { role: 'user', content: contextPrompt },
    ...messages,
  ];

  const model = await getChatModel();
  const result = streamText({
    model,
    system: systemPrompt,
    messages: fullMessages,
  });

  return result.toUIMessageStreamResponse();
}

/**
 * Handle conversational chat request.
 */
async function handleConversationalRequest(messages: CoreMessage[]): Promise<Response> {
  const model = await getChatModel();
  const result = streamText({
    model,
    system: chatOnlySystemPrompt,
    messages,
  });

  return result.toUIMessageStreamResponse();
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

    const body: ChatRequest = await req.json();
    const {
      messages,
      workspaceId,
      skipIntentClassification = false,
      isUpdate = false,
      relevantFiles = [],
    } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the last user message for intent classification
    const lastMessage = messages[messages.length - 1];
    const lastMessageContent =
      typeof lastMessage?.content === 'string' ? lastMessage.content : '';

    // Skip intent classification if explicitly requested or no workspace
    if (skipIntentClassification || !workspaceId) {
      return handleConversationalRequest(messages);
    }

    // Classify intent
    const baseUrl = req.nextUrl.origin;
    const intent = await classifyIntent(lastMessageContent, authHeader, baseUrl);

    // Route based on intent
    if (intent.isPlan && workspaceId) {
      return handlePlanRequest(messages, workspaceId, isUpdate, relevantFiles);
    }

    // Default: conversational
    return handleConversationalRequest(messages);
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
