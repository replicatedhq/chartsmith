export interface Workspace {
  id: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  name: string;
  charts: Chart[];
  files: WorkspaceFile[];
  currentRevisionNumber: number;
  incompleteRevisionNumber?: number;
}

export interface WorkspaceFile {
  id: string;
  filePath: string;  // Required - files without paths are filtered out
  content: string;   // Required but may be empty string
}

export interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
}

export interface Chart {
  id: string;
  name: string;
  files: WorkspaceFile[];
}
