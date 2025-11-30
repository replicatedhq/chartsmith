/**
 * AI Chat Streaming API Route
 * 
 * Handles conversational chat using Vercel AI SDK with support for multiple providers.
 * This route handles simple Q&A and conversational interactions.
 * Complex operations (plan generation, conversions) still use the Go worker.
 */

import { streamText, tool } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { getProviderModel, validateProviderConfig, AIProvider } from '@/lib/ai/provider-factory';
import { getSystemPromptForPersona, buildChartStructureContext, buildFileContext } from '@/lib/ai/system-prompts';
import { getWorkspace } from '@/lib/workspace/workspace';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  workspaceId: string;
  provider: AIProvider;
  model: string;
  sessionId?: string;
  messageFromPersona?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { messages, workspaceId, provider, model, messageFromPersona = 'auto' } = body;

    // Validate provider configuration
    const configError = validateProviderConfig(provider);
    if (configError) {
      return new Response(
        JSON.stringify({ error: configError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace context (if workspace ID is provided)
    const systemMessages: Array<{ role: 'system' | 'assistant'; content: string }> = [];
    
    // Add base system prompt
    const systemPrompt = getSystemPromptForPersona(messageFromPersona);
    systemMessages.push({ role: 'system', content: systemPrompt });

    // Add workspace context if available
    if (workspaceId && workspaceId !== 'new') {
      try {
        const workspace = await getWorkspace(workspaceId);
        
        if (workspace && workspace.charts && workspace.charts.length > 0) {
          const chart = workspace.charts[0];
          
          // Build chart structure context
          const chartStructure = chart.files
            .map(f => f.filePath)
            .join(', ');
          
          systemMessages.push({
            role: 'assistant',
            content: buildChartStructureContext(chartStructure)
          });

          // Add relevant file contents (limit to avoid token overflow)
          // For now, add key files like Chart.yaml, values.yaml
          const keyFiles = chart.files.filter(f => 
            f.filePath === 'Chart.yaml' || 
            f.filePath === 'values.yaml' ||
            f.filePath.endsWith('_helpers.tpl')
          ).slice(0, 3);

          for (const file of keyFiles) {
            systemMessages.push({
              role: 'assistant',
              content: buildFileContext(file.filePath, file.content)
            });
          }
        }
      } catch (error) {
        logger.error('Error fetching workspace context:', error);
        // Continue without workspace context
      }
    }

    // Get the provider model instance
    const providerModel = getProviderModel(provider, model);

    // Define tools for AI to use
    const tools = {
      latest_subchart_version: tool({
        description: 'Get the latest version of a subchart from ArtifactHub',
        parameters: z.object({
          chart_name: z.string().describe('The subchart name to get the latest version of'),
        }),
        execute: async ({ chart_name }) => {
          // For now, return a placeholder
          // TODO: Integrate with ArtifactHub API
          logger.info(`Tool call: latest_subchart_version for ${chart_name}`);
          return { version: 'latest', message: 'Feature coming soon' };
        },
      }),
      latest_kubernetes_version: tool({
        description: 'Get the latest Kubernetes version',
        parameters: z.object({
          semver_field: z.enum(['major', 'minor', 'patch']).describe('One of major, minor, or patch'),
        }),
        execute: async ({ semver_field }) => {
          logger.info(`Tool call: latest_kubernetes_version for ${semver_field}`);
          // Return current Kubernetes versions
          const versions = {
            major: '1',
            minor: '1.32',
            patch: '1.32.1',
          };
          return { version: versions[semver_field] };
        },
      }),
    };

    // Combine system messages with user messages
    const allMessages = [
      ...systemMessages,
      ...messages,
    ];

    // Stream the response
    const result = streamText({
      model: providerModel,
      messages: allMessages,
      tools,
      maxTokens: 8192,
      temperature: 0.7,
    });

    // Return the streaming response
    return result.toDataStreamResponse();
    
  } catch (error) {
    logger.error('Error in AI chat route:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

