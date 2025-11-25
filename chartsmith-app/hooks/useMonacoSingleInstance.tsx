"use client";

import React, { useRef, useEffect } from "react";
import type { editor } from "monaco-editor";
import type { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

// Global registry for Monaco models
declare global {
  interface Window {
    __monaco?: any;
    __monacoEditor?: editor.IStandaloneCodeEditor;
    __monacoModels?: {
      [key: string]: editor.ITextModel;
    };
  }
}

// Ultra simple and reliable diff parser that extracts only the final content
export function parseDiff(originalContent: string, diffContent: string): string {
  // For empty diffs, return original content
  if (!diffContent || diffContent.trim() === '') {
    return originalContent;
  }

  // First, try the direct content-focused approach (ignores line numbers)
  // This approach is more reliable for incorrectly positioned patches
  try {
    const lines = originalContent.split('\n');

    // Look for lines to remove (starting with - but not ---)
    const linesToRemove: string[] = [];
    const diffLines = diffContent.split('\n');

    for (const line of diffLines) {
      if (line.startsWith('-') && !line.startsWith('---')) {
        // This is a line we need to remove
        linesToRemove.push(line.substring(1).trim());
      }
    }

    // Remove the lines
    for (const lineContent of linesToRemove) {
      const index = lines.findIndex(line => line.trim() === lineContent);
      if (index >= 0) {
        lines.splice(index, 1);
      }
    }

    // Look for lines to add (starting with + but not +++)
    // We'll track consecutive additions to preserve their order
    interface AdditionBlock {
      lines: string[];
      afterContextLine?: string;
    }

    const additionBlocks: AdditionBlock[] = [];
    let currentBlock: AdditionBlock | null = null;
    let lastContextLine: string | undefined;

    for (const line of diffLines) {
      if (line.startsWith(' ') && !line.startsWith('---') && !line.startsWith('+++')) {
        // This is a context line
        // If we were in the middle of an addition block, finish it
        if (currentBlock !== null) {
          additionBlocks.push(currentBlock);
          currentBlock = null;
        }

        lastContextLine = line.substring(1).trim();
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        // This is a line we need to add
        // If we're not already in an addition block, start a new one
        if (currentBlock === null) {
          currentBlock = {
            lines: [],
            afterContextLine: lastContextLine
          };
        }

        // Add to the current block
        currentBlock.lines.push(line.substring(1));
      } else if (line.startsWith('@')) {
        // New hunk - finish any current block
        if (currentBlock !== null) {
          additionBlocks.push(currentBlock);
          currentBlock = null;
        }
      }
    }

    // Add any final block
    if (currentBlock !== null) {
      additionBlocks.push(currentBlock);
    }

    // Apply each block of additions
    for (const block of additionBlocks) {
      if (block.afterContextLine) {
        const contextIndex = lines.findIndex(l => l.trim() === block.afterContextLine);
        if (contextIndex >= 0) {
          // Insert the block after the context line
          // We reverse the array before using spliceM so that the lines
          // are added in the correct order (maintaining order from the diff)
          for (let i = 0; i < block.lines.length; i++) {
            lines.splice(contextIndex + 1 + i, 0, block.lines[i]);
          }
        } else {
          // If context line not found, add at the end in order
          lines.push(...block.lines);
        }
      } else {
        // If no context, add at the end in order
        lines.push(...block.lines);
      }
    }

    return lines.join('\n');
  } catch {
    // If the simple approach fails, try the more complex structured diff parsing
    logger.debug("Simple content-based diff failed, falling back to structured parsing");
  }

  // Fallback to the structured diff approach
  // This is still useful for complex diffs with multiple hunks
  try {
    // Extract sections from the unified diff format
    const unifiedDiffMatch = diffContent.match(/\n--- [\s\S]*?\n\+\+\+ [\s\S]*?\n((?:@@ [\s\S]*? @@[\s\S]*?\n)+)((?: [\s\S]*\n|\+[\s\S]*\n|-[\s\S]*\n)*)/);

    if (unifiedDiffMatch) {
      // Get all the hunks in the diff
      const headerInfo = unifiedDiffMatch[1]; // Contains all @@ lines
      const fullHunkContent = unifiedDiffMatch[2];

      // Build the modified content from the original by applying the diff
      const originalLines = originalContent.split('\n');
      const modifiedLines = [...originalLines]; // Start with a copy of the original

      // Parse each hunk individually to maintain proper line order
      const hunkHeaderMatches = Array.from(headerInfo.matchAll(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/g));

      // We'll process each hunk separately to preserve order of context and changed lines
      for (let i = 0; i < hunkHeaderMatches.length; i++) {
        const hunkHeader = hunkHeaderMatches[i][0];
        const origStartStr = hunkHeaderMatches[i][1];
        const origCountStr = hunkHeaderMatches[i][2];
        const newStartStr = hunkHeaderMatches[i][3];
        const newCountStr = hunkHeaderMatches[i][4];

        // Line numbers in diff are 1-based, arrays are 0-based
        const origStart = parseInt(origStartStr, 10) - 1;
        const origCount = parseInt(origCountStr, 10);
        const newStart = parseInt(newStartStr, 10) - 1;

        // Extract hunk lines
        const hunkRegex = new RegExp(`${hunkHeader}\\n([\\s\\S]*?)(?:\\n@@ |$)`, 'g');
        const hunkMatch = hunkRegex.exec(fullHunkContent);

        if (!hunkMatch || !hunkMatch[1]) continue;

        const hunkLines = hunkMatch[1].split('\n').filter(line => line.length > 0);

        // Process hunk lines in order
        // First, build a representation of what the hunk contains
        const hunkLinesByType: {
          context: Array<{content: string, index: number}>, // ' ' lines
          removed: Array<{content: string, index: number}>, // '-' lines
          added: Array<{content: string, index: number}>    // '+' lines
        } = {
          context: [],
          removed: [],
          added: []
        };

        // Track the exact order of lines in the hunk
        const lineOrder = [];

        for (let j = 0; j < hunkLines.length; j++) {
          const line = hunkLines[j];
          if (line.startsWith('-')) {
            hunkLinesByType.removed.push({
              content: line.substring(1),
              index: lineOrder.length
            });
            lineOrder.push('removed');
          } else if (line.startsWith('+')) {
            hunkLinesByType.added.push({
              content: line.substring(1),
              index: lineOrder.length
            });
            lineOrder.push('added');
          } else if (line.startsWith(' ')) {
            hunkLinesByType.context.push({
              content: line.substring(1),
              index: lineOrder.length
            });
            lineOrder.push('context');
          }
        }

        // Apply changes with special care for context lines
        // For context-only hunks, do nothing (they're already in the file)
        if (hunkLinesByType.added.length === 0 && hunkLinesByType.removed.length === 0) {
          continue;
        }

        // For deletion-only hunks
        if (hunkLinesByType.added.length === 0 && hunkLinesByType.removed.length > 0) {
          let position = newStart;
          let linesToRemove = hunkLinesByType.removed.length;

          // First, verify the line to be removed matches what we expect
          const lineToRemove = hunkLinesByType.removed[0].content;

          // Look for the exact line to be removed - search entire file if needed
          // This is more aggressive but needed when line numbers are completely wrong
          let foundRemovalLine = false;

          // First try near the expected position
          let searchRadius = 10; // Increased search radius
          for (let k = Math.max(0, position - searchRadius); k < Math.min(modifiedLines.length, position + searchRadius); k++) {
            if (modifiedLines[k] === lineToRemove) {
              position = k;
              foundRemovalLine = true;
              break;
            }
          }

          // If not found nearby, search the entire file
          if (!foundRemovalLine) {
            for (let k = 0; k < modifiedLines.length; k++) {
              if (modifiedLines[k] === lineToRemove) {
                position = k;
                foundRemovalLine = true;
                logger.debug(`Found line to remove at position ${k} (far from expected position ${newStart})`);
                break;
              }
            }
          }

          // If we didn't find the exact line to remove, check if context helps
          if (!foundRemovalLine) {
            // Check if we have context lines before removals
            const hasContextBeforeRemovals = lineOrder.indexOf('context') < lineOrder.indexOf('removed');

            if (hasContextBeforeRemovals) {
              // Find the context line in the content
              const firstContextLine = hunkLinesByType.context[0].content;

              // Look for context lines nearby
              let found = false;
              for (let k = Math.max(0, position - searchRadius); k < Math.min(modifiedLines.length, position + searchRadius); k++) {
                if (modifiedLines[k] === firstContextLine) {
                  position = k + 1; // Start removing after the context line
                  found = true;
                  break;
                }
              }

              if (!found) {
                logger.debug("Could not find context line or line to remove - patch may be misapplied");
                // We'll still attempt to use the position from the patch
              }
            }
          }

          // Extra safety check - make sure we're removing the correct line
          if (position < modifiedLines.length && modifiedLines[position] === lineToRemove) {
            // Perfect match, remove just one line
            modifiedLines.splice(position, 1);
          } else {
            // No match found or multiple lines to remove - try to keep going
            // In this case we'll use the patch location even though we couldn't verify it
            logger.debug("Line to remove doesn't match expected content - patch may be misapplied");
            modifiedLines.splice(position, linesToRemove);
          }
        }
        // For addition-only hunks
        else if (hunkLinesByType.added.length > 0 && hunkLinesByType.removed.length === 0) {
          const addedLines = hunkLinesByType.added.map(line => line.content);
          let position = newStart;
          let searchRadius = 5; // Search 5 lines before and after

          // Check if we have context lines before/after additions
          const contextIndices = lineOrder
            .map((type, index) => type === 'context' ? index : -1)
            .filter(index => index !== -1);

          const addedIndices = lineOrder
            .map((type, index) => type === 'added' ? index : -1)
            .filter(index => index !== -1);

          // If we have context, use it to position our addition
          if (contextIndices.length > 0) {
            const contextBeforeAddition = contextIndices.some(contextIdx =>
              addedIndices.some(addedIdx => contextIdx < addedIdx));

            const contextAfterAddition = contextIndices.some(contextIdx =>
              addedIndices.some(addedIdx => contextIdx > addedIdx));

            // If context appears before and after, we need to find both
            if (contextBeforeAddition && contextAfterAddition) {
              const firstContextIndex = Math.min(...contextIndices);
              const firstContextLine = hunkLinesByType.context[contextIndices.indexOf(firstContextIndex)].content;

              // Look for exact match of context line
              let found = false;

              // First search nearby
              for (let k = Math.max(0, position - searchRadius); k < Math.min(modifiedLines.length, position + searchRadius); k++) {
                if (modifiedLines[k] === firstContextLine) {
                  position = k + 1; // Insert after the first context line
                  found = true;
                  break;
                }
              }

              // If not found nearby, search entire file
              if (!found) {
                for (let k = 0; k < modifiedLines.length; k++) {
                  if (modifiedLines[k] === firstContextLine) {
                    position = k + 1; // Insert after the first context line
                    found = true;
                    logger.debug(`Found context line at position ${k} (far from expected position ${newStart})`);
                    break;
                  }
                }
              }

              if (!found) {
                logger.debug("Could not find context line - patch may be misapplied");
              }
            }
            // If context appears before additions, add after the context
            else if (contextBeforeAddition) {
              const firstContextIndex = Math.min(...contextIndices);
              const firstContextLine = hunkLinesByType.context[firstContextIndex].content;

              // Look for exact match of context line
              let found = false;
              for (let k = Math.max(0, position - searchRadius); k < Math.min(modifiedLines.length, position + searchRadius); k++) {
                if (modifiedLines[k] === firstContextLine) {
                  position = k + 1; // Insert after the context line
                  found = true;
                  break;
                }
              }

              if (!found) {
                logger.debug("Could not find context line - patch may be misapplied");
              }
            }
            // If context appears after additions, add before the context
            else if (contextAfterAddition) {
              const firstContextIndex = Math.min(...contextIndices);
              const firstContextLine = hunkLinesByType.context[firstContextIndex].content;

              // Look for exact match of context line
              let found = false;
              for (let k = Math.max(0, position - searchRadius); k < Math.min(modifiedLines.length, position + searchRadius); k++) {
                if (modifiedLines[k] === firstContextLine) {
                  position = k; // Insert before the context line
                  found = true;
                  break;
                }
              }

              if (!found) {
                logger.debug("Could not find context line - patch may be misapplied");
              }
            }
          }

          // Add lines at the determined position
          modifiedLines.splice(position, 0, ...addedLines);
        }
        // For replacement hunks (both additions and removals)
        else {
          // This is a replacement - we need to locate the exact lines to replace
          let position = newStart;
          let searchRadius = 5; // Search 5 lines before and after

          // Try to locate the line to be removed first - that's the most reliable
          const linesToRemove = hunkLinesByType.removed.length;
          const firstLineToRemove = hunkLinesByType.removed[0].content;

          let foundExactLine = false;

          // Search for the exact line to remove
          for (let k = Math.max(0, position - searchRadius); k < Math.min(modifiedLines.length, position + searchRadius); k++) {
            if (modifiedLines[k] === firstLineToRemove) {
              position = k;
              foundExactLine = true;
              break;
            }
          }

          // If we couldn't find the line to remove, try using context
          if (!foundExactLine) {
            // See if we have context lines before the removal
            const contextIndices = lineOrder
              .map((type, index) => type === 'context' ? index : -1)
              .filter(index => index !== -1);

            const removedIndices = lineOrder
              .map((type, index) => type === 'removed' ? index : -1)
              .filter(index => index !== -1);

            // If we have context before removals, use it to position
            const contextBeforeRemoval = contextIndices.some(contextIdx =>
              removedIndices.some(removedIdx => contextIdx < removedIdx));

            if (contextBeforeRemoval) {
              const firstContextIndex = Math.min(...contextIndices);
              const firstContextLine = hunkLinesByType.context[firstContextIndex].content;

              // Look for exact match of context line
              let found = false;
              for (let k = Math.max(0, position - searchRadius); k < Math.min(modifiedLines.length, position + searchRadius); k++) {
                if (modifiedLines[k] === firstContextLine) {
                  position = k + 1; // Replace after the context line
                  found = true;
                  break;
                }
              }

              if (!found) {
                logger.debug("Could not find context line or line to replace - patch may be misapplied");
              }
            }
          }

          // Safety check - verify we're replacing the right content
          let safeToReplace = false;

          if (position < modifiedLines.length) {
            // For single line replacements, check exact match
            if (linesToRemove === 1 && modifiedLines[position] === firstLineToRemove) {
              safeToReplace = true;
            }
            // For multi-line replacements, try to match at least the first line
            else if (linesToRemove > 1) {
              if (modifiedLines[position] === firstLineToRemove) {
                safeToReplace = true;
              } else {
                // If we can't match the first line exactly, continue anyway
                logger.debug("First line to replace doesn't match - patch may be misapplied");
              }
            }
          }

          // Get the added lines
          const addedLines = hunkLinesByType.added.map(line => line.content);

          // Apply the replacement
          if (safeToReplace) {
            // Replace the exact number of lines
            modifiedLines.splice(position, linesToRemove, ...addedLines);
          } else {
            // No exact match found - just try our best by using the line number from the patch
            logger.debug("Could not safely match lines to replace - using patch line number");
            modifiedLines.splice(position, linesToRemove, ...addedLines);
          }
        }
      }

      return modifiedLines.join('\n');
    }
  } catch {
    logger.debug("Error applying structured diff, falling back to simpler approach");
  }

  // For new files (empty original content), extract only the added lines
  if (originalContent === '' || diffContent.includes('@@ -0,0 +1,')) {
    const newContent = diffContent
      .split('\n')
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .map(line => line.substring(1))
      .join('\n');

    if (newContent) {
      return newContent;
    }
  }

  // Handle patches that only contain removals (no additions)
  if (diffContent.includes('@@ ') &&
      diffContent.split('\n').some(line => line.startsWith('-') && !line.startsWith('---')) &&
      !diffContent.split('\n').some(line => line.startsWith('+') && !line.startsWith('+++'))) {
    // This is a removal-only patch
    try {
      // Get line numbers from hunk headers
      const hunkMatches = diffContent.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/g) || [];
      const contentLines = originalContent.split('\n');

      // For each hunk, remove the specified lines
      for (const hunk of hunkMatches) {
        const match = hunk.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
        if (match) {
          const origStart = parseInt(match[1], 10) - 1; // Convert to 0-based
          const origCount = parseInt(match[2], 10);
          const newStart = parseInt(match[3], 10) - 1;  // Convert to 0-based

          // Find the lines to remove by looking at lines starting with -
          const hunkLines = diffContent.split('\n');
          const hunkStartIndex = hunkLines.findIndex(line => line === hunk);
          if (hunkStartIndex !== -1) {
            let removalCount = 0;
            for (let i = hunkStartIndex + 1; i < hunkLines.length; i++) {
              if (hunkLines[i].startsWith('@@ ')) break; // Next hunk

              if (hunkLines[i].startsWith('-')) {
                removalCount++;
              }
            }

            // Remove the lines from the content
            if (removalCount > 0) {
              contentLines.splice(newStart, removalCount);
            }
          }
        }
      }

      return contentLines.join('\n');
    } catch {
      logger.debug("Error applying removal diff");
    }
  }

  // Handle patches that only contain additions (no removals)
  if (diffContent.includes('@@ ') &&
      !diffContent.split('\n').some(line => line.startsWith('-') && !line.startsWith('---')) &&
      diffContent.split('\n').some(line => line.startsWith('+') && !line.startsWith('+++'))) {
    // This is an addition-only patch
    try {
      // Get line numbers from hunk headers
      const hunkMatches = diffContent.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/g) || [];
      const contentLines = originalContent.split('\n');

      // For each hunk, add the specified lines
      for (const hunk of hunkMatches) {
        const match = hunk.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
        if (match) {
          const origStart = parseInt(match[1], 10) - 1; // Convert to 0-based
          const newStart = parseInt(match[3], 10) - 1;  // Convert to 0-based

          // Find the lines to add by looking at lines starting with +
          const hunkLines = diffContent.split('\n');
          const hunkStartIndex = hunkLines.findIndex(line => line.includes(hunk));
          if (hunkStartIndex !== -1) {
            // First, collect all lines in the hunk
            const hunkLinesByType: {
              context: Array<{content: string, index: number}>, // ' ' lines
              added: Array<{content: string, index: number}>    // '+' lines
            } = {
              context: [],
              added: []
            };

            // Track the order of lines in the hunk
            const lineOrder = [];

            for (let i = hunkStartIndex + 1; i < hunkLines.length; i++) {
              if (hunkLines[i].startsWith('@@ ')) break; // Next hunk

              if (hunkLines[i].startsWith(' ')) {
                // Context line
                hunkLinesByType.context.push({
                  content: hunkLines[i].substring(1),
                  index: lineOrder.length
                });
                lineOrder.push('context');
              } else if (hunkLines[i].startsWith('+')) {
                // Added line
                hunkLinesByType.added.push({
                  content: hunkLines[i].substring(1),
                  index: lineOrder.length
                });
                lineOrder.push('added');
              }
            }

            // Now apply the changes in the correct order
            if (hunkLinesByType.added.length > 0) {
              const addedLines = hunkLinesByType.added.map(line => line.content);

              // Case 1: if we have context lines, make sure we're inserting at the right spot
              if (hunkLinesByType.context.length > 0) {
                // Check if the first line is context (common case)
                if (lineOrder[0] === 'context') {
                  // We need to insert after the context line
                  // First verify the context line exists in our content
                  const contextLine = hunkLinesByType.context[0].content;

                  // Check if this line exists at the position we expect
                  if (contentLines[newStart] === contextLine) {
                    // Context line exists at position - insert the added lines after it
                    contentLines.splice(newStart + 1, 0, ...addedLines);
                  } else {
                    // Context line doesn't match - search for it nearby
                    let found = false;
                    for (let i = Math.max(0, newStart - 3); i < Math.min(contentLines.length, newStart + 3); i++) {
                      if (contentLines[i] === contextLine) {
                        contentLines.splice(i + 1, 0, ...addedLines);
                        found = true;
                        break;
                      }
                    }

                    if (!found) {
                      // Fallback - insert at the calculated position
                      contentLines.splice(newStart, 0, ...addedLines);
                    }
                  }
                } else {
                  // First line is not context - use the line number
                  contentLines.splice(newStart, 0, ...addedLines);
                }
              } else {
                // No context lines - just use the line number
                contentLines.splice(newStart, 0, ...addedLines);
              }
            }
          }
        }
      }

      return contentLines.join('\n');
    } catch {
      logger.debug("Error applying addition diff");
    }
  }

  // Existing special case handling
  // Direct text replacement for common fixes - handle specific line replacements in YAML/JSON
  const replacementMatches = Array.from(diffContent.matchAll(/-([^:\n]+):\s*([^\n]+)\n\+([^:\n]+):\s*([^\n]+)/g));
  if (replacementMatches.length === 1) {
    const match = replacementMatches[0];
    const oldKey = match[1].trim();
    const oldValue = match[2].trim();
    const newKey = match[3].trim();
    const newValue = match[4].trim();

    // If it's a direct value replacement (same key)
    if (oldKey === newKey) {
      const searchPattern = `${oldKey}: ${oldValue}`;
      const replacement = `${newKey}: ${newValue}`;
      if (originalContent.includes(searchPattern)) {
        return originalContent.replace(searchPattern, replacement);
      }
    }
  }

  // Backup approach: universal diff processing
  try {
    // Extract all hunks
    const completeDiffMatch = diffContent.match(/\n--- [\s\S]*?\n\+\+\+ [\s\S]*?\n((?:@@ [\s\S]*? @@[\s\S]*?\n)+)((?: [\s\S]*\n|\+[\s\S]*\n|-[\s\S]*\n)*)/);
    if (completeDiffMatch) {
      const hunkContent = completeDiffMatch[2].split('\n');

      // Just extract all kept and added lines (starting with ' ' or '+')
      // and skip all removed lines (starting with '-')
      const keptContent = hunkContent
        .filter(line => line.startsWith(' ') || line.startsWith('+'))
        .map(line => line.substring(1))
        .join('\n');

      if (keptContent) {
        return keptContent;
      }
    }

    // Simple string replacement if recognizable patterns exist
    const singleLineDiffMatch = diffContent.match(/-([^\n]+)\n\+([^\n]+)/);
    if (singleLineDiffMatch) {
      const oldLine = singleLineDiffMatch[1];
      const newLine = singleLineDiffMatch[2];

      // Try direct string replacement
      const lines = originalContent.split('\n');
      const index = lines.findIndex(line => line.trim() === oldLine.trim());
      if (index !== -1) {
        lines[index] = newLine;
        return lines.join('\n');
      }
    }

    // Last resort: just attempt direct string replacement
    const minusParts = diffContent.match(/^-(.*)$/gm);
    const plusParts = diffContent.match(/^\+(.*)$/gm);

    if (minusParts && plusParts && minusParts.length === plusParts.length) {
      let content = originalContent;

      for (let i = 0; i < minusParts.length; i++) {
        const minusLine = minusParts[i].substring(1);
        const plusLine = plusParts[i].substring(1);

        content = content.replace(minusLine, plusLine);
      }

      return content;
    }

    // Ultimate fallback
    return originalContent;
  } catch {
    logger.debug("Error parsing diff");
    return originalContent;
  }
}

// Helper function for better error handling in Monaco
export function setupSafeMonacoCleanup(): void {
  // This runs once when the module is loaded
  if (typeof window !== 'undefined') {
    // Add event listener for beforeunload to clean up Monaco resources properly
    window.addEventListener('beforeunload', () => {
      try {
        // Try to clean up Monaco models on page unload
        if ((window as any).monaco?.editor) {
          const models = (window as any).monaco.editor.getModels();
          models.forEach((model: any) => {
            if (!model.isDisposed()) {
              try {
                model.dispose();
              } catch (e) {
                // Ignore errors
              }
            }
          });
        }
      } catch (e) {
        // Ignore any errors during cleanup on page unload
      }
    });
  }
}

// Get language from file extension
export function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'txt':
      return 'plaintext';
    default:
      return 'plaintext';
  }
}

// Custom hook for Monaco Editor with single instance approach
export function useMonacoSingleInstance(
  selectedFile: WorkspaceFile | null,
  editorRef: React.RefObject<editor.IStandaloneCodeEditor | null>,
  monacoRef: React.RefObject<typeof import("monaco-editor") | null>,
) {
  // Track if we're in diff mode
  const [inDiffMode, setInDiffMode] = React.useState(false);

  // Track previous values to prevent loading flicker
  const prevContentRef = useRef<string | undefined>(undefined);

  // Calculate derived state
  const original = selectedFile?.content || '';
  const language = getLanguage(selectedFile?.filePath || '');
  
  // Using contentPending instead of pendingPatches for tracking changes
  const modifiedContent = React.useMemo(() => {
    // If we have pending content, return that, otherwise return the original content
    return selectedFile?.contentPending || selectedFile?.content || "";
  }, [selectedFile?.content, selectedFile?.contentPending]);

  // Simplified effect that handles model creation only
  // We now rely on React's key mechanism to unmount/remount editors
  useEffect(() => {
    if (!monacoRef.current || !selectedFile) return;

    const monaco = monacoRef.current;

    // Get file info
    const fileKey = selectedFile.id || selectedFile.filePath || 'unknown';
    const isDiffMode = !!selectedFile.contentPending && selectedFile.contentPending.length > 0;

    // Set the diff mode state - this should happen before any model changes
    setInDiffMode(isDiffMode);

    // Check if editor is available - might not be available during transitions
    if (!editorRef.current) {
      logger.debug("Editor reference not available, skipping model update");
      return;
    }

    // For non-diff mode, setting up the editor model is simpler
    if (!isDiffMode && editorRef.current) {
      try {
        // For regular editor, we still maintain the model for consistent history
        const editor = editorRef.current;

        // We need to be careful with model management to avoid 'disposed before reset' errors
        // Check if we already have a model for this file
        let model = window.__monacoModels?.[fileKey];

        // If no model exists or it's been disposed, create a new one
        if (!model || model.isDisposed()) {
          try {
            const uri = monaco.Uri.parse(`file:///${fileKey}`);
            model = monaco.editor.createModel(
              selectedFile.content || '',
              language,
              uri
            );
            if (window.__monacoModels) {
              window.__monacoModels[fileKey] = model;
            }
          } catch {
            logger.debug("Error creating model");
          }
        } else {
          // Update existing model if content changed
          try {
            if (model.getValue() !== selectedFile.content) {
              model.setValue(selectedFile.content || '');
            }
          } catch {
            logger.debug("Error updating model value");
          }
        }

        // Only set the model if we have a valid one and the editor is still available
        if (model && !model.isDisposed() && editor) {
          try {
            editor.setModel(model);
          } catch {
            logger.debug("Error setting model on editor");
          }
        }
      } catch {
        logger.debug("Error in Monaco model management");
        // Just log errors, don't try to manipulate references
      }
    }
    // For diff mode, the DiffEditor component will handle model creation
  }, [
    selectedFile?.id,
    selectedFile?.content,
    selectedFile?.contentPending,
    language,
    editorRef,
    monacoRef
  ]);

  // Keep previous content in sync with current selection
  useEffect(() => {
    if (selectedFile?.content) {
      prevContentRef.current = selectedFile.content;
    }
  }, [selectedFile?.content]);

  // Force immediate diff mode update when pendingContent changes
  // This ensures we render the correct editor type instantly
  useEffect(() => {
    if (selectedFile) {
      setInDiffMode(!!selectedFile.contentPending && selectedFile.contentPending.length > 0);
    }
  }, [selectedFile?.contentPending, setInDiffMode]);

  // Initialize Monaco environment and create a safer cleanup process
  useEffect(() => {
    // Call setup function
    setupSafeMonacoCleanup();

    // Set up global model registry if not exists
    if (typeof window !== 'undefined' && !window.__monacoModels) {
      window.__monacoModels = {};
    }

    // Define a safer model cleanup function
    const cleanupModels = () => {
      // We'll only cleanup models that no longer have an editor using them
      if (typeof window !== 'undefined' && window.__monacoModels) {
        Object.keys(window.__monacoModels).forEach(key => {
          const model = window.__monacoModels?.[key];
          if (model && !model.isDisposed()) {
            try {
              // Track all available editors
              const allEditors = monacoRef.current?.editor.getEditors() || [];
              const diffEditors = monacoRef.current?.editor.getDiffEditors() || [];

              // Check if any editor is using this model
              const isModelInUse = allEditors.some(editor =>
                editor.getModel() === model
              ) || diffEditors.some(diffEditor => {
                const original = diffEditor.getOriginalEditor().getModel();
                const modified = diffEditor.getModifiedEditor().getModel();
                return original === model || modified === model;
              });

              // Only dispose if not in use
              if (!isModelInUse) {
                model.dispose();
                if (window.__monacoModels) {
                  delete window.__monacoModels[key];
                }
              }
            } catch {
              logger.debug("Error checking model usage");
            }
          }
        });
      }
    };

    // Set up an interval to clean unused models periodically
    const cleanupInterval = setInterval(cleanupModels, 30000); // Every 30 seconds

    // Cleanup function to run when component unmounts
    return () => {
      // Clear the cleanup interval
      clearInterval(cleanupInterval);

      // Don't manually set editorRef to null here - let React handle it
      // This prevents the "disposed before reset" error
    };
  }, [monacoRef]);

  return {
    original,
    language,
    modifiedContent, // Add the modifiedContent property
    inDiffMode,
    setInDiffMode
  };
}