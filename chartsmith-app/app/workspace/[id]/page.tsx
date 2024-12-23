"use client"

import React, { useState, useEffect } from 'react';
import { FileNode, Message } from '@/components/editor/types';
import { useEditorView } from '@/hooks/useEditorView';
import { EditorLayout } from '@/components/editor/layout/EditorLayout';
import { WorkspaceContainer } from '@/components/editor/workspace/WorkspaceContainer';
import { useChartFiles } from '@/app/hooks/useChartFiles';
import { ChatContainer } from '@/components/editor/chat/ChatContainer';

export default function EditorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editorContent, setEditorContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const isChatVisible = true;
  const isFileTreeVisible = true;

  const {
    files,
    setFiles,
    selectedFile,
    setSelectedFile,
    updateFile,
    importFiles
  } = useChartFiles({
    initialFiles: [],
    debug: true
  });

  const handleSendMessage = async (message: string) => {
    if (isTyping) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    setIsTyping(true);
  };

  const handleUndoChanges = (message: Message) => {
    if (message.fileChanges) {
      message.fileChanges.forEach(change => {
        updateFile(change.path, change.content);
        if (selectedFile?.path === change.path) {
          setEditorContent(change.content);
        }
      });
    }
  };

  // Update file content when editor content changes
  useEffect(() => {
    if (selectedFile && selectedFile.path) {
      updateFile(selectedFile.path, editorContent);
    }
  }, [editorContent, selectedFile, updateFile]);

  // Render templates for preview
  const renderedFiles: FileNode[] = [];

  const { view, toggleView, updateFileSelection, viewState } = useEditorView();

  const handleViewChange = () => {
    const newView = view === 'source' ? 'rendered' : 'source';
    const newFiles = newView === 'rendered' ? renderedFiles : files;
    toggleView(newFiles);
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setEditorContent(file.content || '');
    updateFileSelection(file);
  };

  return (
    <EditorLayout>
      {isChatVisible && (
        <ChatContainer
          messages={messages}
          onSendMessage={handleSendMessage}
          onUndoChanges={handleUndoChanges}
        />
      )}
      <WorkspaceContainer
        view={view}
        onViewChange={handleViewChange}
        files={files}
        renderedFiles={renderedFiles}
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        onFileDelete={path => {
          setFiles(files.filter(f => f.path !== path));
          if (selectedFile?.path === path) {
            setSelectedFile(undefined);
            setEditorContent('');
          }
        }}
        editorContent={editorContent}
        onEditorChange={setEditorContent}
        isFileTreeVisible={isFileTreeVisible}
      />
    </EditorLayout>
  );
}
