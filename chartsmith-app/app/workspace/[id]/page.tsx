"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEditorView } from "@/hooks/useEditorView";
import { EditorLayout } from "@/components/editor/layout/EditorLayout";
import { WorkspaceContainer } from "@/components/editor/workspace/WorkspaceContainer";
import { ChatContainer } from "@/components/editor/chat/ChatContainer";
import { useWorkspaceUI } from "@/contexts/WorkspaceUIContext";
import { useParams } from "next/navigation";
import { useSession } from "@/app/hooks/useSession";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { Message } from "@/components/editor/types";
import { FileNode } from "@/lib/types/files";
import { Workspace } from "@/lib/types/workspace";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "@/components/ui/Card";
import { ChatMessage } from "@/components/editor/chat/ChatMessage";
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { sendChatMessageAction } from "@/lib/workspace/actions/send-chat-message";
import { Centrifuge } from "centrifuge";

export default function WorkspacePage() {
  const { setWorkspace, workspace } = useWorkspace();
  const params = useParams();
  const { session } = useSession();

  const { isChatVisible, isFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>();
  const [editorContent, setEditorContent] = useState<string>("");

  const followMode = true; // Always true for now
  const [centrifugoToken, setCentrifugoToken] = useState<string | null>(null);
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const hasConnectedRef = useRef(false);

  const { view, toggleView, updateFileSelection } = useEditorView();

  const renderedFiles: FileNode[] = [];

  useEffect(() => {
    if (!session) return;
    getCentrifugoTokenAction(session).then(setCentrifugoToken);
  }, [session]);

  useEffect(() => {
    if (!session) return;

    getWorkspaceMessagesAction(session, params.id as string).then(setMessages);
  }, [session, workspace, params.id]);

  useEffect(() => {
    if (!centrifugoToken || !session || hasConnectedRef.current || !workspace) {
      return;
    }

    if (!centrifugeRef.current) {
      centrifugeRef.current = new Centrifuge(process.env.NEXT_PUBLIC_CENTRIFUGO_ADDRESS!, {
        debug: true,
        token: centrifugoToken,
      });

      const cf = centrifugeRef.current;

      cf.on("connected", (ctx) => {
        // console.log("Connected to Centrifugo:", ctx);
      });

      cf.on("disconnected", (ctx) => {
        // console.log("Disconnected from Centrifugo:", ctx);
      });

      cf.on("error", (ctx) => {
        console.error("Centrifugo error:", ctx);
      });
    }

    const cf = centrifugeRef.current;
    const channel = `${workspace?.id}#${session.user.id}`;
    const sub = cf.newSubscription(channel);

    sub.on("publication", (message: { data: { workspace?: Workspace; message?: Message } }) => {
      // this could be a chatmessageupdated event or a workspaceupdated event
      const isWorkspaceUpdatedEvent = message.data.workspace;

      if (!isWorkspaceUpdatedEvent) {
        const chatMessage = message.data.message;
        if (!chatMessage?.id || !chatMessage.prompt || chatMessage.isComplete === undefined) return;

        setMessages((prevMessages) => {
          const index = prevMessages.findIndex((m) => m.id === chatMessage.id);
          if (index === -1) return prevMessages;
          const newMessages = [...prevMessages];
          newMessages[index] = chatMessage;
          return newMessages;
        });
      } else {
        // Only update workspace if it has changed
        const newWorkspace = message.data.workspace;
        if (newWorkspace) {
          setWorkspace(newWorkspace);
        }
      }
    });

    sub.on("subscribed", (ctx) => {
      // console.log(`Subscribed to channel ${channel}:`, ctx);
    });

    sub.on("error", (ctx) => {
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
  }, [centrifugoToken, session, workspace, setWorkspace]);

  // Handle auto-selecting new files in follow mode
  useEffect(() => {
    if (followMode && workspace?.files.length) {
      const lastFile = workspace.files[workspace.files.length - 1];
      const fileNode: FileNode = {
        name: lastFile.name,
        path: lastFile.path,
        content: lastFile.content,
        type: 'file'
      };
      setSelectedFile(fileNode);
      setEditorContent(lastFile.content || "");
      updateFileSelection(fileNode);
    }
  }, [workspace?.files.length, followMode, updateFileSelection, workspace?.files]);

  // Keep editor content in sync with selected file's content
  useEffect(() => {
    if (selectedFile && workspace) {
      const currentFile = workspace.files.find((f) => f.path === selectedFile.path);
      if (currentFile && currentFile.content !== editorContent) {
        const fileNode: FileNode = {
          name: currentFile.name,
          path: currentFile.path,
          content: currentFile.content,
          type: 'file'
        };
        setEditorContent(fileNode.content || "");
      }
    }
  }, [workspace, selectedFile, editorContent]);

  const handleSendMessage = async (message: string) => {
    if (!session || !workspace) return;
    const m = await sendChatMessageAction(session, workspace.id, message);
    setMessages((prevMessages) => [...prevMessages, m]);
  };

  if (!workspace) {
    return (
      <EditorLayout>
        <div className="flex items-center justify-center h-full w-full pt-8">
          <div className="px-4 w-full max-w-md">
            <Card className="p-6 w-full">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-lg font-medium text-muted-foreground">Loading workspace...</p>
              </div>
            </Card>
          </div>
        </div>
      </EditorLayout>
    );
  }

  // Show chat-only view when workspace has no files yet
  if (workspace.files.length === 0) {
    return (
      <EditorLayout>
        <div className="flex justify-center h-full w-full pt-8">
          <div className="px-4 w-full max-w-3xl">
            <Card className="p-6 w-full">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <ChatMessage key={message.id || index} message={message} />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </EditorLayout>
    );
  }

  const handleViewChange = () => {
    const newView = view === "source" ? "rendered" : "source";
    const newFiles = newView === "rendered" ? renderedFiles : workspace.files.map(file => ({
      name: file.name,
      path: file.path,
      content: file.content,
      type: 'file' as const
    }));
    toggleView(newFiles);
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setEditorContent(file.content || "");
    updateFileSelection(file);
  };

  const handleFileDelete = () => {
    return;
  };

  const handleUndoChanges = () => {
    return;
  };

  return (
    <EditorLayout>
      {isChatVisible && <ChatContainer messages={messages} onSendMessage={handleSendMessage} onUndoChanges={handleUndoChanges} />}
      <WorkspaceContainer
        view={view}
        onViewChange={handleViewChange}
        files={workspace.files.map(file => ({
          name: file.name,
          path: file.path,
          content: file.content,
          type: 'file' as const
        }))}
        renderedFiles={renderedFiles}
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        onFileDelete={handleFileDelete}
        editorContent={editorContent}
        onEditorChange={(value) => setEditorContent(value ?? "")}
        isFileTreeVisible={isFileTreeVisible}
      />
    </EditorLayout>
  );
}
