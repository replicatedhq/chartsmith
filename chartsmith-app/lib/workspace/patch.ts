import { WorkspaceFile } from "../types/workspace";
import { logger } from "../utils/logger";
import { getDB } from "../data/db";
import { getParam } from "../data/param";

interface PatchHunk {
  start: number;
  length: number;
  content: string[];
}

function parseUnifiedDiffHunk(hunkHeader: string, hunkContent: string[]): PatchHunk | null {
  logger.info('Parsing hunk header:', { hunkHeader });
  logger.info('Hunk content:', { hunkContent });

  const match = hunkHeader.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
  if (!match) {
    logger.warn('Failed to parse hunk header', { hunkHeader });
    throw new Error('Failed to parse hunk header');
  }

  const oldStart = parseInt(match[1], 10);
  const oldLength = match[2] ? parseInt(match[2], 10) : 1;
  const newStart = parseInt(match[3], 10);
  const newLength = match[4] ? parseInt(match[4], 10) : 1;

  const contentLines: string[] = [];
  let i = 0;
  let removedLines = 0;

  while (i < hunkContent.length) {
    const line = hunkContent[i];
    if (line.startsWith('-')) {
      removedLines++;
      i++;
      continue;
    }
    if (line.startsWith('+')) {
      const content = line.slice(1).replace(/^ /, '');
      contentLines.push(content);
    } else if (!line.startsWith('\\')) { // Ignore "No newline at end of file" markers
      const content = line.replace(/^ /, '');
      contentLines.push(content);
    }
    i++;
  }

  const hunk = {
    start: newStart - 1, // Convert to 0-based index
    length: oldLength,
    content: contentLines
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

  if (!content) {
    return hunk.content.join('\n');
  }

  const lines = content.split('\n');
  const before = lines.slice(0, hunk.start);
  const after = lines.slice(hunk.start + hunk.length);

  return [...before, ...hunk.content, ...after].join('\n');
}

function findMatchingLine(content: string[], startLine: number, contextLines: string[]): number {
  // Look for the context lines in the original content
  for (let i = Math.max(0, startLine - 10); i < content.length - contextLines.length + 1; i++) {
    let matches = true;
    for (let j = 0; j < contextLines.length; j++) {
      const contextLine = contextLines[j].startsWith(' ') ? contextLines[j].substring(1) : contextLines[j];
      if (content[i + j] !== contextLine) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return i;
    }
  }
  return startLine;
}

export async function updateFileAfterPatchOperation(
  fileId: string,
  revisionNumber: number,
  content: string,
  pendingPatch: string | undefined
): Promise<void> {
  try {
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `UPDATE workspace_file
       SET content = $1, pending_patch = $2
       WHERE id = $3 AND revision_number = $4`,
      [content, pendingPatch, fileId, revisionNumber]
    );
  } catch (error) {
    logger.error(`Error updating file content for file ${fileId}`, error);
    throw error;
  }
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
    let seenFileHeader = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      logger.debug('Processing line:', { lineNumber: i, line });

      // Skip duplicate file headers
      if ((line.startsWith('---') || line.startsWith('+++')) && seenFileHeader) {
        // Skip both header lines
        i++;
        continue;
      }

      // Track first file header
      if (line.startsWith('---')) {
        seenFileHeader = true;
        continue;
      }

      // Skip +++ line after first file header
      if (line.startsWith('+++')) {
        continue;
      }

      if (line.startsWith('@@')) {
        // If we have a previous hunk, apply it
        if (currentHunkLines.length > 0 && currentHunkHeader) {
          logger.info('Found hunk marker, applying previous hunk:', {
            hunkLineCount: currentHunkLines.length,
            hunkHeader: currentHunkHeader
          });

          // Look ahead to get context lines for finding the correct position
          const contextLines = currentHunkLines.filter(l => !l.startsWith('-') && !l.startsWith('+') && !l.startsWith('\\')).slice(0, 3);

          const hunk = parseUnifiedDiffHunk(currentHunkHeader, currentHunkLines);
          if (hunk) {
            // Find the actual line number where content matches
            const contentLines = content.split('\n');
            hunk.start = findMatchingLine(contentLines, hunk.start, contextLines);
            content = applyHunkToContent(content, hunk);
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

      // Look ahead to get context lines for finding the correct position
      const contextLines = currentHunkLines.filter(l => !l.startsWith('-') && !l.startsWith('+') && !l.startsWith('\\')).slice(0, 3);

      const hunk = parseUnifiedDiffHunk(currentHunkHeader, currentHunkLines);
      if (hunk) {
        // Find the actual line number where content matches
        const contentLines = content.split('\n');
        hunk.start = findMatchingLine(contentLines, hunk.start, contextLines);
        content = applyHunkToContent(content, hunk);
      }
    }

    logger.info('Patch application completed successfully');

    return {
      ...file,
      content,
      pendingPatch: undefined
    };
  } catch (error) {
    logger.error('Failed to apply patch:', error);
    throw new Error('Failed to apply patch');
  }
}
