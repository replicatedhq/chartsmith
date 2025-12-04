/**
 * getChartContext Tool
 * 
 * This tool retrieves the current chart context including all files and metadata.
 * It calls the Go HTTP endpoint at POST /api/tools/context.
 * 
 * This is the primary tool the AI uses to understand the current state of the chart.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { callGoEndpoint } from './utils';

/**
 * Response format for getChartContext tool
 */
export interface ChartContextResponse {
  success: boolean;
  charts?: Array<{
    id: string;
    name: string;
    files: Array<{
      id: string;
      filePath: string;
      content: string;
      contentPending?: string;
    }>;
  }>;
  revisionNumber?: number;
  message?: string;
}

/**
 * Create the getChartContext tool
 * 
 * This tool loads the current workspace and returns its structure including
 * all charts, files, and metadata. The AI uses this to understand what
 * files exist and their contents before making modifications.
 * 
 * @param workspaceId - The workspace ID (from request body closure)
 * @param revisionNumber - The revision number (from request body closure)
 * @param authHeader - The Authorization header (from request closure)
 * @returns A configured AI SDK tool
 */
export function createGetChartContextTool(
  workspaceId: string,
  revisionNumber: number,
  authHeader: string
) {
  return tool({
    description: `Get the current chart context including all files and metadata. 
Use this tool to understand what files exist in the chart and their current contents.
This is typically the first tool to use when you need to understand the chart structure.`,
    inputSchema: z.object({
      // workspaceId is passed via closure, but we include it for explicit invocation
      workspaceId: z.string()
        .optional()
        .describe('The workspace ID to load (optional, uses current workspace if not specified)'),
    }),
    execute: async (params: { workspaceId?: string }) => {
      // Use provided workspaceId or fall back to the one from closure
      const targetWorkspaceId = params.workspaceId || workspaceId;
      
      if (!targetWorkspaceId) {
        return {
          success: false,
          message: 'No workspace ID provided',
        } as ChartContextResponse;
      }
      
      try {
        // Call Go HTTP endpoint
        const response = await callGoEndpoint<ChartContextResponse>(
          '/api/tools/context',
          {
            workspaceId: targetWorkspaceId,
            revisionNumber,
          },
          authHeader
        );
        
        return response;
      } catch (error) {
        console.error('getChartContext error:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to get chart context',
        } as ChartContextResponse;
      }
    },
  });
}

// Export the tool factory
export default createGetChartContextTool;
