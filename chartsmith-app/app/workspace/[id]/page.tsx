"use client"

import React, { useState, useEffect } from 'react';
import { useEditorView } from '@/hooks/useEditorView';
import { EditorLayout } from '@/components/editor/layout/EditorLayout';
import { WorkspaceContainer } from '@/components/editor/workspace/WorkspaceContainer';
import { ChatContainer } from '@/components/editor/chat/ChatContainer';
import { useChartFiles } from '@/app/hooks/useChartFiles';
import { useWorkspaceUI } from '@/contexts/WorkspaceUIContext';
import { useParams } from 'next/navigation';
import { useSession } from '@/app/hooks/useSession';
import { getWorkspaceMessagesAction } from '@/lib/workspace/actions/get-workspace-messages';
import { Message } from '@/components/editor/types';
import { FileNode } from '@/lib/types/files';

export default function EditorPage() {
  const params = useParams();
  const { session } = useSession();
  const { isChatVisible, isFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const { view, toggleView, updateFileSelection } = useEditorView();

  const {
    files,
    setFiles,
    selectedFile,
    setSelectedFile,
    updateFile,
  } = useChartFiles({
    debug: true,
    workspaceID: params.id as string,
  });

  const handleSendMessage = async (message: string) => {
    if (isTyping) return;
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

  useEffect(() => {
    if (!session || !params.id) return;
    getWorkspaceMessagesAction(session, params.id as string).then(setMessages);
  }, [session, params.id]);

  useEffect(() => {
    if (selectedFile && selectedFile.path) {
      updateFile(selectedFile.path, editorContent);
    }
  }, [editorContent, selectedFile, updateFile]);

  const renderedFiles: FileNode[] = [];

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
        onEditorChange={(value) => setEditorContent(value ?? '')}
        isFileTreeVisible={isFileTreeVisible}
      />
    </EditorLayout>
  );
}
