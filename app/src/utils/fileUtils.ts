import { FileNode } from '../components/editor/types';

// Types for file operations
interface FileMap {
  [path: string]: string;
}

interface FileTreeOptions {
  sortPaths?: boolean;
  debug?: boolean;
}

// Convert flat key-value files object to FileNode tree structure
export function convertFilesToTree(files: FileMap, options: FileTreeOptions = {}): FileNode[] {
  const { sortPaths = true, debug = false } = options;
  
  if (debug) console.log('Converting files to tree:', files);
  
  const root: FileNode[] = [];
  const paths = sortPaths ? Object.keys(files).sort() : Object.keys(files);
  
  if (debug) console.log('Paths:', paths);
  
  for (const path of paths) {
    const parts = path.split('/');
    let current = root;
    
    // Create folder nodes
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const folderPath = parts.slice(0, i + 1).join('/');
      let folder = current.find(node => node.type === 'folder' && node.name === part);
      
      if (!folder) {
        folder = {
          name: part,
          type: 'folder',
          children: [],
          path: folderPath
        };
        current.push(folder);
      }
      
      current = folder.children!;
    }
    
    // Create file node
    const fileName = parts[parts.length - 1];
    current.push({
      name: fileName,
      type: 'file',
      path: path,
      content: files[path]
    });
  }
  
  return root;
}

// Convert tree structure back to flat files object
export function convertTreeToFiles(nodes: FileNode[]): FileMap {
  const files: FileMap = {};
  
  function traverse(node: FileNode, parentPath: string = '') {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    
    if (node.type === 'file' && node.content) {
      files[currentPath] = node.content;
    }
    
    if (node.type === 'folder' && node.children) {
      node.children.forEach(child => traverse(child, currentPath));
    }
  }
  
  nodes.forEach(node => traverse(node));
  return files;
}