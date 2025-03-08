"use server"

import { Session } from "@/lib/types/session";
import { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { applyPatch, getFileByIdAndRevision, updateFileAfterPatchOperation } from "../patch";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";

// Not exported as a server action, but as a utility function for internal use
function preprocessPatchSync(patch: string, filePath?: string): string {
  // Don't process empty patches
  if (!patch || !patch.trim()) {
    return patch;
  }

  // Normalize line endings
  const normalizedPatch = patch.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedPatch.split('\n');
  const formattedPatch: string[] = [];
  
  // Track state
  let hasFileHeaders = false;
  let currentHunkHeader = '';
  let currentHunkLines: string[] = [];
  let inHunk = false;
  
  // Determine if this is a YAML file for special handling
  const isYamlFile = filePath && /\.(yaml|yml)$/i.test(filePath);
  const isChartYaml = filePath === 'Chart.yaml' || patch.includes('--- Chart.yaml');
  const isHelmLike = isYamlFile || isChartYaml;
  
  // Collect hunks for sorting
  const hunks: { header: string, lines: string[], position: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimRight(); // Remove trailing whitespace
    
    // Handle file headers
    if (line.startsWith('---')) {
      if (!hasFileHeaders) {
        formattedPatch.push(line);
        hasFileHeaders = true;
      }
      continue;
    }
    
    if (line.startsWith('+++')) {
      if (hasFileHeaders && formattedPatch.length === 1) {
        formattedPatch.push(line);
      }
      continue;
    }

    // Handle hunk headers
    if (line.startsWith('@@')) {
      // If we were in a hunk, save it
      if (inHunk && currentHunkLines.length > 0) {
        hunks.push({
          header: currentHunkHeader,
          lines: [...currentHunkLines],
          position: getHunkPosition(currentHunkHeader)
        });
      }
      
      // Start a new hunk
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (!match) {
        // Create a properly formatted header
        const peekAhead = lines.slice(i + 1).filter(l => l.trim());
        const hunkInfo = calculateHunkInfo(peekAhead);
        currentHunkHeader = `@@ -${hunkInfo.oldStart},${hunkInfo.oldLines} +${hunkInfo.newStart},${hunkInfo.newLines} @@`;
      } else {
        currentHunkHeader = line;
      }
      
      currentHunkLines = [];
      inHunk = true;
      continue;
    }

    // Handle content lines
    if (inHunk) {
      // Ensure each line has a proper prefix
      if (line === '') {
        continue; // Skip empty lines
      } else if (!line.startsWith('+') && !line.startsWith('-') && !line.startsWith(' ')) {
        currentHunkLines.push(' ' + line); // Add context prefix
      } else {
        currentHunkLines.push(line);
      }
    } else if (!hasFileHeaders && line.trim()) {
      // Direct content without headers or hunk markers
      // Create synthetic headers
      formattedPatch.push('--- a/file');
      formattedPatch.push('+++ b/file');
      currentHunkHeader = '@@ -1,1 +1,1 @@';
      inHunk = true;
      
      // Process this line as content
      if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
        currentHunkLines.push(line);
      } else {
        currentHunkLines.push(' ' + line);
      }
    }
  }

  // Add the final hunk if it exists
  if (inHunk && currentHunkLines.length > 0) {
    hunks.push({
      header: currentHunkHeader,
      lines: [...currentHunkLines],
      position: getHunkPosition(currentHunkHeader)
    });
  }

  // Sort hunks by their position
  hunks.sort((a, b) => a.position - b.position);

  // Add file headers if not already added
  if (hunks.length > 0 && !hasFileHeaders) {
    formattedPatch.push('--- a/file');
    formattedPatch.push('+++ b/file');
  }

  // Add all hunks in order
  for (const hunk of hunks) {
    formattedPatch.push(hunk.header);
    
    // For YAML files, ensure proper indentation
    if (isHelmLike) {
      const processedLines = fixYamlIndentation(hunk.lines);
      formattedPatch.push(...processedLines);
    } else {
      formattedPatch.push(...hunk.lines);
    }
  }

  return formattedPatch.join('\n');
}

// Fix indentation specifically for YAML content
function fixYamlIndentation(lines: string[]): string[] {
  const result: string[] = [];
  let lastIndent = '';
  let inList = false;
  let lastItemIndent = '';
  let lastItemLevel = 0;
  
  // First pass: get context lines to understand indentation structure
  const contextLines: {line: string, index: number, indent: string, isListItem: boolean}[] = [];
  const listItemIndents: string[] = [];
  
  lines.forEach((line, idx) => {
    if (line.startsWith(' ')) {
      const content = line.slice(1);
      const indent = extractIndentation(content);
      const isListItem = content.trim().startsWith('-');
      
      if (isListItem) {
        listItemIndents.push(indent);
      }
      
      contextLines.push({
        line: content, 
        index: idx, 
        indent,
        isListItem
      });
    }
  });
  
  // Identify the base indentation for list items
  let baseListIndent = '';
  if (listItemIndents.length > 0) {
    baseListIndent = listItemIndents[0];
  }
  
  // Second pass: process all lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith(' ')) {
      // Context line - preserve as is
      result.push(line);
      
      // Update indentation state
      const content = line.slice(1);
      lastIndent = extractIndentation(content);
      
      // Track list item state
      if (content.trim().startsWith('-')) {
        inList = true;
        lastItemIndent = lastIndent;
        lastItemLevel = countIndentLevel(lastIndent);
      } else if (content.trim() && !content.trim().startsWith('-')) {
        // Check if this is a property under a list item
        if (inList && lastItemLevel > 0 && countIndentLevel(lastIndent) > lastItemLevel) {
          // This is a property under a list item
        } else {
          // Non-empty line, not a list item or property, reset list state
          inList = false;
        }
      }
      
    } else if (line.startsWith('+')) {
      // Added line - fix indentation if needed
      const content = line.slice(1).trim();
      let fixedLine = '+';
      
      // Special case for YAML list items with dependencies
      if (content === 'name:' && inList) {
        // This is likely a property under a list item
        fixedLine += lastItemIndent + '  ' + content;
      }
      // Repository, version, and alias are often properties under list items
      else if ((content === 'repository:' || content === 'version:' || content === 'alias:' || 
                content.startsWith('repository:') || content.startsWith('version:') || 
                content.startsWith('alias:')) && inList) {
        fixedLine += lastItemIndent + '  ' + content;
      }
      // Indent list items to match previous list item indentation
      else if (content.startsWith('-') && baseListIndent) {
        // This is a new list item
        fixedLine += baseListIndent + content;
        // If after adding this, we should update in case properties follow
        lastItemIndent = baseListIndent;
        inList = true;
      }
      // Indent properties under list items with 2 more spaces
      else if (inList && content.includes(':') && !content.startsWith('-')) {
        fixedLine += lastItemIndent + '  ' + content;
      }
      // Use existing indentation otherwise
      else if (lastIndent && content) {
        fixedLine += lastIndent + content;
      }
      // If we have no context, just use the original
      else {
        fixedLine += content;
      }
      
      result.push(fixedLine);
      
      // Update the state if this was a list item we added
      if (content.trim().startsWith('-')) {
        inList = true;
        // If we didn't have a base indent yet, use whatever we determined
        if (!baseListIndent && lastIndent) {
          baseListIndent = lastIndent;
        }
      }
      
    } else if (line.startsWith('-')) {
      // Removed line - keep as is
      result.push(line);
    } else {
      // Other lines - keep as is
      result.push(line);
    }
  }
  
  return result;
}

// Count indentation level by number of spaces (assuming 2 spaces per level)
function countIndentLevel(indent: string): number {
  return Math.floor(indent.length / 2);
}

// Extract the leading whitespace from a string
function extractIndentation(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

function getHunkPosition(header: string): number {
  const match = header.match(/@@ -(\d+),/);
  return match ? parseInt(match[1], 10) : 0;
}

// This is the async version exposed for server actions
export async function preprocessPatch(patch: string, filePath?: string): Promise<string> {
  return preprocessPatchSync(patch, filePath);
}

function calculateHunkInfo(lines: string[]) {
  // Default to position 1
  const oldStart = 1;
  const newStart = 1;
  
  // Calculate line counts
  let oldLines = 0;
  let newLines = 0;
  let hasContent = false;

  lines.forEach(line => {
    if (!line.trim()) return;
    
    hasContent = true;
    if (line.startsWith('+')) {
      newLines++;
    } else if (line.startsWith('-')) {
      oldLines++;
    } else {
      // Context lines or lines without prefix
      oldLines++;
      newLines++;
    }
  });

  // Ensure we have at least one line if there's content
  if (hasContent && oldLines === 0) oldLines = 1;
  if (hasContent && newLines === 0) newLines = 1;

  return {
    oldStart,
    oldLines,
    newStart,
    newLines
  };
}

export async function acceptPatchAction(session: Session, fileId: string, revision: number): Promise<WorkspaceFile> {
  try {
    const { user } = session;
    if (!user) {
      throw new Error("User not found");
    }

    logger.info(`Accepting patch for file ${fileId} at revision ${revision}`);
    
    let file;
    try {
      // Try to get the file from the database first
      file = await getFileByIdAndRevision(fileId, revision);
    } catch (err) {
      logger.warn(`File not found in database with id=${fileId}. This may be a temporary frontend ID.`);
      
      // If this is a frontend-generated ID (e.g., file-1234567890), 
      // we need to handle this gracefully for the user experience
      if (fileId.startsWith('file-')) {
        // Create a placeholder file object that just wraps the pending patches
        // from the client-side state
        return {
          id: fileId,
          filePath: "unknown", // This will be populated by the client
          content: "",
          pendingPatch: undefined // Clear the pending patch so UI resets
        };
      } else {
        // For other types of IDs, rethrow the error
        throw err;
      }
    }

    // Skip if no pending patch
    if (!file.pendingPatch) {
      logger.info(`No pending patch found for file ${fileId}`);
      return file;
    }

    // Preprocess the patch to ensure it's well-formed, passing the file path for YAML handling
    try {
      file.pendingPatch = preprocessPatchSync(file.pendingPatch, file.filePath);
    } catch (err) {
      logger.warn(`Error preprocessing patch: ${err}`, { fileId });
      // Continue with the original patch
    }

    // Apply the patch
    const updatedFile = await applyPatch(file);

    // If the patch application failed, the original file is returned
    // Check if content changed
    if (updatedFile.content === file.content && file.pendingPatch) {
      logger.warn(`Patch application didn't change content for file ${fileId}`);
    }

    // Clear all patch-related metadata regardless
    const clearedFile = {
      ...updatedFile,
      pendingPatch: undefined,
      diffStats: undefined,
      addedLines: 0,
      removedLines: 0
    };

    try {
      await updateFileAfterPatchOperation(fileId, revision, clearedFile.content, undefined);
    } catch (err) {
      logger.warn(`Could not update file in database with id=${fileId}. This may be a temporary frontend ID.`);
      // We can still return the cleared file for UI purposes even if DB update fails
    }

    return clearedFile;
  } catch (error) {
    logger.error(`Error accepting patch: ${error}`, { fileId, revision });
    // For temporary frontend IDs, return a basic cleared object that will at least
    // update the UI state
    if (fileId.startsWith('file-')) {
      return {
        id: fileId,
        filePath: "unknown", // This will be populated by the client
        content: "",
        pendingPatch: undefined // Clear the pending patch so UI resets
      };
    }
    
    // In case of error for real database IDs, try to return the original file
    try {
      const originalFile = await getFileByIdAndRevision(fileId, revision);
      return {
        ...originalFile,
        pendingPatch: undefined // Clear the patch even if we failed
      };
    } catch {
      // If we can't get the original file, re-throw
      throw error;
    }
  }
}

export async function acceptAllPatchesAction(session: Session, workspaceId: string, revision: number): Promise<WorkspaceFile[]> {
  try {
    const { user } = session;
    if (!user) {
      throw new Error("User not found");
    }

    logger.info(`Accepting all patches for workspace ${workspaceId} at revision ${revision}`);

    const db = getDB(await getParam("DB_URI"));

    // Find all files with pending patches
    const result = await db.query(
      `SELECT id, revision_number FROM workspace_file
       WHERE workspace_id = $1 AND revision_number = $2 AND pending_patch IS NOT NULL`,
      [workspaceId, revision]
    );

    if (result.rows.length === 0) {
      logger.info(`No pending patches found for workspace ${workspaceId}`);
      return [];
    }

    // Accept each patch
    const updatedFiles: WorkspaceFile[] = [];
    const failures: {id: string, error: string}[] = [];
    
    // Process each file's patch
    for (const row of result.rows) {
      try {
        const updatedFile = await acceptPatchAction(session, row.id, row.revision_number);
        updatedFiles.push(updatedFile);
      } catch (err) {
        // Log failure but continue with other files
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to apply patch for file ${row.id}:`, { error: message });
        failures.push({ id: row.id, error: message });
      }
    }

    // Log summary
    logger.info(`Accepted patches: ${updatedFiles.length} of ${result.rows.length} files`);
    if (failures.length > 0) {
      logger.warn(`Failed to apply patches for ${failures.length} files`, { failures });
    }

    return updatedFiles;
  } catch (error) {
    logger.error(`Error in acceptAllPatchesAction:`, { error, workspaceId, revision });
    throw error;
  }
}
