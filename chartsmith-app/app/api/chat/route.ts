import { streamText, tool } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { getWorkspace } from '@/lib/workspace/workspace';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

async function getLatestSubchartVersion(chartName: string): Promise<string> {
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

export async function POST(req: NextRequest) {
  try {
    const { messages, workspaceId, modelId } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!workspaceId) {
      return new Response('Workspace ID required', { status: 400 });
    }
    
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return new Response('Workspace not found', { status: 404 });
    }
    
    const model = getModel(modelId);
    
    const result = streamText({
      model,
      messages,
      abortSignal: AbortSignal.timeout(120000),
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
    return handleApiError(error, 'chat API');
  }
}