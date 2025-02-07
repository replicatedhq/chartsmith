import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { WorkspaceFile } from "../types/workspace";
import { logger } from "../utils/logger";

interface PatchHunk {
  start: number;
  length: number;
  content: string[];
}

function parseUnifiedDiffHunk(hunkHeader: string, hunkContent: string[]): PatchHunk | null {
  logger.info('Parsing hunk header:', { hunkHeader });
  logger.info('Hunk content:', { hunkContent });

  const match = hunkHeader.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
  if (!match) {
    logger.warn('Failed to parse hunk header', { hunkHeader });
    return null;
  }

  const start = parseInt(match[2], 10);
  const hunk = {
    start: start - 1, // Convert to 0-based index
    length: hunkContent.length,
    content: hunkContent.filter(line => !line.startsWith('-'))
      .map(line => line.startsWith('+') ? line.slice(1) : line)
  };

  logger.info('Parsed hunk:', { hunk });
  return hunk;
}

function applyHunkToContent(content: string, hunk: PatchHunk): string {
  logger.info('Applying hunk:', {
    contentLength: content.length,
    hunkStart: hunk.start,
    hunkLength: hunk.length,
    hunkContent: hunk.content
  });

  const lines = content.split('\n');
  const before = lines.slice(0, hunk.start);
  const after = lines.slice(hunk.start + hunk.length);
  return [...before, ...hunk.content, ...after].join('\n');
}

export async function getFileByIdAndRevision(fileId: string, revision: number): Promise<WorkspaceFile> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `SELECT id, revision_number, chart_id, workspace_id, file_path, content, pending_patch
       FROM workspace_file
       WHERE id = $1 AND revision_number = $2`,
      [fileId, revision]
    );

    const file: WorkspaceFile = {
      id: result.rows[0].id,
      filePath: result.rows[0].file_path,
      content: result.rows[0].content,
      pendingPatch: result.rows[0].pending_patch
    }

    return file;
  } catch (error) {
    logger.error(`Error getting file by id and revision ${fileId} and ${revision}`, error);
    throw error;
  }
}

export async function applyPatch(file: WorkspaceFile): Promise<WorkspaceFile> {
  try {
    if (!file.pendingPatch) {
      return file;
    }

    try {
      logger.info('Starting patch application:', {
        fileId: file.id,
        patchLength: file.pendingPatch.length,
        contentLength: file.content.length
      });

      logger.debug('Patch content:', { patch: file.pendingPatch });

      const lines = file.pendingPatch.split('\n');
      logger.info('Split patch into lines:', { lineCount: lines.length });

      let content = file.content;
      let currentHunkLines: string[] = [];
      let currentHunkHeader: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        logger.debug('Processing line:', { lineNumber: i, line });

        if (line.startsWith('@@')) {
          // If we have a previous hunk, apply it
          if (currentHunkLines.length > 0 && currentHunkHeader) {
            logger.info('Found hunk marker, applying previous hunk:', {
              hunkLineCount: currentHunkLines.length,
              hunkHeader: currentHunkHeader
            });

            const hunk = parseUnifiedDiffHunk(currentHunkHeader, currentHunkLines);
            if (hunk) {
              content = applyHunkToContent(content, hunk);
            } else {
              logger.warn('Failed to parse hunk', {
                hunkLines: currentHunkLines,
                hunkHeader: currentHunkHeader
              });
            }
          }
          currentHunkLines = [];
          currentHunkHeader = line;
        } else if (currentHunkHeader && !line.startsWith('---') && !line.startsWith('+++')) {
          // Only collect lines if we have a hunk header and it's not a file header
          currentHunkLines.push(line);
        }
      }

      // Apply the last hunk if there is one
      if (currentHunkLines.length > 0 && currentHunkHeader) {
        logger.info('Processing final hunk:', {
          hunkLineCount: currentHunkLines.length,
          hunkHeader: currentHunkHeader
        });

        const hunk = parseUnifiedDiffHunk(currentHunkHeader, currentHunkLines);
        if (hunk) {
          content = applyHunkToContent(content, hunk);
        } else {
          logger.warn('Failed to parse final hunk', {
            hunkLines: currentHunkLines,
            hunkHeader: currentHunkHeader
          });
        }
      }

      file.content = content;
      logger.info('Patch application completed successfully');

    } catch (patchError) {
      logger.error('Patch application details:', {
        originalContent: file.content,
        patch: file.pendingPatch,
        error: patchError
      });
      throw new Error(`Failed to apply patch: ${patchError.message}`);
    }

    file.pendingPatch = undefined;

    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `UPDATE workspace_file
       SET content = $1, pending_patch = NULL
       WHERE id = $2`,
      [file.content, file.id]
    );

    return file;
  } catch (error) {
    logger.error(`Error applying patch to file ${file.id}`, error);
    throw error;
  }
}
