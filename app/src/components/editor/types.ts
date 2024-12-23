export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  path?: string;
  hasError?: boolean;
  errorCount?: number;
  errorLine?: number;
  scenarioId?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  changes?: string;
  fileChanges?: {
    path: string;
    content: string;
  }[];
}

export interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
}