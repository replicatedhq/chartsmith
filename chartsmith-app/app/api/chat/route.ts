import { streamText, tool } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { getWorkspace } from '@/lib/workspace/workspace';
import { logger } from '@/lib/utils/logger';

/**
 * Tool: Get latest subchart version from ArtifactHub
 * Ported from pkg/recommendations/subchart.go
 */
async function getLatestSubchartVersion(chartName: string): Promise<string> {
  // Special handling for Replicated charts
  if (chartName.toLowerCase().includes('replicated')) {
    try {
      const response = await fetch('https://api.github.com/repos/replicatedhq/replicated-sdk/releases/latest', {
        headers: {
          'User-Agent': 'chartsmith/1.0',
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.tag_name || '?';
      }
    } catch (error) {
      logger.error('Failed to fetch Replicated version', { error });
    }
  }
  
  // Search ArtifactHub for the chart
  try {
    const encodedChartName = encodeURIComponent(chartName);
    const response = await fetch(
      `https://artifacthub.io/api/v1/packages/search?offset=0&limit=20&facets=false&ts_query_web=${encodedChartName}&kind=0&deprecated=false&sort=relevance`,
      {
        headers: {
          'User-Agent': 'chartsmith/1.0',
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      return '?';
    }
    
    const data = await response.json();
    
    if (!data.packages || data.packages.length === 0) {
      return '?';
    }
    
    return data.packages[0].version || '?';
  } catch (error) {
    logger.error('Failed to search ArtifactHub', { error, chartName });
    return '?';
  }
}

/**
 * Tool: Get latest Kubernetes version
 * Ported from pkg/llm/conversational.go
 */
function getLatestKubernetesVersion(semverField: string): string {
  switch (semverField) {
    case 'major':
      return '1';
    case 'minor':
      return '1.32';
    case 'patch':
      return '1.32.1';
    default:
      return '1.32.1';
  }
}

/**
 * Build system prompt with workspace context
 */
function buildSystemPrompt(workspaceId: string): string {
  return `You are a helpful AI assistant for Chartsmith, a Helm chart development tool.
You help users understand and work with Helm charts and Kubernetes configurations.

Current workspace: ${workspaceId}

Guidelines:
- Provide clear, accurate information about Helm charts and Kubernetes
- Use the available tools to get latest versions when needed
- Be concise but thorough in your explanations
- If you're unsure about something, say so

Remember: You're in conversational mode. For chart modifications, the user should use the plan feature.`;
}

/**
 * POST /api/chat
 * Handles conversational chat messages using Vercel AI SDK
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, workspaceId, modelId } = await req.json();
    
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
    
    // Get model instance (uses default or specified model)
    const model = getModel(modelId);
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt(workspaceId);
    
    // Stream response with tools
    const result = streamText({
      model,
      messages,
      system: systemPrompt,
      tools: {
        latest_subchart_version: {
          description: 'Return the latest version of a subchart from name',
          inputSchema: z.object({
            chart_name: z.string().describe('The subchart name to get the latest version of'),
          }),
          execute: async ({ chart_name }) => {
            logger.debug('Tool called: latest_subchart_version', { chart_name });
            const version = await getLatestSubchartVersion(chart_name);
            return version;
          },
        },
        latest_kubernetes_version: {
          description: 'Return the latest version of Kubernetes',
          inputSchema: z.object({
            semver_field: z.enum(['major', 'minor', 'patch']).describe("One of 'major', 'minor', or 'patch'"),
          }),
          execute: async ({ semver_field }) => {
            logger.debug('Tool called: latest_kubernetes_version', { semver_field });
            const version = getLatestKubernetesVersion(semver_field);
            return version;
          },
        },
      },
    });
    
    return result.toTextStreamResponse();
  } catch (error) {
    logger.error('Error in chat API', { error });
    return new Response('Internal Server Error', { status: 500 });
  }
}