/**
 * Plan generation API route using Vercel AI SDK.
 * Handles streaming plan generation for creating/updating Helm charts.
 * Ported from pkg/llm/plan.go and pkg/llm/initial-plan.go
 */

import { streamText, type CoreMessage } from 'ai';
import { NextRequest } from 'next/server';
import { getChatModel } from '@/lib/llm/model-provider';
import {
  initialPlanSystemPrompt,
  updatePlanSystemPrompt,
  initialPlanInstructions,
  updatePlanInstructions,
} from '@/lib/llm/prompts';
import { userIdFromExtensionToken } from '@/lib/auth/extension-token';
import { getWorkspace } from '@/lib/workspace/workspace';

/**
 * Request body for plan generation.
 */
interface PlanRequest {
  messages: CoreMessage[];
  workspaceId: string;
  isUpdate?: boolean;
  relevantFiles?: { path: string; content: string }[];
}

/**
 * Build chart structure string from workspace files.
 * Ported from pkg/llm/conversational.go:getChartStructure
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

    const body: PlanRequest = await req.json();
    const { messages, workspaceId, isUpdate = false, relevantFiles = [] } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Workspace ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Use toUIMessageStreamResponse for integration with useChat hook (AI SDK v5)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Plan API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
