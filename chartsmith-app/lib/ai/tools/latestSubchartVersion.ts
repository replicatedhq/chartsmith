/**
 * latestSubchartVersion Tool
 * 
 * This tool looks up the latest version of a Helm subchart from ArtifactHub.
 * It calls the Go HTTP endpoint /api/tools/versions/subchart for execution.
 * 
 * Use this when the user asks about subchart versions or wants to add dependencies.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { callGoEndpoint } from './utils';

/**
 * Response format from the subchart version Go endpoint
 */
export interface SubchartVersionResponse {
  success: boolean;
  version: string;
  name: string;
}

/**
 * Create the latestSubchartVersion tool
 * 
 * @param authHeader - Authorization header to forward to Go backend
 * @returns A configured AI SDK tool
 */
export function createLatestSubchartVersionTool(authHeader: string | undefined) {
  return tool({
    description: `Look up the latest version of a Helm subchart on ArtifactHub.

Use this when the user asks about:
- "What's the latest version of the PostgreSQL chart?"
- "What version of redis should I use?"
- Adding subchart dependencies to Chart.yaml

Returns the version number (e.g., "15.2.0") or "?" if the chart is not found.`,
    inputSchema: z.object({
      chartName: z.string()
        .describe('Name of the subchart to look up (e.g., "postgresql", "redis", "nginx")'),
      repository: z.string()
        .optional()
        .describe('Optional: specific repository to search (defaults to ArtifactHub search)'),
    }),
    execute: async (params: { chartName: string; repository?: string }) => {
      try {
        const response = await callGoEndpoint<SubchartVersionResponse>(
          '/api/tools/versions/subchart',
          {
            chartName: params.chartName,
            repository: params.repository,
          },
          authHeader
        );
        
        return response;
      } catch (error) {
        console.error('latestSubchartVersion error:', error);
        return {
          success: false,
          version: '?',
          name: params.chartName,
        } as SubchartVersionResponse;
      }
    },
  });
}

// Export the tool factory
export default createLatestSubchartVersionTool;

