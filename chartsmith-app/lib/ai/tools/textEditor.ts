/**
 * textEditor Tool
 * 
 * This tool allows viewing, creating, and editing files in the chart.
 * It calls the Go HTTP endpoint /api/tools/editor for execution.
 * 
 * Supported commands:
 * - view: Read file contents
 * - create: Create a new file
 * - str_replace: Replace text in a file
 */

import { tool } from 'ai';
import { z } from 'zod';
import { callGoEndpoint } from './utils';

/**
 * Response format from the textEditor Go endpoint
 */
export interface TextEditorResponse {
  success: boolean;
  content?: string;
  message?: string;
}

/**
 * Create the textEditor tool
 * 
 * @param authHeader - Authorization header to forward to Go backend
 * @param workspaceId - The current workspace ID
 * @param revisionNumber - The current revision number
 * @returns A configured AI SDK tool
 */
export function createTextEditorTool(
  authHeader: string | undefined,
  workspaceId: string,
  revisionNumber: number
) {
  return tool({
    description: `View, edit, or create files in the chart.

Commands:
- view: Read the contents of a file. Returns the file content or an error if the file doesn't exist.
- create: Create a new file with the specified content. Fails if the file already exists.
- str_replace: Replace text in a file. Uses fuzzy matching if exact match is not found.

Use view to inspect files before editing. Use create for new files. Use str_replace for modifications.`,
    inputSchema: z.object({
      command: z.enum(['view', 'create', 'str_replace'])
        .describe('The operation to perform: view, create, or str_replace'),
      path: z.string()
        .describe('File path relative to chart root (e.g., "templates/deployment.yaml", "values.yaml")'),
      content: z.string()
        .optional()
        .describe('For create command: the full content of the new file'),
      oldStr: z.string()
        .optional()
        .describe('For str_replace command: the exact text to find and replace'),
      newStr: z.string()
        .optional()
        .describe('For str_replace command: the text to replace oldStr with'),
    }),
    execute: async (params: { command: 'view' | 'create' | 'str_replace'; path: string; content?: string; oldStr?: string; newStr?: string }) => {
      try {
        const response = await callGoEndpoint<TextEditorResponse>(
          '/api/tools/editor',
          {
            command: params.command,
            workspaceId,
            revisionNumber,
            path: params.path,
            content: params.content,
            oldStr: params.oldStr,
            newStr: params.newStr,
          },
          authHeader
        );
        
        return response;
      } catch (error) {
        console.error('textEditor error:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to execute text editor command',
        } as TextEditorResponse;
      }
    },
  });
}

// Export the tool factory
export default createTextEditorTool;

