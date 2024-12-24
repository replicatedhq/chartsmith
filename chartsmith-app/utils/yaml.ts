export interface YAMLError {
  line: number;
  message: string;
}

export function validateYAMLIndentation(content: string): YAMLError[] {
  // Simple implementation that checks for basic indentation issues
  const errors: YAMLError[] = [];
  const lines = content.split('\n');
  let previousIndent = 0;

  lines.forEach((line, index) => {
    const indent = line.search(/\S/);
    if (indent > -1) {
      if (indent > previousIndent + 2) {
        errors.push({
          line: index + 1,
          message: 'Invalid indentation: too many spaces'
        });
      }
      previousIndent = indent;
    }
  });

  return errors;
}
