"use client"

import React, { useState, useEffect, useRef } from 'react';
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
import { Workspace } from '@/lib/types/workspace';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card } from '@/components/ui/Card';
import { ChatMessage } from '@/components/editor/ChatMessage';
import { getCentrifugoTokenAction } from '@/lib/centrifugo/actions/get-centrifugo-token-action';
import { Centrifuge } from "centrifuge";

export default function WorkspacePage() {
  const { workspace } = useWorkspace();
  const params = useParams();
  const { session } = useSession();

  const { isChatVisible, isFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [centrifugoToken, setCentrifugoToken] = useState<string | null>(null);
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const hasConnectedRef = useRef(false);

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

  const renderedFiles: FileNode[] = [];

  useEffect(() => {
    if (!session) return;
    getCentrifugoTokenAction(session).then(setCentrifugoToken);
  }, [session]);

  useEffect(() => {
    if (selectedFile && selectedFile.path) {
      updateFile(selectedFile.path, editorContent);
    }
  }, [editorContent, selectedFile, updateFile]);

  useEffect(() => {
    if (!session) return;

    getWorkspaceMessagesAction(session, params.id as string).then(setMessages);
  }, [session, workspace]);

  useEffect(() => {
    if (!centrifugoToken || !session || hasConnectedRef.current) {
      return;
    }

    if (!centrifugeRef.current) {
      centrifugeRef.current = new Centrifuge(process.env.NEXT_PUBLIC_CENTRIFUGO_ADDRESS!, {
        debug: true,
        token: centrifugoToken
      });

      const cf = centrifugeRef.current;

      cf.on('connected', (ctx) => {
        console.log('Connected to Centrifugo:', ctx);
      });

      cf.on('disconnected', (ctx) => {
        console.log('Disconnected from Centrifugo:', ctx);
      });

      cf.on('error', (ctx) => {
        console.error('Centrifugo error:', ctx);
      });
    }

    const cf = centrifugeRef.current;
    const channel = `${workspace?.id}#${session.user.id}`;
   const sub = cf.newSubscription(channel);

    sub.on("publication", (message: any) => {
      console.log('Received message:', message);
      const chatMessage = message.data.message;
      if (!chatMessage) return;

      setMessages(prevMessages => {
        const index = prevMessages.findIndex(m => m.id === chatMessage.id);
        const newMessages = [...prevMessages];
        newMessages[index] = chatMessage;
        return newMessages;
      });
    });

    sub.on('subscribed', (ctx) => {
      console.log(`Subscribed to channel ${channel}:`, ctx);
    });

    sub.on('error', (ctx) => {
      console.error(`Subscription error for channel ${channel}:`, ctx);
    });

    sub.subscribe();
    cf.connect();
    hasConnectedRef.current = true;

    return () => {
      hasConnectedRef.current = false;
      cf.disconnect();
      centrifugeRef.current = null;
    };
  }, [centrifugoToken, session]);


  const handleSendMessage = async (message: string) => {
    return;
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

  console.log(centrifugoToken);
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

  if (!workspace) {
    return (
      <EditorLayout>
        <div className="flex items-center justify-center h-full w-full pt-8">
          <div className="px-4 w-full max-w-md">
            <Card className="p-6 w-full">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-lg font-medium text-muted-foreground">
                  Loading workspace...
                </p>
              </div>
            </Card>
          </div>
        </div>
      </EditorLayout>
    );
  }

  if (!workspace.isInitialized) {
    console.log(messages);
    return (
      <EditorLayout>
        <div className="flex justify-center h-full w-full pt-8">
          <div className="px-4 w-full max-w-3xl">
            <Card className="p-6 w-full">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    message={message}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </EditorLayout>
    )
  }

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
