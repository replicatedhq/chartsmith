import React, { useState, useEffect } from 'react';
import { ChatPanel } from '../components/editor/ChatPanel';
import { CodeEditor } from '../components/editor/CodeEditor';
import { FileBrowser } from '../components/editor/FileBrowser';
import { TopNav } from '../components/layout/TopNav';
import { FileNode } from '../components/editor/types';
import { defaultFiles } from '../components/editor/utils/defaultFiles';
import { findFileByPath, deleteFileByPath } from '../components/editor/utils/fileUtils';
import { useTheme } from '../contexts/ThemeContext';

interface EditorPageProps {
  isChatVisible: boolean;
  isFileTreeVisible: boolean;
}

export function EditorPage({ isChatVisible, isFileTreeVisible }: EditorPageProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [files, setFiles] = useState<FileNode[]>(defaultFiles);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>(() => {
    return findFileByPath(defaultFiles, 'my-helm-chart/Chart.yaml');
  });
  const { theme } = useTheme();

  const handleSendMessage = (message: string) => {
    setMessages([...messages, { role: 'user', content: message }]);
    // Simulate assistant response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I understand you want to work with Helm charts. How can I help you with that?'
      }]);
    }, 1000);
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
  };

  const handleFileDelete = (path: string) => {
    const updatedFiles = deleteFileByPath(files, path);
    setFiles(updatedFiles);
    if (selectedFile?.path === path) {
      setSelectedFile(undefined);
    }
  };

  // Check for pending chat message from recommendations
  useEffect(() => {
    const pendingMessage = sessionStorage.getItem('pendingChatMessage');
    if (pendingMessage) {
      handleSendMessage(pendingMessage);
      sessionStorage.removeItem('pendingChatMessage');
    }
  }, []);

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-dark' : 'bg-white'}`}>
      <TopNav />
      <div className="flex-1 flex min-h-0">
        {isChatVisible && (
          <div className={`w-[400px] border-r flex flex-col min-h-0 ${
            theme === 'dark' 
              ? 'bg-dark-surface border-dark-border' 
              : 'bg-white border-gray-200'
          }`}>
            <ChatPanel messages={messages} onSendMessage={handleSendMessage} />
          </div>
        )}
        <div className="flex-1 flex min-h-0">
          {isFileTreeVisible && (
            <FileBrowser 
              nodes={files}
              onFileSelect={handleFileSelect}
              onFileDelete={handleFileDelete}
              selectedFile={selectedFile}
            />
          )}
          <div className={`w-px ${theme === 'dark' ? 'bg-dark-border' : 'bg-gray-200'} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <CodeEditor file={selectedFile} theme={theme} />
          </div>
        </div>
      </div>
    </div>
  );
}