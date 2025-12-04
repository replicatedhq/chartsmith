/**
 * latestKubernetesVersion Tool
 * 
 * This tool provides current Kubernetes version information.
 * It calls the Go HTTP endpoint /api/tools/versions/kubernetes for execution.
 * 
 * Use this when the user asks about Kubernetes versions for API compatibility.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { callGoEndpoint } from './utils';

/**
 * Response format from the Kubernetes version Go endpoint
 */
export interface KubernetesVersionResponse {
  success: boolean;
  version: string;
  field: string;
}

/**
 * Create the latestKubernetesVersion tool
 * 
 * @param authHeader - Authorization header to forward to Go backend
 * @returns A configured AI SDK tool
 */
export function createLatestKubernetesVersionTool(authHeader: string | undefined) {
  return tool({
    description: `Get current Kubernetes version information for API compatibility decisions.

Use this when the user asks about:
- "What's the latest Kubernetes version?"
- Kubernetes API version compatibility
- Which API versions to target in their charts

Returns version in requested format:
- major: "1"
- minor: "1.32"
- patch (default): "1.32.1"`,
    inputSchema: z.object({
      semverField: z.enum(['major', 'minor', 'patch'])
        .optional()
        .describe('Version field to return: major (1), minor (1.32), or patch (1.32.1). Defaults to patch.'),
    }),
    execute: async (params: { semverField?: 'major' | 'minor' | 'patch' }) => {
      try {
        const response = await callGoEndpoint<KubernetesVersionResponse>(
          '/api/tools/versions/kubernetes',
          {
            semverField: params.semverField || 'patch',
          },
          authHeader
        );
        
        return response;
      } catch (error) {
        console.error('latestKubernetesVersion error:', error);
        return {
          success: false,
          version: '1.32.1', // Fallback to known version
          field: params.semverField || 'patch',
        } as KubernetesVersionResponse;
      }
    },
  });
}

// Export the tool factory
export default createLatestKubernetesVersionTool;

