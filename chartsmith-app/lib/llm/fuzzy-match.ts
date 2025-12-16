/**
 * Fuzzy string replacement for LLM-generated text editor operations.
 * Ported from pkg/llm/execute-action.go (PerformStringReplacement and findBestMatchRegion)
 *
 * Handles cases where the LLM provides strings that don't exactly match
 * the content due to whitespace differences, minor variations, etc.
 */

// Constants for fuzzy matching
const MIN_FUZZY_MATCH_LEN = 50;
const CHUNK_SIZE = 200;
const MAX_CHUNKS = 100;
const MAX_OCCURRENCES = 100;

export interface StringReplacementResult {
  content: string;
  success: boolean;
  error?: Error;
}

/**
 * Perform string replacement with fuzzy matching fallback.
 *
 * First attempts an exact match. If not found, uses a sliding window
 * fuzzy matching algorithm to find the best approximate match.
 *
 * @param content - The content to search within
 * @param oldStr - The string to find and replace
 * @param newStr - The replacement string
 * @returns Result with updated content, success flag, and optional error
 */
export function performStringReplacement(
  content: string,
  oldStr: string,
  newStr: string
): StringReplacementResult {
  // First try exact match
  if (content.includes(oldStr)) {
    const updatedContent = content.split(oldStr).join(newStr);
    return { content: updatedContent, success: true };
  }

  // No exact match found, attempt fuzzy matching
  const { start, end } = findBestMatchRegion(content, oldStr, MIN_FUZZY_MATCH_LEN);

  if (start === -1 || end === -1) {
    return {
      content,
      success: false,
      error: new Error('Approximate match for replacement not found'),
    };
  }

  // Replace the matched region with newStr
  const updatedContent = content.substring(0, start) + newStr + content.substring(end);
  return { content: updatedContent, success: false };
}

interface MatchRegion {
  start: number;
  end: number;
}

/**
 * Find the best matching region in content for the given string.
 * Uses a sliding window approach with overlapping chunks.
 *
 * @param content - The content to search within
 * @param oldStr - The string to find
 * @param minMatchLen - Minimum length for a valid match
 * @returns Start and end positions of the best match, or -1,-1 if not found
 */
function findBestMatchRegion(
  content: string,
  oldStr: string,
  minMatchLen: number
): MatchRegion {
  // Early return if strings are too small
  if (oldStr.length < minMatchLen) {
    return { start: -1, end: -1 };
  }

  let bestStart = -1;
  let bestEnd = -1;
  let bestLen = 0;

  let chunksProcessed = 0;

  // Use a sliding window approach with overlapping chunks
  // This helps catch matches that might span chunk boundaries
  for (let i = 0; i < oldStr.length && chunksProcessed < MAX_CHUNKS; i += Math.floor(CHUNK_SIZE / 2)) {
    // Determine the end of this chunk with overlap
    const chunkEnd = Math.min(i + CHUNK_SIZE, oldStr.length);

    // Get the current chunk
    const chunk = oldStr.substring(i, chunkEnd);

    // Skip empty or tiny chunks
    if (chunk.length < 10) {
      continue;
    }

    chunksProcessed++;

    // Find all occurrences of this chunk in the content
    let start = 0;
    let occurrencesChecked = 0;

    while (occurrencesChecked < MAX_OCCURRENCES) {
      const idx = content.indexOf(chunk, start);
      if (idx === -1) {
        break;
      }

      occurrencesChecked++;

      // Try to extend the match forward and backward
      let matchStart = idx;
      let matchEnd = idx + chunk.length;
      let matchLen = chunk.length;

      // Store the original i value for backward extension
      const originalI = i;

      // Try to extend forward
      while (matchEnd < content.length && (i + matchLen) < oldStr.length) {
        if (content[matchEnd] === oldStr[i + matchLen]) {
          matchEnd++;
          matchLen++;
        } else {
          break;
        }
      }

      // Try to extend backward
      let backPos = originalI - 1;
      while (matchStart > 0 && backPos >= 0) {
        if (content[matchStart - 1] === oldStr[backPos]) {
          matchStart--;
          backPos--;
        } else {
          break;
        }
      }

      // Update best match if this one is longer
      if (matchLen > bestLen) {
        bestStart = matchStart;
        bestEnd = matchEnd;
        bestLen = matchLen;
      }

      // Move start position for next search
      start = idx + 1;
    }
  }

  if (bestLen >= minMatchLen) {
    return { start: bestStart, end: bestEnd };
  }

  return { start: -1, end: -1 };
}
