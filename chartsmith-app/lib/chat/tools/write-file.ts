/**
 * Write File Tool
 *
 * Allows the AI to create or update files in a workspace chart.
 * Files are written to content_pending for user review before being committed.
 */

import { z } from "zod";
import { tool } from "ai";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";
import { nanoid } from "nanoid";

/**
 * Input schema for the write file tool
 */
export const writeFileInputSchema = z.object({
  file_path: z
    .string()
    .describe("The file path within the chart (e.g., 'Chart.yaml', 'templates/deployment.yaml', 'values.yaml')"),
  content: z
    .string()
    .describe("The complete file content to write"),
});

export type WriteFileInput = z.infer<typeof writeFileInputSchema>;

/**
 * Context needed for file operations
 */
export interface WriteFileContext {
  workspaceId: string;
  chartId: string;
  revisionNumber: number;
}

/**
 * Execute the file write operation
 *
 * This creates or updates a file in the workspace chart.
 * New content goes to content_pending for review.
 */
export async function executeWriteFile(
  input: WriteFileInput,
  context: WriteFileContext
): Promise<string> {
  const { file_path, content } = input;
  const { workspaceId, chartId, revisionNumber } = context;

  logger.info("Writing file via AI tool", { file_path, workspaceId, chartId, revisionNumber });

  try {
    const db = getDB(await getParam("DB_URI"));

    // Check if file already exists
    const existingFile = await db.query(
      `SELECT id FROM workspace_file
       WHERE workspace_id = $1 AND revision_number = $2 AND file_path = $3`,
      [workspaceId, revisionNumber, file_path]
    );

    if (existingFile.rows.length > 0) {
      // Update existing file - set content_pending for review
      await db.query(
        `UPDATE workspace_file
         SET content_pending = $1
         WHERE workspace_id = $2 AND revision_number = $3 AND file_path = $4`,
        [content, workspaceId, revisionNumber, file_path]
      );
      logger.info("Updated existing file", { file_path });
      return `Updated file: ${file_path}`;
    } else {
      // Create new file
      const fileId = nanoid(12);
      await db.query(
        `INSERT INTO workspace_file
         (id, revision_number, chart_id, workspace_id, file_path, content, content_pending)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [fileId, revisionNumber, chartId, workspaceId, file_path, content, null]
      );
      logger.info("Created new file", { file_path, fileId });
      return `Created file: ${file_path}`;
    }
  } catch (error) {
    logger.error("Error writing file", { file_path, error });
    throw error;
  }
}

/**
 * Create the write file tool with context
 *
 * This is a factory function that creates a tool bound to a specific workspace context.
 */
export function createWriteFileTool(context: WriteFileContext) {
  return tool({
    description: "Create or update a file in the Helm chart. Use this to write Chart.yaml, values.yaml, templates, and other chart files.",
    inputSchema: writeFileInputSchema,
    execute: async (input: WriteFileInput) => {
      return executeWriteFile(input, context);
    },
  });
}
