import { useState, useCallback } from 'react';
import { FileNode } from '../components/editor/types';
import { convertFilesToTree, convertTreeToFiles } from '../utils/fileUtils';

interface UseFilesOptions {
  initialFiles?: FileNode[];
  debug?: boolean;
}

export function useFiles({ initialFiles = [], debug = false }: UseFilesOptions = {}) {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);

  const updateFiles = useCallback((newFiles: FileNode[]) => {
    if (debug) console.log('Updating files:', newFiles);
    setFiles(newFiles);
  }, [debug]);

  const updateFileContent = useCallback((path: string, content: string) => {
    setFiles(prev => prev.map(file => {
      if (file.path === path) {
        return { ...file, content };
      }
      if (file.type === 'folder' && file.children) {
        return {
          ...file,
          children: file.children.map(child => 
            child.path === path ? { ...child, content } : child
          )
        };
      }
      return file;
    }));
  }, []);

  const importFiles = useCallback((fileMap: Record<string, string>) => {
    if (debug) console.log('Importing files:', fileMap);
    const fileTree = convertFilesToTree(fileMap, { debug });
    setFiles(fileTree);
    return fileTree;
  }, [debug]);

  const exportFiles = useCallback(() => {
    return convertTreeToFiles(files);
  }, [files]);

  return {
    files,
    setFiles: updateFiles,
    updateFileContent,
    importFiles,
    exportFiles
  };
}