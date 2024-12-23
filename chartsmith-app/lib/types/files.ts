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

export interface FileMap {
  [path: string]: string;
}

export interface FileTreeOptions {
  sortPaths?: boolean;
  debug?: boolean;
}
