import yaml from 'yaml';

export function parseYAML(content: string): any {
  try {
    return yaml.parse(content);
  } catch {
    return null;
  }
}

export function validateYAMLIndentation(content: string): { line: number; message: string }[] {
  const errors: { line: number; message: string }[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Check if line has content and isn't properly indented
    const match = line.match(/^(\s*)\S/);
    if (match) {
      const indentLevel = match[1].length;
      if (indentLevel % 2 !== 0) {
        errors.push({
          line: index + 1,
          message: `Incorrect indentation at line ${index + 1}. Expected multiple of 2 spaces.`
        });
      }
    }
  });

  return errors;
}