import { validateYAMLIndentation } from "@/utils/yaml";

export function findErrorLines(content: string): number[] {
  const errors = validateYAMLIndentation(content);
  return errors.map((error) => error.line);
}

export function getErrorMessage(line: number, errors: { line: number; message: string }[]): string {
  const error = errors.find((e) => e.line === line);
  return error?.message || "Unknown error";
}
