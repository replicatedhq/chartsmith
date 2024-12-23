import { FileNode, FileMap, FileTreeOptions } from '../../types/files';

export function convertFilesToTree(files: FileMap, options: FileTreeOptions = {}): FileNode[] {
  const { sortPaths = true, debug = false } = options;
  
  if (debug) console.log('Converting files to tree:', files);
  
  const root: FileNode[] = [];
  const paths = sortPaths ? Object.keys(files).sort() : Object.keys(files);
  
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