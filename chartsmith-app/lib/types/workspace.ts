export interface Workspace {
  id: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  name: string;

  files: File[];
}

export interface File {
  path: string;
  content: string;
  name: string;
}
