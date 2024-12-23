"use client"

import { FileNode } from '@/lib/types/files';
import { Session } from '@/lib/types/session';
import { convertFilesToTree } from '@/lib/utils/files/convert';
import { findFileByPath } from '@/lib/utils/files/find';
import { deleteFile, updateFileContent } from '@/lib/utils/files/update';
import { useState, useCallback, useEffect } from 'react';
import { useSession } from './useSession';
import { getInitialWorkspaceFiles } from '@/lib/workspace/actions/get-workspace-files';

interface UseChartFilesOptions {
  debug?: boolean;
  workspaceID: string;
}

export function useChartFiles(props: UseChartFilesOptions) {
  const { isSessionLoading, session } = useSession();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>();

  useEffect(() => {
    getInitialWorkspaceFiles(props.workspaceID).then(setFiles);
  }, [session]);

  const importFiles = useCallback((fileMap: Record<string, string>) => {
    if (props.debug) {
      console.log('Importing files:', fileMap);
      if (!fileMap || Object.keys(fileMap).length === 0) {
        console.warn('Empty or invalid file map provided');
        return [];
      }
    }

    const fileTree = convertFilesToTree(fileMap, { debug: props.debug });
    setFiles(fileTree);

    // Select default file
    const defaultFile = findFileByPath(fileTree, 'example-chart/Chart.yaml') ||
                       findFileByPath(fileTree, 'example-chart/values.yaml');
    if (defaultFile) {
      setSelectedFile(defaultFile);
    }

    return fileTree;
  }, [props.debug]);

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
