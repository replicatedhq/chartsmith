"use client"

import React, { useState, useEffect } from 'react';
import { FileNode, Message } from '@/components/editor/types';
import { useEditorView } from '@/hooks/useEditorView';
import { EditorLayout } from '@/components/editor/layout/EditorLayout';
import { WorkspaceContainer } from '@/components/editor/workspace/WorkspaceContainer';
import { ChatContainer } from '@/components/editor/chat/ChatContainer';
import { useChartFiles } from '@/app/hooks/useChartFiles';

import { useWorkspaceUI } from '@/contexts/WorkspaceUIContext';
import { useParams } from 'next/navigation';
import { useSession } from '@/app/hooks/useSession';
import { getWorkspaceMessagesAction } from '@/lib/workspace/actions/get-workspace-messages';


export default function EditorPage() {
  const params = useParams();
  const { isSessionLoading, session } = useSession();
  const { isChatVisible, isFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [editorContent, setEditorContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  if (!params.id) {
    return <div>Workspace not found</div>;
  }

  const {
    files,
    setFiles,
    selectedFile,
    setSelectedFile,
    updateFile,
    importFiles
  } = useChartFiles({
    debug: true,
    workspaceID: params.id as string,
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

  // load the initial messages
  useEffect(() => {
    if (!session) {
      return;
    }

    getWorkspaceMessagesAction(session, params.id as string).then(setMessages);
  }, [session]);

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
