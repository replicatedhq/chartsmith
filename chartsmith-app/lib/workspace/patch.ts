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
    
    // Instead of throwing an error, try to reconstruct a basic hunk
    // This is a more fault-tolerant approach for LLM-generated diffs
    const calculatedInfo = calculateHunkInfo(hunkContent);
    
    return {
      start: 0, // Default to the beginning of the file
      length: calculatedInfo.oldLines,
      content: processHunkContent(hunkContent, calculatedInfo.oldLines)
    };
  }

  const oldStart = parseInt(match[1], 10);
  const oldLength = match[2] ? parseInt(match[2], 10) : 1;
  const newStart = parseInt(match[3], 10);
  const newLength = match[4] ? parseInt(match[4], 10) : 1;

  const contentLines = processHunkContent(hunkContent, oldLength);

  const hunk = {
    start: newStart - 1, // Convert to 0-based index
    length: oldLength,
    content: contentLines
  };

  logger.info('Parsed hunk:', { hunk });
  return hunk;
}

function calculateHunkInfo(lines: string[]) {
  let oldLines = 0;
  let newLines = 0;

  lines.forEach(line => {
    if (line.startsWith('+')) newLines++;
    else if (line.startsWith('-')) oldLines++;
    else if (line.startsWith(' ')) {
      oldLines++;
      newLines++;
    }
  });

  // If we didn't find any content lines, default to 1
  if (oldLines === 0) oldLines = 1;
  if (newLines === 0) newLines = 1;

  return {
    oldLines,
    newLines
  };
}

function processHunkContent(hunkContent: string[], oldLength: number): string[] {
  const contentLines: string[] = [];
  const originalLines: string[] = [];
  const removedLines: {index: number, content: string}[] = [];
  const contextIndentation: {[index: number]: string} = {};
  
  // First pass: gather context and tracking removals to infer indentation
  hunkContent.forEach((line, idx) => {
    if (line.startsWith(' ')) {
      // Context line - extract and store indentation
      const content = line.slice(1);
      const indentation = extractIndentation(content);
      contextIndentation[idx] = indentation;
      originalLines.push(content);
      contentLines.push(content);
    } else if (line.startsWith('-')) {
      // Removed line - only in original but track for indentation reference
      removedLines.push({ index: idx, content: line.slice(1) });
      originalLines.push(line.slice(1));
    }
  });
  
  // Second pass: apply indentation to added lines based on context
  hunkContent.forEach((line, idx) => {
    if (line.startsWith('+')) {
      const content = line.slice(1);
      let indentation = '';
      
      // Find the appropriate indentation to use
      // Check if previous line has indentation
      if (idx > 0) {
        if (contextIndentation[idx-1]) {
          // Use indentation from previous context line
          indentation = contextIndentation[idx-1];
        } else if (removedLines.find(r => r.index === idx-1)) {
          // If previous line was removed, use its indentation
          const prevRemoved = removedLines.find(r => r.index === idx-1);
          if (prevRemoved) {
            indentation = extractIndentation(prevRemoved.content);
          }
        }
      }
      
      // If we couldn't find indentation from nearby context,
      // try to infer it from the content itself (for YAML-like files)
      if (!indentation && content.trim() && isYamlLike(content) && idx > 0) {
        // For YAML-like content, try to maintain proper indentation
        const prevContent = idx > 0 ? 
          (contextIndentation[idx-1] ? originalLines[idx-1] :
           (removedLines.find(r => r.index === idx-1)?.content || '')) : '';
        
        if (prevContent) {
          // If previous line ends with a colon, add 2 spaces 
          // (common YAML indentation pattern)
          if (prevContent.trim().endsWith(':')) {
            const baseIndent = extractIndentation(prevContent);
            indentation = baseIndent + '  ';
          } 
          // If content looks like a YAML list item, align with previous items
          else if (content.trim().startsWith('-') && 
                   prevContent.trim().startsWith('-')) {
            indentation = extractIndentation(prevContent);
          }
          // If we still don't have indentation, use previous line's
          else if (!indentation) {
            indentation = extractIndentation(prevContent);
          }
        }
      }
      
      // Apply the indentation to the content
      const indentedContent = applyIndentation(content, indentation);
      contentLines.push(indentedContent);
    }
  });
  
  // For empty hunks, don't return empty content
  if (contentLines.length === 0 && originalLines.length > 0) {
    return originalLines;
  }
  
  return contentLines;
}

// Extract the leading whitespace from a string
function extractIndentation(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

// Apply indentation to a string, preserving any existing indentation
function applyIndentation(line: string, indentation: string): string {
  // If the line already has indentation, preserve it
  if (line.startsWith(' ') || line.startsWith('\t')) {
    return line;
  }
  return indentation + line.trim();
}

// Check if content looks like YAML
function isYamlLike(content: string): boolean {
  // Look for common YAML patterns
  return content.includes(':') || 
         content.trim().startsWith('-') || 
         content.trim().startsWith('#');
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
  if (contextLines.length === 0) {
    return startLine;
  }

  // First try strict matching
  let bestPosition = findExactMatchingLine(content, startLine, contextLines);
  
  // If strict matching fails, try fuzzy matching
  if (bestPosition === startLine && contextLines.length > 0) {
    bestPosition = findFuzzyMatchingLine(content, startLine, contextLines);
  }
  
  return bestPosition;
}

function findExactMatchingLine(content: string[], startLine: number, contextLines: string[]): number {
  // Look for the context lines in the original content using exact matching
  for (let i = Math.max(0, startLine - 10); i < content.length - contextLines.length + 1; i++) {
    let matches = true;
    for (let j = 0; j < contextLines.length; j++) {
      const contextLine = contextLines[j].startsWith(' ') 
        ? contextLines[j].substring(1) 
        : contextLines[j];
      
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

function findFuzzyMatchingLine(content: string[], startLine: number, contextLines: string[]): number {
  let bestPos = startLine;
  let bestScore = 0;
  
  // Try to match each potential position with fuzzy matching
  for (let pos = 0; pos < content.length - contextLines.length + 1; pos++) {
    let score = 0;
    let matchCount = 0;
    
    for (let i = 0; i < contextLines.length; i++) {
      const contextLine = contextLines[i].startsWith(' ') 
        ? contextLines[i].substring(1) 
        : contextLines[i];
      const contentLine = content[pos + i];
      
      const similarity = calculateSimilarity(contentLine, contextLine);
      score += similarity;
      
      if (similarity > 0.7) {
        matchCount++;
      }
    }
    
    // Normalize score based on context length
    const avgScore = score / contextLines.length;
    
    // Bonus for consecutive matches
    if (matchCount > 1) {
      score += 0.2 * (matchCount / contextLines.length);
    }
    
    // Proximity bonus for positions close to the expected start line
    const proximity = 1 - Math.min(Math.abs(pos - startLine) / 20, 1);
    score += proximity * 0.2;
    
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  
  // Only use fuzzy match if it's reasonably confident
  return bestScore > 0.6 ? bestPos : startLine;
}

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  
  // Normalize strings
  const s1 = str1.trim();
  const s2 = str2.trim();
  
  if (s1 === s2) return 1.0;
  
  // Check if one is a substring of the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }
  
  // Check for whitespace-insensitive matches
  if (s1.replace(/\s+/g, '') === s2.replace(/\s+/g, '')) {
    return 0.9;
  }
  
  // Count common tokens (words)
  const tokens1 = s1.split(/\s+/);
  const tokens2 = s2.split(/\s+/);
  
  let matchCount = 0;
  for (const t1 of tokens1) {
    if (t1.length < 2) continue; // Skip very short tokens
    for (const t2 of tokens2) {
      if (t1 === t2) {
        matchCount++;
        break;
      }
    }
  }
  
  const tokenSimilarity = tokens1.length && tokens2.length ? 
    (2 * matchCount) / (tokens1.length + tokens2.length) : 0;
  
  return tokenSimilarity;
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

    // Normalize line endings
    const normalizedPatch = file.pendingPatch.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedPatch.split('\n');
    logger.info('Split patch into lines:', { lineCount: lines.length });

    // Extract and sort hunks
    const hunks: { header: string, lines: string[] }[] = [];
    let content = file.content;
    let currentHunkLines: string[] = [];
    let currentHunkHeader: string | null = null;
    let seenFileHeader = false;
    let hasAtLeastOneHunk = false;

    // First pass: collect all hunks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      logger.debug('Processing line:', { lineNumber: i, line });

      // Skip duplicate file headers
      if ((line.startsWith('---') || line.startsWith('+++')) && seenFileHeader) {
        if (i + 1 < lines.length && lines[i + 1].startsWith('+++')) {
          i++; // Skip both header lines
        }
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
        // Save previous hunk if it exists
        if (currentHunkLines.length > 0 && currentHunkHeader) {
          hunks.push({
            header: currentHunkHeader,
            lines: [...currentHunkLines]
          });
          hasAtLeastOneHunk = true;
        }
        currentHunkLines = [];
        currentHunkHeader = line;
      } else if (currentHunkHeader) {
        // Only collect lines if we have a hunk header
        // Skip additional file headers
        if (!line.startsWith('---') && !line.startsWith('+++')) {
          currentHunkLines.push(line);
        }
      } else if (!seenFileHeader && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
        // Direct diff content without headers
        // Create a synthetic hunk for this content
        currentHunkHeader = '@@ -1,1 +1,1 @@';
        currentHunkLines.push(line);
        hasAtLeastOneHunk = true;
      }
    }

    // Add the last hunk if it exists
    if (currentHunkLines.length > 0 && currentHunkHeader) {
      hunks.push({
        header: currentHunkHeader,
        lines: [...currentHunkLines]
      });
      hasAtLeastOneHunk = true;
    }

    // Special case for empty file: if a patch exists but we couldn't find any hunks,
    // try to extract content directly after the +++ line
    if (!hasAtLeastOneHunk && lines.length > 2) {
      const patchContent = lines.slice(2).join('\n').trim();
      if (patchContent && file.content === '') {
        // If file is empty and patch has content, just use the content
        return {
          ...file,
          content: patchContent.replace(/^\+/gm, ''),
          pendingPatch: undefined
        };
      }
    }

    // Sort hunks by their position in the file (based on hunk header)
    hunks.sort((a, b) => {
      const aMatch = a.header.match(/@@ -(\d+),/);
      const bMatch = b.header.match(/@@ -(\d+),/);
      const aPos = aMatch ? parseInt(aMatch[1], 10) : 0;
      const bPos = bMatch ? parseInt(bMatch[1], 10) : 0;
      return aPos - bPos;
    });

    // Second pass: apply each hunk
    for (const { header, lines: hunkLines } of hunks) {
      logger.info('Applying hunk:', { header, lineCount: hunkLines.length });

      try {
        // Get context lines to help find position
        const contextLines = hunkLines
          .filter(l => l.startsWith(' '))
          .slice(0, Math.min(3, hunkLines.filter(l => l.startsWith(' ')).length));

        // Parse and apply the hunk
        const hunk = parseUnifiedDiffHunk(header, hunkLines);
        if (hunk) {
          // Find the actual line number where content matches
          const contentLines = content.split('\n');
          
          // If we have context, use it to find the right position
          if (contextLines.length > 0) {
            hunk.start = findMatchingLine(contentLines, hunk.start, contextLines);
          }
          
          // Apply the hunk
          content = applyHunkToContent(content, hunk);
        }
      } catch (err) {
        logger.warn('Failed to apply hunk, skipping:', { header, error: err });
        // Continue with the next hunk instead of failing completely
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
    // Instead of throwing, return the original file
    // This is more fault-tolerant and prevents errors from blocking the whole operation
    return file;
  }
}
