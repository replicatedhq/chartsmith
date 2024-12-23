import { useState, useEffect, useRef } from 'react';
import { FileNode } from '../types/files';
import { Message } from '../types/messages';
import { findFileByPath } from '../utils/files/find';
import { handleChatMessage } from '../utils/editor/chat';

export function useEditor(initialFiles: FileNode[], defaultFile?: FileNode) {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>(defaultFile);
  const [editorContent, setEditorContent] = useState<string>(defaultFile?.content || '');
  const [isTyping, setIsTyping] = useState(false);
  const typerRef = useRef<{ abort: () => void } | null>(null);

  // Update editor content when selected file changes
  useEffect(() => {
    if (selectedFile && !isTyping) {
      setEditorContent(selectedFile.content || '');
    }
  }, [selectedFile, isTyping]);

  // Update file content when editor content changes
  useEffect(() => {
    if (selectedFile && !isTyping) {
      setFiles(prev => prev.map(f =>
        f.path === selectedFile.path ? { ...f, content: editorContent } : f
      ));
    }
  }, [editorContent, selectedFile, isTyping]);

  // Cleanup typing effect on unmount
  useEffect(() => {
    return () => {
      if (typerRef.current) {
        typerRef.current.abort();
      }
    };
  }, []);

  const handleSendMessage = async (message: string, onMessageAdd: (messages: Message[]) => void) => {
    if (isTyping) return;

    // Add user message
    onMessageAdd([{ role: 'user', content: message }]);

    setIsTyping(true);

    try {
      // Abort any existing typing effect
      if (typerRef.current) {
        typerRef.current.abort();
      }

      // Handle the chat message and get updates
      const result = await handleChatMessage({
        files,
        setSelectedFile,
        setEditorContent,
        setFiles,
        typerRef
      });

      if (result) {
        // Add assistant response
        onMessageAdd([{
          role: 'assistant',
          content: "I've updated the deployment.yaml file with a timestamp annotation to track changes.",
          changes: `Added timestamp annotation: ${result.timestamp}`,
          fileChanges: [{
            path: 'templates/deployment.yaml',
            content: result.content
          }]
        }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  return {
    files,
    setFiles,
    selectedFile,
    setSelectedFile,
    editorContent,
    setEditorContent,
    isTyping,
    handleSendMessage
  };
}