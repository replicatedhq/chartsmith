import { FileNode } from '../types';

// Helper function to build file paths
export function addFilePaths(nodes: FileNode[], parentPath = ''): FileNode[] {
  return nodes.map(node => {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    const newNode = { ...node, path: currentPath };
    if (node.children) {
      newNode.children = addFilePaths(node.children, currentPath);
    }
    return newNode;
  });
}

// Helper function to find a file by its path
export function findFileByPath(nodes: FileNode[], path: string): FileNode | undefined {
  if (!path || !nodes) return undefined;
  
  const parts = path.split('/');
  let current: FileNode | undefined = nodes.find(node => node.name === parts[0]);

  for (let i = 1; i < parts.length && current; i++) {
    if (!current.children) return undefined;
    current = current.children.find(node => node.name === parts[i]);
  }

  return current;
}

// Helper function to delete a file by its path
export function deleteFileByPath(nodes: FileNode[], path: string): FileNode[] {
  if (!path) return nodes;

  const parts = path.split('/');
  
  if (parts.length === 1) {
    return nodes.filter(node => node.name !== parts[0]);
  }

  return nodes.map(node => {
    if (node.name === parts[0] && node.children) {
      return {
        ...node,
        children: deleteFileByPath(node.children, parts.slice(1).join('/'))
      };
    }
    return node;
  });
}

export function getLanguageFromFilename(filename: string): string {
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
  if (filename.endsWith('.txt')) return 'plaintext';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.md')) return 'markdown';
  return 'plaintext';
}