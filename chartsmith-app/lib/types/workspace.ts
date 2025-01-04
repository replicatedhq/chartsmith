export interface Workspace {
  id: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  name: string;
  files: File[];
  currentRevisionNumber: number;
}

export interface File {
  path: string;
  content: string;
  name: string;
}

export interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
}
