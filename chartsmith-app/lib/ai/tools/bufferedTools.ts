/**
 * PR3.0: Buffered Tools
 *
 * Creates AI SDK tools that buffer file-modifying operations for the plan workflow.
 *
 * Per Decision 3:
 * - textEditor with 'view' → execute immediately (read-only)
 * - textEditor with 'create' → buffer for plan
 * - textEditor with 'str_replace' → buffer for plan
 * - Other tools → execute immediately (read-only)
 */

import { tool } from "ai";
import { z } from "zod";
import { callGoEndpoint } from "./utils";
import { createGetChartContextTool } from "./getChartContext";
import { createLatestSubchartVersionTool } from "./latestSubchartVersion";
import { createLatestKubernetesVersionTool } from "./latestKubernetesVersion";
import { createConvertK8sTool } from "./convertK8s";
import { BufferedToolCall } from "./toolInterceptor";

/**
 * Callback type for intercepting tool calls
 */
type ToolCallCallback = (toolCall: BufferedToolCall) => void;

/**
 * Response format from the textEditor Go endpoint
 */
interface TextEditorResponse {
  success: boolean;
  content?: string;
  message?: string;
}

/**
 * Creates all AI SDK tools with buffering support for file-modifying operations
 *
 * @param authHeader - Authorization header to forward to Go backend
 * @param workspaceId - The current workspace ID
 * @param revisionNumber - The current revision number
 * @param onToolCall - Callback invoked when a tool call is buffered
 * @param chatMessageId - PR3.0: Optional chat message ID for conversion tool
 * @returns Object containing all configured tools with buffering support
 */
export function createBufferedTools(
  authHeader: string | undefined,
  workspaceId: string,
  revisionNumber: number,
  onToolCall: ToolCallCallback,
  chatMessageId?: string
) {
  return {
    // textEditor: Only buffer create/str_replace, execute view immediately
    textEditor: tool({
      description: `View, edit, or create files in the chart.

Commands:
- view: Read the contents of a file. Returns the file content or an error if the file doesn't exist.
- create: Create a new file with the specified content. Fails if the file already exists.
- str_replace: Replace text in a file. Uses fuzzy matching if exact match is not found.

Use view to inspect files before editing. Use create for new files. Use str_replace for modifications.`,
      inputSchema: z.object({
        command: z
          .enum(["view", "create", "str_replace"])
          .describe("The operation to perform: view, create, or str_replace"),
        path: z
          .string()
          .describe(
            'File path relative to chart root (e.g., "templates/deployment.yaml", "values.yaml")'
          ),
        content: z
          .string()
          .optional()
          .describe("For create command: the full content of the new file"),
        oldStr: z
          .string()
          .optional()
          .describe(
            "For str_replace command: the exact text to find and replace"
          ),
        newStr: z
          .string()
          .optional()
          .describe("For str_replace command: the text to replace oldStr with"),
      }),
      execute: async (
        params: {
          command: "view" | "create" | "str_replace";
          path: string;
          content?: string;
          oldStr?: string;
          newStr?: string;
        },
        { toolCallId }
      ) => {
        // VIEW: Execute immediately (read-only, no side effects)
        if (params.command === "view") {
          try {
            const response = await callGoEndpoint<TextEditorResponse>(
              "/api/tools/editor",
              {
                command: params.command,
                workspaceId,
                revisionNumber,
                path: params.path,
              },
              authHeader
            );
            return response;
          } catch (error) {
            return {
              success: false,
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to view file",
            };
          }
        }

        // CREATE/STR_REPLACE: Buffer for plan workflow
        onToolCall({
          id: toolCallId,
          toolName: "textEditor",
          args: params,
          timestamp: Date.now(),
        });

        // Return a "pending" result so AI knows the action was acknowledged
        return {
          success: true,
          message: `File change will be applied after review: ${params.command} ${params.path}`,
          buffered: true,
        };
      },
    }),

    // All other tools execute immediately (read-only, no buffering needed)
    getChartContext: createGetChartContextTool(
      workspaceId,
      revisionNumber,
      authHeader || ""
    ),
    latestSubchartVersion: createLatestSubchartVersionTool(authHeader),
    latestKubernetesVersion: createLatestKubernetesVersionTool(authHeader),
    // PR3.0: Include conversion tool if chatMessageId is provided
    ...(chatMessageId
      ? { convertK8sToHelm: createConvertK8sTool(authHeader, workspaceId, chatMessageId) }
      : {}),
  };
}

