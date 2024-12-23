import { FileNode } from '../../types/files';

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

export function findFilesByType(nodes: FileNode[], type: string): FileNode[] {
  const results: FileNode[] = [];

  function traverse(node: FileNode) {
    if (node.type === 'file' && node.name.endsWith(type)) {
      results.push(node);
    }
    if (node.type === 'folder' && node.children) {
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return results;
}