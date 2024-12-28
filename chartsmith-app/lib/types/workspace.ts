import { FileNode } from "./files";

export interface Workspace {
  id: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  name: string;

  files: FileNode[];
}
