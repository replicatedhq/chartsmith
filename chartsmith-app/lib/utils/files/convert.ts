import { FileNode, FileTreeOptions } from "../../types/files";

interface ExtendedFileMap {
  [path: string]: {
    content: string;
    id?: string;
    revisionNumber?: number;
    chartId?: string;
    workspaceId?: string;
  };
}

export function convertFilesToTree(files: ExtendedFileMap, options: FileTreeOptions = {}): FileNode[] {
  const { sortPaths = true, debug = false } = options;

  const root: FileNode[] = [];
  const paths = sortPaths ? Object.keys(files).sort() : Object.keys(files);

  for (const path of paths) {
    const parts = path.split("/");
    let current = root;

    // Create folder nodes
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/");
      let folder = current.find((node) => node.type === "folder" && node.name === part);

      if (!folder) {
        folder = {
          name: part,
          type: "folder",
          children: [],
          filePath: folderPath,
          content: "", // Adding required content property for folders
        };
        current.push(folder);
      }

      current = folder.children!;
    }

    // Create file node
    const fileName = parts[parts.length - 1];
    const fileData = files[path];
    current.push({
      name: fileName,
      type: "file",
      filePath: path,
      content: fileData.content,
      id: fileData.id,
      revisionNumber: fileData.revisionNumber,
      chartId: fileData.chartId,
      workspaceId: fileData.workspaceId,
    });
  }

  return root;
}
