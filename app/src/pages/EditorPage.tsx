import React, { useState, useEffect } from 'react';
import { EditorLayout } from '../components/editor/layout/EditorLayout';
import { ChatContainer } from '../components/editor/chat/ChatContainer';
import { WorkspaceContainer } from '../components/editor/workspace/WorkspaceContainer';
import { Message, FileNode } from '../components/editor/types';
import { defaultFiles } from '../components/editor/utils/defaultFiles';
import { useFiles } from '../hooks/useFiles';
import { useChartFiles } from '../hooks/useChartFiles';
import { useEditorView } from '../hooks/useEditorView';
import { renderHelmTemplate } from '../utils/helmUtils';
import { findFileByPath } from '../components/editor/utils/fileUtils';
import { updateDeploymentWithTimestamp } from '../utils/editorUtils';

interface EditorPageProps {
  isChatVisible: boolean;
  isFileTreeVisible: boolean;
}

export function EditorPage({ isChatVisible, isFileTreeVisible }: EditorPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editorContent, setEditorContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const { 
    files, 
    setFiles, 
    selectedFile, 
    setSelectedFile, 
    updateFile, 
    importFiles 
  } = useChartFiles({
    initialFiles: defaultFiles,
    debug: true
  });

  const handleSendMessage = async (message: string) => {
    if (isTyping) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    setIsTyping(true);

    try {
      // Select deployment.yaml
      const deploymentFile = findFileByPath(files, 'example-chart/templates/deployment.yaml');
      if (deploymentFile) {
        setSelectedFile(deploymentFile);

        const { timestamp, files: updatedFiles } = await updateDeploymentWithTimestamp(
          files,
          setEditorContent,
          setFiles
        );

        // Add assistant response
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I've updated the deployment.yaml file with a timestamp annotation to track changes.",
          changes: `Added timestamp annotation: ${timestamp}`,
          fileChanges: [{
            path: 'example-chart/templates/deployment.yaml',
            content: deploymentFile.content || ''
          }]
        }]);
      }
    } finally {
      setIsTyping(false);
    }
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

  // Load files from session storage on mount
  useEffect(() => {
    const storedFiles = sessionStorage.getItem('chartFiles');
    const initializeFiles = () => {
      const defaultFile = findFileByPath(defaultFiles, 'example-chart/Chart.yaml') ||
                         findFileByPath(defaultFiles, 'example-chart/values.yaml');
      setFiles(defaultFiles);
      if (defaultFile) {
        setSelectedFile(defaultFile);
        setEditorContent(defaultFile.content || '');
      }
    };

    if (storedFiles) {
      console.log('Loading stored files...');
      try {
        const parsedFiles = JSON.parse(storedFiles);
        if (Array.isArray(parsedFiles) && parsedFiles.length > 0) {
          console.log('Valid stored files found:', parsedFiles);
          setFiles(parsedFiles);
          
          // Select default file
          const defaultFile = findFileByPath(parsedFiles, 'Chart.yaml') || 
                            findFileByPath(parsedFiles, 'values.yaml');
          if (defaultFile) {
            setSelectedFile(defaultFile);
            setEditorContent(defaultFile.content || '');
          }
        } else {
          console.log('No valid stored files, using defaults');
          initializeFiles();
        }
      } catch (error) {
        console.error('Error loading stored files:', error);
        initializeFiles();
      } finally {
        sessionStorage.removeItem('chartFiles');
      }
    } else {
      console.log('No stored files found, using defaults');
      initializeFiles();
    }
  }, [setFiles]);

  // Update file content when editor content changes
  useEffect(() => {
    if (selectedFile && selectedFile.path) {
      updateFile(selectedFile.path, editorContent);
    }
  }, [editorContent, selectedFile, updateFile]);

  // Render templates for preview
  const renderedFiles = renderHelmTemplate(files);

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