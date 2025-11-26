/**
 * Text Editor Database Helper
 *
 * Handles all database operations for the text editor tool:
 * - View file contents
 * - Replace text in files
 * - Create new files
 *
 * Maintains workspace file revisions in PostgreSQL.
 */

import { query } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

interface FileOperation {
  success: boolean;
  message?: string;
  content?: string;
  error?: string;
  old_str_found?: boolean;
  replacements_made?: number;
}

interface WorkspaceFile {
  id: string;
  revision_number: number | null;
  chart_id: string | null;
  workspace_id: string;
  file_path: string;
  content: string;
  content_pending: string | null;
  embeddings: any;
}

/**
 * View file contents from workspace
 *
 * @param workspaceId - Workspace ID
 * @param filePath - File path relative to chart root
 * @returns File content or error
 */
export async function viewFile(
  workspaceId: string,
  filePath: string
): Promise<FileOperation> {
  try {
    if (!workspaceId || !filePath) {
      return {
        success: false,
        error: 'Missing workspaceId or filePath',
      };
    }

    // Query for the latest revision of the file
    const sql = `
      SELECT content
      FROM workspace_file
      WHERE workspace_id = $1 AND file_path = $2
      ORDER BY revision_number DESC NULLS LAST
      LIMIT 1
    `;

    const rows = await query<{ content: string }[]>(sql, [
      workspaceId,
      filePath,
    ]);

    if (!rows || rows.length === 0) {
      console.warn(
        `[textEditorDb] File not found: ${filePath} in workspace ${workspaceId}`
      );
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    const file = rows[0];

    return {
      success: true,
      content: file.content,
      message: `File viewed successfully: ${filePath}`,
    };
  } catch (error) {
    console.error(`[textEditorDb] Error viewing file:`, error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Replace text in a file
 *
 * @param workspaceId - Workspace ID
 * @param filePath - File path relative to chart root
 * @param oldStr - String to find (exact match or fuzzy for >50 chars)
 * @param newStr - Replacement string
 * @returns Success status and number of replacements
 */
export async function replaceTextInFile(
  workspaceId: string,
  filePath: string,
  oldStr: string,
  newStr: string
): Promise<FileOperation> {
  try {
    if (!workspaceId || !filePath || !oldStr === undefined || newStr === undefined) {
      return {
        success: false,
        error: 'Missing required parameters',
      };
    }

    // Step 1: Get current file content
    const selectSql = `
      SELECT id, content, revision_number
      FROM workspace_file
      WHERE workspace_id = $1 AND file_path = $2
      ORDER BY revision_number DESC NULLS LAST
      LIMIT 1
    `;

    const rows = await query<
      { id: string; content: string; revision_number: number | null }[]
    >(selectSql, [workspaceId, filePath]);

    if (!rows || rows.length === 0) {
      console.warn(
        `[textEditorDb] File not found for replacement: ${filePath}`
      );
      return {
        success: false,
        error: `File not found: ${filePath}. Use create command instead.`,
      };
    }

    const currentFile = rows[0];
    const { content: oldContent, id: fileId, revision_number } = currentFile;

    // Step 2: Perform string replacement
    let newContent: string;
    let found = false;
    let replacementCount = 0;

    if (oldStr.length > 50) {
      // Fuzzy matching for long strings (>50 chars)
      // Use a simple similarity check - if old_str is found as a substring
      const index = oldContent.indexOf(oldStr);
      if (index !== -1) {
        newContent = oldContent.replace(oldStr, newStr);
        found = true;
        replacementCount = 1;
      } else {
        // Try case-insensitive match
        const lowerOldContent = oldContent.toLowerCase();
        const lowerOldStr = oldStr.toLowerCase();
        const fuzzyIndex = lowerOldContent.indexOf(lowerOldStr);

        if (fuzzyIndex !== -1) {
          // Extract the actual string from original content
          const actualOldStr = oldContent.substring(
            fuzzyIndex,
            fuzzyIndex + oldStr.length
          );
          newContent = oldContent.replace(actualOldStr, newStr);
          found = true;
          replacementCount = 1;
        } else {
          newContent = oldContent;
          found = false;
        }
      }
    } else {
      // Exact matching for short strings
      if (oldContent.includes(oldStr)) {
        newContent = oldContent.replace(oldStr, newStr);
        found = true;
        // Count occurrences (only first one is replaced)
        replacementCount = 1;
      } else {
        newContent = oldContent;
        found = false;
      }
    }

    if (!found) {
      // Log the failed replacement attempt
      const logId = uuidv4();
      const logSql = `
        INSERT INTO str_replace_log (
          id, created_at, file_path, found, old_str, new_str,
          updated_content, old_str_len, new_str_len, error_message
        ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      await query(logSql, [
        logId,
        filePath,
        false,
        oldStr,
        newStr,
        oldContent,
        oldStr.length,
        newStr.length,
        'String not found in file content',
      ]);

      return {
        success: false,
        old_str_found: false,
        error: `String not found in file. No replacement made.`,
      };
    }

    // Step 3: Update workspace_file with new content
    const updateSql = `
      UPDATE workspace_file
      SET content = $1, content_pending = NULL
      WHERE id = $2 AND workspace_id = $3 AND file_path = $4
    `;

    await query(updateSql, [newContent, fileId, workspaceId, filePath]);

    // Step 4: Log the successful replacement
    const logId = uuidv4();
    const logSql = `
      INSERT INTO str_replace_log (
        id, created_at, file_path, found, old_str, new_str,
        updated_content, old_str_len, new_str_len,
        context_before, context_after
      ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    // Extract context around the replacement (first 100 chars before and after)
    const replacementIndex = oldContent.indexOf(oldStr);
    const contextBefore =
      replacementIndex > 0
        ? oldContent.substring(Math.max(0, replacementIndex - 100), replacementIndex)
        : '';
    const contextAfter = oldContent.substring(
      replacementIndex + oldStr.length,
      Math.min(
        oldContent.length,
        replacementIndex + oldStr.length + 100
      )
    );

    await query(logSql, [
      logId,
      filePath,
      true,
      oldStr,
      newStr,
      newContent,
      oldStr.length,
      newStr.length,
      contextBefore,
      contextAfter,
    ]);

    return {
      success: true,
      old_str_found: true,
      replacements_made: replacementCount,
      message: `Successfully replaced ${replacementCount} occurrence(s) in ${filePath}`,
    };
  } catch (error) {
    console.error(`[textEditorDb] Error replacing text:`, error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Create a new file in the workspace
 *
 * @param workspaceId - Workspace ID
 * @param filePath - File path relative to chart root
 * @param content - File content
 * @returns Success status
 */
export async function createFile(
  workspaceId: string,
  filePath: string,
  content: string
): Promise<FileOperation> {
  try {
    if (!workspaceId || !filePath) {
      return {
        success: false,
        error: 'Missing workspaceId or filePath',
      };
    }

    // Content can be empty string
    if (content === undefined || content === null) {
      return {
        success: false,
        error: 'Content parameter is required',
      };
    }

    // Step 1: Check if file already exists
    const checkSql = `
      SELECT id, content
      FROM workspace_file
      WHERE workspace_id = $1 AND file_path = $2
      ORDER BY revision_number DESC NULLS LAST
      LIMIT 1
    `;

    const existingRows = await query<{ id: string; content: string }[]>(
      checkSql,
      [workspaceId, filePath]
    );

    if (existingRows && existingRows.length > 0) {
      console.warn(
        `[textEditorDb] File already exists: ${filePath} in workspace ${workspaceId}`
      );
      return {
        success: false,
        error: `File already exists: ${filePath}. Use str_replace to modify it.`,
      };
    }

    // Step 2: Get current workspace revision number
    const revisionSql = `
      SELECT current_revision_number
      FROM workspace
      WHERE id = $1
    `;

    const revisionRows = await query<{ current_revision_number: number }[]>(
      revisionSql,
      [workspaceId]
    );

    const currentRevision =
      revisionRows && revisionRows.length > 0
        ? revisionRows[0].current_revision_number
        : 0;

    // Step 3: Insert new file into workspace_file table
    const fileId = uuidv4();
    const insertSql = `
      INSERT INTO workspace_file (
        id, workspace_id, file_path, content,
        revision_number, chart_id, content_pending
      )
      VALUES ($1, $2, $3, $4, $5, NULL, NULL)
    `;

    await query(insertSql, [
      fileId,
      workspaceId,
      filePath,
      content,
      currentRevision,
    ]);

    return {
      success: true,
      message: `File created successfully: ${filePath}`,
      content: content,
    };
  } catch (error) {
    console.error(`[textEditorDb] Error creating file:`, error);

    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return {
        success: false,
        error: `File already exists: ${filePath}. Use str_replace to modify it.`,
      };
    }

    return {
      success: false,
      error: String(error),
    };
  }
}
