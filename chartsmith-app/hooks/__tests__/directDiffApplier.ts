/**
 * Direct implementation of diff parsing focused on content rather than line numbers
 */
export function applyDiffByContent(originalContent: string, diffContent: string): string {
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
  const linesToAdd: {line: string, afterContextLine?: string}[] = [];
  let lastContextLine: string | undefined;
  
  for (const line of diffLines) {
    if (line.startsWith(' ') && !line.startsWith('---') && !line.startsWith('+++')) {
      // This is a context line
      lastContextLine = line.substring(1).trim();
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      // This is a line we need to add
      linesToAdd.push({
        line: line.substring(1),
        afterContextLine: lastContextLine
      });
    }
  }
  
  // Add the lines
  for (const {line, afterContextLine} of linesToAdd) {
    if (afterContextLine) {
      const contextIndex = lines.findIndex(l => l.trim() === afterContextLine);
      if (contextIndex >= 0) {
        lines.splice(contextIndex + 1, 0, line);
      } else {
        // If context line not found, add at the end
        lines.push(line);
      }
    } else {
      // If no context, add at the end
      lines.push(line);
    }
  }
  
  return lines.join('\n');
}