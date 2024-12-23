import { FileNode } from '../../types/files';
import { findFileByPath } from '../files/find';
import { updateDeploymentWithTypingEffect } from './changes';

interface ChatHandlerParams {
  files: FileNode[];
  setSelectedFile: (file: FileNode | undefined) => void;
  setEditorContent: (content: string) => void;
  setFiles: (files: FileNode[]) => void;
  typerRef: { current: { abort: () => void } | null };
}

export async function handleChatMessage({
  files,
  setSelectedFile,
  setEditorContent,
  setFiles,
  typerRef
}: ChatHandlerParams) {
  // First clear the deployment file content
  const deploymentFile = findFileByPath(files, 'templates/deployment.yaml');
  if (!deploymentFile) return null;

  // Select and clear the file
  setSelectedFile(deploymentFile);
  setEditorContent('');
  
  // Small delay to show empty file before typing starts
  await new Promise(resolve => setTimeout(resolve, 500));

  // Start typing effect with new content
  return updateDeploymentWithTypingEffect(
    files,
    setEditorContent,
    setFiles,
    typerRef
  );
}