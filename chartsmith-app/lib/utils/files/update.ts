import { FileNode } from '../../types/files';

export function updateFileContent(files: FileNode[], path: string, content: string): FileNode[] {
  return files.map(file => {
    if (file.path === path) {
      return { ...file, content };
    }
    if (file.type === 'folder' && file.children) {
      return {
        ...file,
        children: updateFileContent(file.children, path, content)
      };
    }
    return file;
  });
}

export function deleteFile(files: FileNode[], path: string): FileNode[] {
  return files.filter(file => {
    if (file.path === path) {
      return false;
    }
    if (file.type === 'folder' && file.children) {
      return {
        ...file,
        children: deleteFile(file.children, path)
      };
    }
    return true;
  });
}
