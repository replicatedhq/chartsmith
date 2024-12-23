import { useState, useCallback } from 'react';
import { FileNode } from '../types/files';
import { convertFilesToTree } from '../utils/files/convert';
import { findFileByPath } from '../utils/files/find';
import { updateFileContent, deleteFile } from '../utils/files/update';

interface UseChartFilesOptions {
  initialFiles?: FileNode[];
  debug?: boolean;
}

export function useChartFiles({ initialFiles = [], debug = false }: UseChartFilesOptions = {}) {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>();

  const importFiles = useCallback((fileMap: Record<string, string>) => {
    if (debug) {
      console.log('Importing files:', fileMap);
      if (!fileMap || Object.keys(fileMap).length === 0) {
        console.warn('Empty or invalid file map provided');
        return [];
      }
    }

    const fileTree = convertFilesToTree(fileMap, { debug });
    setFiles(fileTree);

    // Select default file
    const defaultFile = findFileByPath(fileTree, 'example-chart/Chart.yaml') || 
                       findFileByPath(fileTree, 'example-chart/values.yaml');
    if (defaultFile) {
      setSelectedFile(defaultFile);
    }

    return fileTree;
  }, [debug]);

  const updateFile = useCallback((path: string, content: string) => {
    if (!path) {
      console.warn('No path provided for file update');
      return;
    }
    setFiles(prev => updateFileContent(prev, path, content));
  }, []);

  const deleteFileByPath = useCallback((path: string) => {
    if (!path) {
      console.warn('No path provided for file deletion');
      return;
    }
    setFiles(prev => deleteFile(prev, path));
    if (selectedFile?.path === path) {
      setSelectedFile(undefined);
    }
  }, [selectedFile]);

  return {
    files,
    setFiles,
    selectedFile,
    setSelectedFile,
    importFiles,
    updateFile,
    deleteFile: deleteFileByPath
  };
}